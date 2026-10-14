import {
  GPUS_PER_NODE,
  NODE_COUNT,
  type Action,
  type ClusterNode,
  type Instance,
  type SimState,
  type Strategy,
} from './types';

const MAX_LOG = 50;
const PALETTE_SIZE = 10;

export function initialState(strategy: Strategy = 'binpack'): SimState {
  const nodes: ClusterNode[] = Array.from({ length: NODE_COUNT }, (_, i) => ({
    id: `node-${i + 1}`,
    name: `node-${i + 1}`,
    up: true,
  }));
  return { strategy, nodes, models: [], instances: [], nextId: 1, tick: 0, log: [] };
}

/** Models already running when the app loads, so the cluster isn't empty. */
export const STARTER_MODELS = [
  { name: 'chat-medium', gpus: 4, replicas: 2 },
  { name: 'code-assist', gpus: 2, replicas: 2 },
  { name: 'embeddings', gpus: 1, replicas: 1 },
];

/** The cluster with the starter models already placed and no events logged. */
export function starterState(strategy: Strategy = 'binpack'): SimState {
  let s = initialState(strategy);
  for (const m of STARTER_MODELS) s = reducer(s, { type: 'deploy', ...m });
  for (let next = step(s); next !== s; next = step(s)) s = next;
  return { ...s, tick: 0, log: [] };
}

// ---------- queries ----------

export function usedGpus(state: SimState, nodeId: string): number {
  return state.instances
    .filter((i) => i.nodeId === nodeId)
    .reduce((sum, i) => sum + i.gpus, 0);
}

export function freeGpus(state: SimState, nodeId: string): number {
  const node = state.nodes.find((n) => n.id === nodeId);
  if (!node || !node.up) return 0;
  return GPUS_PER_NODE - usedGpus(state, nodeId);
}

/**
 * Pick a node for an instance needing `gpus` GPUs, or null if none fits.
 * binpack: the fullest node that still fits. spread: the emptiest node.
 * Ties go to the lowest-numbered node.
 */
export function chooseNode(state: SimState, gpus: number): ClusterNode | null {
  let best: ClusterNode | null = null;
  let bestFree = 0;
  for (const node of state.nodes) {
    const free = freeGpus(state, node.id);
    if (free < gpus) continue;
    const better =
      best === null ||
      (state.strategy === 'binpack' ? free < bestFree : free > bestFree);
    if (better) {
      best = node;
      bestFree = free;
    }
  }
  return best;
}

export function isUpgrading(state: SimState, modelId: string): boolean {
  const model = state.models.find((m) => m.id === modelId);
  if (!model) return false;
  return state.instances.some((i) => i.modelId === modelId && i.version < model.version);
}

// ---------- reducer ----------

export function reducer(state: SimState, action: Action): SimState {
  switch (action.type) {
    case 'deploy': {
      const name = action.name.trim() || `model-${state.nextId}`;
      const gpus = clamp(action.gpus, 1, GPUS_PER_NODE);
      const replicas = Math.max(1, action.replicas);
      const id = `m${state.nextId}`;
      let s: SimState = {
        ...state,
        nextId: state.nextId + 1,
        models: [
          ...state.models,
          { id, name, gpus, replicas, version: 1, color: nextColor(state) },
        ],
      };
      for (let r = 0; r < replicas; r++) s = addInstance(s, id, 1, gpus);
      return log(s, `Deployed ${name}: ${replicas} × ${gpus} GPU${gpus > 1 ? 's' : ''}`);
    }

    case 'setReplicas': {
      const model = state.models.find((m) => m.id === action.modelId);
      if (!model) return state;
      const replicas = Math.max(0, action.replicas);
      let s: SimState = {
        ...state,
        models: state.models.map((m) => (m.id === model.id ? { ...m, replicas } : m)),
      };
      const current = s.instances.filter((i) => i.modelId === model.id).length;
      if (replicas > current) {
        for (let r = current; r < replicas; r++) s = addInstance(s, model.id, model.version, model.gpus);
        return log(s, `Scaled ${model.name} up to ${replicas}`);
      }
      if (replicas < current) {
        s = removeExcess(s, model.id, current - replicas);
        return log(s, `Scaled ${model.name} down to ${replicas}`);
      }
      return s;
    }

    case 'upgrade': {
      const model = state.models.find((m) => m.id === action.modelId);
      if (!model) return state;
      const version = model.version + 1;
      const s = {
        ...state,
        models: state.models.map((m) => (m.id === model.id ? { ...m, version } : m)),
      };
      return log(s, `Upgrade started: ${model.name} v${model.version} → v${version}`);
    }

    case 'delete': {
      const model = state.models.find((m) => m.id === action.modelId);
      if (!model) return state;
      const s = {
        ...state,
        models: state.models.filter((m) => m.id !== model.id),
        instances: state.instances.filter((i) => i.modelId !== model.id),
      };
      return log(s, `Deleted ${model.name}`);
    }

    case 'setNodeUp': {
      const node = state.nodes.find((n) => n.id === action.nodeId);
      if (!node || node.up === action.up) return state;
      const nodes = state.nodes.map((n) => (n.id === node.id ? { ...n, up: action.up } : n));
      if (action.up) return log({ ...state, nodes }, `${node.name} is back up`);
      // Node down: everything on it goes back to waiting for a new home.
      const displaced = state.instances.filter((i) => i.nodeId === node.id);
      const instances = state.instances.map((i) =>
        i.nodeId === node.id ? { ...i, nodeId: null } : i,
      );
      const models = new Set(displaced.map((i) => i.modelId)).size;
      return log(
        { ...state, nodes, instances },
        displaced.length
          ? `${node.name} went down — ${displaced.length} instance${plural(displaced.length)} of ${models} model${plural(models)} need a new home`
          : `${node.name} went down (it was empty)`,
      );
    }

    case 'setStrategy': {
      if (state.strategy === action.strategy) return state;
      return log(
        { ...state, strategy: action.strategy },
        `Placement strategy is now ${action.strategy} (affects new placements only)`,
      );
    }

    case 'reset':
      return starterState(state.strategy);

    case 'clearLog':
      return { ...state, log: [] };

    case 'tick':
      return step(state);
  }
}

/**
 * Advance the simulation by one visible change:
 *  1. Place the first waiting instance that fits somewhere.
 *  2. Otherwise, move an in-progress upgrade forward by one step.
 * Returns the same object when nothing can happen, so React skips a render.
 */
export function step(state: SimState): SimState {
  for (const inst of state.instances) {
    if (inst.nodeId !== null) continue;
    const node = chooseNode(state, inst.gpus);
    if (!node) continue;
    const model = state.models.find((m) => m.id === inst.modelId)!;
    const s = {
      ...state,
      tick: state.tick + 1,
      instances: state.instances.map((i) => (i.id === inst.id ? { ...i, nodeId: node.id } : i)),
    };
    const why = state.strategy === 'binpack' ? 'fullest node with room' : 'emptiest node';
    return log(s, `Placed ${model.name} v${inst.version} on ${node.name} (${why})`);
  }

  // Upgrades: start the new instance first, retire an old one only once the new one is running.
  for (const model of state.models) {
    const mine = state.instances.filter((i) => i.modelId === model.id);
    const old = mine.filter((i) => i.version < model.version);
    if (old.length === 0) continue;
    const newWaiting = mine.some((i) => i.version === model.version && i.nodeId === null);

    if (mine.length > model.replicas) {
      if (newWaiting) continue; // stuck until the new instance finds a home
      const retire = old.find((i) => i.nodeId === null) ?? old[0];
      const s = {
        ...state,
        tick: state.tick + 1,
        instances: state.instances.filter((i) => i.id !== retire.id),
      };
      const remaining = old.length - 1;
      return log(
        s,
        remaining
          ? `Retired one ${model.name} v${retire.version} instance (${remaining} old left)`
          : `Retired last old ${model.name} instance — upgrade to v${model.version} complete`,
      );
    }

    const s = addInstance({ ...state, tick: state.tick + 1 }, model.id, model.version, model.gpus);
    return log(s, `Starting a new ${model.name} v${model.version} instance before retiring an old one`);
  }

  return state;
}

// ---------- helpers ----------

function addInstance(state: SimState, modelId: string, version: number, gpus: number): SimState {
  const inst: Instance = { id: `i${state.nextId}`, modelId, version, gpus, nodeId: null };
  return { ...state, nextId: state.nextId + 1, instances: [...state.instances, inst] };
}

/** Remove instances on scale-down: waiting ones first, then old versions, then newest. */
function removeExcess(state: SimState, modelId: string, count: number): SimState {
  const model = state.models.find((m) => m.id === modelId)!;
  const mine = state.instances.filter((i) => i.modelId === modelId);
  const rank = (i: Instance) => (i.nodeId === null ? 0 : i.version < model.version ? 1 : 2);
  const victims = new Set(
    mine
      .map((inst, order) => ({ inst, order }))
      .sort((a, b) => rank(a.inst) - rank(b.inst) || b.order - a.order)
      .slice(0, count)
      .map((x) => x.inst.id),
  );
  return { ...state, instances: state.instances.filter((i) => !victims.has(i.id)) };
}

function log(state: SimState, text: string): SimState {
  const entry = { id: state.nextId, tick: state.tick, text };
  return { ...state, nextId: state.nextId + 1, log: [entry, ...state.log].slice(0, MAX_LOG) };
}

/** First palette color not used by a current model, so colors stay distinct after deletes. */
function nextColor(state: SimState): number {
  const used = new Set(state.models.map((m) => m.color));
  for (let c = 0; c < PALETTE_SIZE; c++) if (!used.has(c)) return c;
  return state.models.length % PALETTE_SIZE;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function plural(n: number) {
  return n === 1 ? '' : 's';
}
