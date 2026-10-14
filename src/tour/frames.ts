import { initialState, reducer, settle } from '../sim/engine';
import type { Action, SimState } from '../sim/types';

/**
 * The guided tour, one entry per frame. Wording comes from docs/guided-tour-script.md.
 *
 * Text supports **bold** and *italic*. A paragraph starting with "- " is a bullet.
 *
 * Highlight keys (what the frame points at):
 *   cluster · waiting · strategy · node:<id> · metric:<used|free|largestFit|waiting|blast>
 *   instances:<model name> · model:<model name>
 *
 * Task targets (the one control left unlocked):
 *   node-toggle:<id> · strategy:<binpack|spread> · upgrade:<model name>
 */
export interface Task {
  target: string;
  /** The action the target performs. Also used to replay the tour when going Back. */
  action: (s: SimState) => Action;
  done: (s: SimState) => boolean;
  /** Actions the app runs once the task is done; the tour moves on after they settle. */
  then?: Action[];
  /** Shown while `then` is running. */
  busyText?: string;
}

export interface Frame {
  part: string;
  title: string;
  text: string[];
  /** Replace the cluster when entering this frame (applied instantly). */
  setup?: () => SimState;
  /** Run when entering this frame; the user watches them play out. */
  actions?: Action[];
  highlight?: string[];
  /** Hands-on frame: no Next button; the tour advances once the task is done. */
  task?: Task;
  /** Last frame: offers Restart tour / Keep playing. */
  end?: boolean;
}

const deploy = (name: string, gpus: number, replicas: number): Action => ({
  type: 'deploy',
  name,
  gpus,
  replicas,
});

const modelByName = (s: SimState, name: string) => s.models.find((m) => m.name === name);

/** Deployed in Frame 2. */
const FIRST_MODEL: Action[] = [deploy('chat-medium', 4, 2)];

/** Deployed in Frame 3. */
const MORE_MODELS: Action[] = [
  deploy('code-assist', 2, 1),
  deploy('vision', 2, 1),
  deploy('summarizer', 2, 1),
  deploy('embeddings', 1, 2),
  deploy('reranker', 1, 2),
];

/** Frame 12: every node 5/8 full under spread — 24 GPUs free, but at most 3 on any node. */
function busyCluster(): SimState {
  let s = initialState('spread');
  for (const a of [
    deploy('chat-medium', 4, 2),
    deploy('embeddings', 1, 12),
    deploy('reranker', 1, 10),
    deploy('classifier', 1, 10),
  ]) {
    s = reducer(s, a);
  }
  return { ...settle(s), log: [] };
}

export const FRAMES: Frame[] = [
  // ---------- Part 1 ----------
  {
    part: 'The cluster',
    title: 'Welcome',
    setup: () => initialState('binpack'),
    highlight: ['cluster'],
    text: [
      "This is a GPU cluster: 8 machines, called **nodes**, each with 8 GPUs. That's 64 GPUs in total.",
      "AI models run on these GPUs. Over the next few minutes you'll see how models get placed onto nodes, what happens when a node fails, and why a deployment can get stuck even when plenty of GPUs look free.",
    ],
  },
  {
    part: 'The cluster',
    title: 'Models and instances',
    actions: FIRST_MODEL,
    highlight: ['instances:chat-medium'],
    text: [
      'Every model needs a fixed number of GPUs, and they all have to be on the **same node**. chat-medium needs 4.',
      'We usually run more than one copy of a model so it can handle more traffic and survive problems. Each copy is called an **instance**. Here chat-medium has 2 instances, shown as two 4-GPU blocks.',
    ],
  },

  // ---------- Part 2 ----------
  {
    part: 'Binpack',
    title: 'Who decides where things go?',
    actions: MORE_MODELS,
    highlight: ['strategy'],
    text: [
      "When you deploy a model, something has to choose a node for each instance. That's the **scheduler**, and it follows a strategy.",
      'This cluster uses **binpack**: put each instance on the *fullest* node that still has room, like packing a suitcase before opening the next one. Watch where these models land.',
    ],
  },
  {
    part: 'Binpack',
    title: 'Efficient packing',
    highlight: ['node:node-4', 'node:node-5', 'node:node-6', 'node:node-7', 'node:node-8', 'metric:largestFit'],
    text: [
      'Binpack squeezed everything onto 3 nodes and left 5 completely empty.',
      "That's efficient. An empty node can take anything, even a model that needs all 8 GPUs. The largest model that fits right now is **8 GPUs**.",
    ],
  },

  // ---------- Part 3 ----------
  {
    part: 'Blast radius',
    title: 'Eggs in one basket',
    highlight: ['node:node-2', 'node:node-1', 'metric:blast'],
    text: [
      "Packing tightly has a cost. node-2 is running **4 different models**. Three of them (code-assist, vision, summarizer) have only one instance, and it's on node-2.",
      'Also look at node-1: *both* chat-medium instances are there. The two copies are meant to back each other up, but they share one machine.',
      "The number of models degraded or taken offline when a single node fails is that node's **blast radius**.",
    ],
  },
  {
    part: 'Blast radius',
    title: 'Your turn: a node fails',
    text: ["Let's see it happen. Click **Take down** on node-2 to simulate a crash."],
    task: {
      target: 'node-toggle:node-2',
      action: () => ({ type: 'setNodeUp', nodeId: 'node-2', up: false }),
      done: (s) => !s.nodes.find((n) => n.id === 'node-2')!.up,
    },
  },
  {
    part: 'Blast radius',
    title: 'The damage',
    highlight: ['waiting', 'node:node-3'],
    text: [
      'One failure hit 4 models at once. code-assist, vision and summarizer were **completely offline** until the scheduler found them a new node.',
      'They recovered quickly because there was room elsewhere. On a fuller cluster they could have been stuck waiting.',
      'Notice where they went: binpack packed them onto node-3, which now runs 4 models. The basket got rebuilt.',
    ],
  },

  // ---------- Part 4 ----------
  {
    part: 'Spread',
    title: 'Your turn: try spread',
    setup: () => initialState('binpack'),
    text: [
      "Now let's deploy exactly the same models with a different strategy.",
      '**Spread** puts each instance on the *emptiest* node, spreading the work around. Switch the strategy to **Spread**.',
    ],
    task: {
      target: 'strategy:spread',
      action: () => ({ type: 'setStrategy', strategy: 'spread' }),
      done: (s) => s.strategy === 'spread',
      then: [...FIRST_MODEL, ...MORE_MODELS],
      busyText: 'Deploying the same models with spread…',
    },
  },
  {
    part: 'Spread',
    title: 'A smaller blast radius',
    highlight: ['metric:blast'],
    text: [
      'Same models, very different picture. Every node is lightly loaded, and no node runs more than **2 models**.',
      "The two chat-medium instances are now on different nodes, so a single node failure can't take chat-medium fully offline. A failure still degrades whatever was on that node, but far fewer models at once.",
    ],
  },

  // ---------- Part 5 ----------
  {
    part: 'Fragmentation',
    title: 'The catch',
    actions: [deploy('chat-large', 8, 1)],
    highlight: ['instances:chat-large', 'metric:free', 'metric:largestFit'],
    text: [
      "Now let's deploy **chat-large**, which needs a whole node: 8 GPUs.",
      "It can't be placed. There are **46 free GPUs**, but every node has something on it, so no single node has 8 free.",
    ],
  },
  {
    part: 'Fragmentation',
    title: 'Fragmentation',
    highlight: ['instances:chat-large'],
    text: [
      'This is **fragmentation**: plenty of free capacity in total, but broken into pieces too small to use.',
      'Under binpack, chat-large would have landed on one of the 5 empty nodes. Spread lowered the blast radius but left no room for a big model.',
    ],
  },

  // ---------- Part 6 ----------
  {
    part: 'The stalled upgrade',
    title: 'A busier cluster',
    setup: busyCluster,
    highlight: ['metric:free', 'metric:largestFit'],
    text: [
      'Fast-forward a few weeks. The cluster is busier, still placed with spread. Every node has 3 GPUs free: **24 free GPUs** in total.',
      "Everything is running fine. Now it's time to ship a new version of chat-medium.",
    ],
  },
  {
    part: 'The stalled upgrade',
    title: 'Your turn: upgrade',
    text: [
      'To upgrade without downtime, the new version (**v2**) starts first. The old version (**v1**) is only removed once v2 is running, so the model keeps serving the whole time.',
      'Click **Upgrade** on chat-medium.',
    ],
    task: {
      target: 'upgrade:chat-medium',
      action: (s) => ({ type: 'upgrade', modelId: modelByName(s, 'chat-medium')!.id }),
      done: (s) => (modelByName(s, 'chat-medium')?.version ?? 1) >= 2,
    },
  },
  {
    part: 'The stalled upgrade',
    title: 'Stuck',
    highlight: ['waiting', 'model:chat-medium'],
    text: [
      'The upgrade is **stuck**. v2 needs 4 GPUs on one node, and while 24 GPUs are free, no node has more than 3.',
      'And because v1 is only removed *after* v2 is running, v1 never gives up its 4 GPUs. Nothing changes until something else frees up space. This is a common reason model deployments stall.',
    ],
  },
  {
    part: 'Wrap-up',
    title: 'What to remember',
    end: true,
    text: [
      '- **Binpack** packs models tightly and leaves whole nodes free, but one node failure can hit many models at once.',
      '- **Spread** limits how many models one failure degrades, but scatters free GPUs into pieces too small for big models.',
      '- **Fragmentation** means "free GPUs" isn\'t the same as "room for my model". What matters is the most free on a *single* node.',
      '- **Upgrades** need room for the new version *before* the old one leaves, so a fragmented cluster can stall them.',
      'Choose **Keep playing with this cluster** to try it yourself. Can you get it unstuck? Or use the **Reset** button to reset the cluster and start fresh.',
    ],
  },
];
