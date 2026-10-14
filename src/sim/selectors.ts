import { chooseNode, freeGpus, isUpgrading } from './engine';
import { GPUS_PER_NODE, type Model, type SimState } from './types';

export interface ClusterMetrics {
  capacity: number; // GPUs on nodes that are up
  used: number;
  free: number;
  largestFit: number; // biggest instance (in GPUs) that could be placed right now
  waiting: number; // instances waiting for a home
  worstBlast: { nodeName: string; models: number } | null;
}

export function clusterMetrics(state: SimState): ClusterMetrics {
  const up = state.nodes.filter((n) => n.up);
  const capacity = up.length * GPUS_PER_NODE;
  const free = up.reduce((sum, n) => sum + freeGpus(state, n.id), 0);
  const largestFit = up.reduce((max, n) => Math.max(max, freeGpus(state, n.id)), 0);
  let worstBlast: ClusterMetrics['worstBlast'] = null;
  for (const n of up) {
    const models = blastRadius(state, n.id).models;
    if (models > 0 && (!worstBlast || models > worstBlast.models)) {
      worstBlast = { nodeName: n.name, models };
    }
  }
  return {
    capacity,
    used: capacity - free,
    free,
    largestFit,
    waiting: state.instances.filter((i) => i.nodeId === null).length,
    worstBlast,
  };
}

/** What would be hit if this node failed right now. */
export function blastRadius(state: SimState, nodeId: string) {
  const here = state.instances.filter((i) => i.nodeId === nodeId);
  return { instances: here.length, models: new Set(here.map((i) => i.modelId)).size };
}

export type ModelStatus =
  | { kind: 'running' }
  | { kind: 'placing' }
  | { kind: 'upgrading' }
  | { kind: 'stuck'; upgrading: boolean; reason: string };

export function modelStatus(state: SimState, model: Model): ModelStatus {
  const upgrading = isUpgrading(state, model.id);
  const waiting = state.instances.filter((i) => i.modelId === model.id && i.nodeId === null);
  if (waiting.length > 0 && !chooseNode(state, model.gpus)) {
    return { kind: 'stuck', upgrading, reason: explainNoFit(state, model.gpus) };
  }
  if (upgrading) return { kind: 'upgrading' };
  if (waiting.length > 0) return { kind: 'placing' };
  return { kind: 'running' };
}

/** Plain-language reason an instance of `gpus` GPUs can't be placed. */
export function explainNoFit(state: SimState, gpus: number): string {
  const m = clusterMetrics(state);
  if (m.free >= gpus) {
    return `Needs ${gpus} GPUs on one node. ${m.free} GPUs are free across the cluster, but the most free on any single node is ${m.largestFit}. The free GPUs are fragmented.`;
  }
  return `Needs ${gpus} GPUs on one node, but only ${m.free} GPU${m.free === 1 ? ' is' : 's are'} free in the whole cluster.`;
}
