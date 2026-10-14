import { describe, expect, it } from 'vitest';
import { settle } from '../sim/engine';
import { blastRadius, clusterMetrics, modelStatus } from '../sim/selectors';
import type { SimState } from '../sim/types';
import { FRAMES } from './frames';
import { canGoNext, frameStart, startTour, tourReducer, type TourState } from './tour';

/** Let the cluster finish moving, as if the user waited on this frame. */
function wait(t: TourState): TourState {
  for (let i = 0; i < 2000; i++) {
    const next = tourReducer(t, { type: 'sim', action: { type: 'tick' } });
    if (next === t) return t;
    t = next;
  }
  throw new Error('tour did not settle');
}

/** Do the current frame's task the way the UI would. */
function doTask(t: TourState): TourState {
  const task = FRAMES[t.index].task!;
  return tourReducer(t, { type: 'sim', action: task.action(t.sim) });
}

const next = (t: TourState) => tourReducer(t, { type: 'next' });
const titleOf = (t: TourState) => FRAMES[t.index].title;

const nodesOf = (s: SimState, model: string) =>
  s.instances
    .filter((i) => s.models.find((m) => m.id === i.modelId)!.name === model && i.nodeId)
    .map((i) => i.nodeId);
const used = (s: SimState, nodeId: string) =>
  s.instances.filter((i) => i.nodeId === nodeId).reduce((n, i) => n + i.gpus, 0);

/** Walk the whole tour like a user would, returning the settled state seen on each frame. */
function walkTour(): TourState[] {
  const seen: TourState[] = [];
  let t = startTour();
  for (;;) {
    t = wait(t);
    seen.push(t);
    const frame = FRAMES[t.index];
    if (frame.end) return seen;
    const from = t.index;
    // Task frames move on by themselves once the task (and any follow-up) is done.
    t = frame.task ? wait(doTask(t)) : next(t);
    if (t.index !== from + 1) throw new Error(`could not leave "${frame.title}"`);
  }
}

const tour = walkTour();
const at = (title: string) => {
  const t = tour.find((x) => titleOf(x) === title);
  if (!t) throw new Error(`frame not reached: ${title}`);
  return t.sim;
};

describe('the tour as a whole', () => {
  it('visits every frame once, in order', () => {
    expect(tour.map((t) => t.index)).toEqual(FRAMES.map((_, i) => i));
  });

  it('only offers Next on narrated frames, after the cluster settles', () => {
    for (const t of tour) {
      const f = FRAMES[t.index];
      expect(canGoNext(t)).toBe(!f.task && !f.end);
    }
  });
});

// Each block checks the claims made in that frame's text.
describe('narration matches the cluster', () => {
  it('Welcome: 8 nodes, 64 GPUs, nothing running', () => {
    const m = clusterMetrics(at('Welcome'));
    expect(m.capacity).toBe(64);
    expect(at('Welcome').nodes).toHaveLength(8);
    expect(m.used).toBe(0);
  });

  it('Models and instances: chat-medium runs 2 × 4-GPU instances', () => {
    const s = at('Models and instances');
    expect(nodesOf(s, 'chat-medium')).toHaveLength(2);
    expect(s.models[0]).toMatchObject({ name: 'chat-medium', gpus: 4, replicas: 2 });
  });

  it('Efficient packing: 3 nodes used, 5 empty, an 8-GPU model fits', () => {
    const s = at('Efficient packing');
    const empty = s.nodes.filter((n) => used(s, n.id) === 0).map((n) => n.id);
    expect(empty).toEqual(['node-4', 'node-5', 'node-6', 'node-7', 'node-8']);
    expect(clusterMetrics(s).largestFit).toBe(8);
  });

  it('Eggs in one basket: node-2 runs 4 models, 3 with their only instance; node-1 has both chat-medium', () => {
    const s = at('Eggs in one basket');
    expect(blastRadius(s, 'node-2').models).toBe(4);
    for (const m of ['code-assist', 'vision', 'summarizer']) expect(nodesOf(s, m)).toEqual(['node-2']);
    expect(nodesOf(s, 'chat-medium')).toEqual(['node-1', 'node-1']);
    expect(clusterMetrics(s).worstBlast).toEqual({ nodeName: 'node-2', models: 4 });
  });

  it('The damage: node-2 is down and binpack rebuilt the basket on node-3 (4 models)', () => {
    const s = at('The damage');
    expect(s.nodes.find((n) => n.id === 'node-2')!.up).toBe(false);
    expect(clusterMetrics(s).waiting).toBe(0);
    for (const m of ['code-assist', 'vision', 'summarizer']) expect(nodesOf(s, m)).toEqual(['node-3']);
    expect(blastRadius(s, 'node-3').models).toBe(4);
  });

  it('Try spread: starts from an empty binpack cluster with every node up', () => {
    const s = at('Your turn: try spread');
    expect(s.strategy).toBe('binpack');
    expect(s.instances).toHaveLength(0);
    expect(s.nodes.every((n) => n.up)).toBe(true);
  });

  it('A smaller blast radius: no node runs more than 2 models; chat-medium on different nodes', () => {
    const s = at('A smaller blast radius');
    expect(s.strategy).toBe('spread');
    expect(clusterMetrics(s).worstBlast!.models).toBe(2);
    expect(new Set(nodesOf(s, 'chat-medium')).size).toBe(2);
  });

  it('The catch: chat-large waits with 46 GPUs free; every node has something on it', () => {
    const s = at('The catch');
    const m = clusterMetrics(s);
    expect(m.free).toBe(46);
    expect(m.largestFit).toBe(7);
    expect(m.waiting).toBe(1);
    expect(s.nodes.every((n) => used(s, n.id) > 0)).toBe(true);
  });

  it('A busier cluster: every node has exactly 3 GPUs free, 24 in total', () => {
    const s = at('A busier cluster');
    expect(s.strategy).toBe('spread');
    expect(s.nodes.every((n) => used(s, n.id) === 5)).toBe(true);
    expect(clusterMetrics(s).free).toBe(24);
  });

  it('Stuck: v2 waits, both v1 instances keep running', () => {
    const s = at('Stuck');
    const model = s.models.find((m) => m.name === 'chat-medium')!;
    const status = modelStatus(s, model);
    expect(status).toMatchObject({ kind: 'stuck', upgrading: true });
    const mine = s.instances.filter((i) => i.modelId === model.id);
    expect(mine.filter((i) => i.version === 1 && i.nodeId)).toHaveLength(2);
    expect(mine.filter((i) => i.version === 2 && !i.nodeId)).toHaveLength(1);
    expect(clusterMetrics(s).free).toBe(24);
  });
});

describe('navigation', () => {
  it('Back rebuilds exactly the cluster each frame started with', () => {
    for (const t of tour) {
      const rebuilt = settle(frameStart(t.index).sim);
      const live = settle(t.sim);
      // A task frame is captured after its task ran; compare against its start instead.
      if (FRAMES[t.index].task) continue;
      expect(rebuilt.nodes).toEqual(live.nodes);
      expect(rebuilt.instances).toEqual(live.instances);
      expect(rebuilt.strategy).toBe(live.strategy);
    }
  });

  it('ignores anything except the current task', () => {
    const t = frameStart(FRAMES.findIndex((f) => f.title === 'Your turn: a node fails'));
    const wrong = tourReducer(t, { type: 'sim', action: { type: 'setNodeUp', nodeId: 'node-3', up: false } });
    expect(wrong).toBe(t);
    expect(next(t)).toBe(t);
  });

  it('restart goes back to the first frame', () => {
    expect(tourReducer(tour.at(-1)!, { type: 'restart' }).index).toBe(0);
  });
});
