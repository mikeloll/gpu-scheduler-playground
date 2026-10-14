import { describe, expect, it } from 'vitest';
import { initialState, reducer, step } from './engine';
import { clusterMetrics, modelStatus } from './selectors';
import { NODE_COUNT, type Action, type SimState } from './types';

function run(state: SimState, ...actions: Action[]): SimState {
  let s = state;
  for (const a of actions) s = settle(reducer(s, a));
  return s;
}

/** Tick until nothing changes. */
function settle(state: SimState): SimState {
  let s = state;
  for (let i = 0; i < 1000; i++) {
    const next = step(s);
    if (next === s) return s;
    s = next;
  }
  throw new Error('simulation did not settle');
}

const nodesUsed = (s: SimState) =>
  new Set(s.instances.filter((i) => i.nodeId).map((i) => i.nodeId)).size;

describe('placement', () => {
  it('binpack fills one node before moving to the next', () => {
    const s = run(initialState('binpack'), { type: 'deploy', name: 'a', gpus: 2, replicas: 4 });
    expect(nodesUsed(s)).toBe(1);
  });

  it('spread puts each instance on the emptiest node', () => {
    const s = run(initialState('spread'), { type: 'deploy', name: 'a', gpus: 2, replicas: 4 });
    expect(nodesUsed(s)).toBe(4);
  });

  it('changing strategy only affects new placements', () => {
    let s = run(initialState('binpack'), { type: 'deploy', name: 'a', gpus: 2, replicas: 4 });
    s = run(s, { type: 'setStrategy', strategy: 'spread' });
    expect(nodesUsed(s)).toBe(1);
  });
});

describe('node failure', () => {
  it('moves displaced instances to other nodes', () => {
    let s = run(initialState('binpack'), { type: 'deploy', name: 'a', gpus: 2, replicas: 4 });
    s = run(s, { type: 'setNodeUp', nodeId: 'node-1', up: false });
    expect(s.instances.every((i) => i.nodeId && i.nodeId !== 'node-1')).toBe(true);
  });

  it('leaves instances waiting when nothing fits, and places them when a node returns', () => {
    let s = initialState('binpack');
    for (let n = 2; n <= NODE_COUNT; n++) s = run(s, { type: 'setNodeUp', nodeId: `node-${n}`, up: false });
    s = run(s, { type: 'deploy', name: 'big', gpus: 8, replicas: 1 });
    s = run(s, { type: 'setNodeUp', nodeId: 'node-1', up: false });
    expect(clusterMetrics(s).waiting).toBe(1);
    s = run(s, { type: 'setNodeUp', nodeId: 'node-2', up: true });
    expect(s.instances[0].nodeId).toBe('node-2');
  });
});

describe('upgrade', () => {
  it('replaces every instance with the new version when there is room', () => {
    let s = run(initialState('binpack'), { type: 'deploy', name: 'a', gpus: 4, replicas: 3 });
    s = run(s, { type: 'upgrade', modelId: 'm1' });
    expect(s.instances).toHaveLength(3);
    expect(s.instances.every((i) => i.version === 2 && i.nodeId)).toBe(true);
  });

  it('stalls on a fragmented cluster even though plenty of GPUs are free', () => {
    let s = run(initialState('spread'), { type: 'deploy', name: 'big', gpus: 4, replicas: 1 });
    s = run(s, { type: 'deploy', name: 'small', gpus: 1, replicas: NODE_COUNT * 5 - 4 });
    expect(clusterMetrics(s).free).toBe(NODE_COUNT * 3);
    expect(clusterMetrics(s).largestFit).toBe(3);

    s = run(s, { type: 'upgrade', modelId: 'm1' });
    const big = s.models[0];
    const status = modelStatus(s, big);
    expect(status.kind).toBe('stuck');
    // The old instance keeps serving while the new one waits.
    expect(s.instances.filter((i) => i.modelId === 'm1' && i.nodeId)).toHaveLength(1);
  });
});

describe('scaling', () => {
  it('scales down by removing instances', () => {
    let s = run(initialState(), { type: 'deploy', name: 'a', gpus: 1, replicas: 5 });
    s = run(s, { type: 'setReplicas', modelId: 'm1', replicas: 2 });
    expect(s.instances).toHaveLength(2);
  });
});
