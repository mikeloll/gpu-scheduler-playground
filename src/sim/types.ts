export const GPUS_PER_NODE = 8;
export const NODE_COUNT = 6;

export type Strategy = 'binpack' | 'spread';

export interface ClusterNode {
  id: string;
  name: string;
  up: boolean;
}

export interface Model {
  id: string;
  name: string;
  gpus: number; // GPUs per instance, 1-8
  replicas: number; // desired number of instances
  version: number; // current target version
  color: number; // index into the color palette
}

export interface Instance {
  id: string;
  modelId: string;
  version: number;
  gpus: number;
  nodeId: string | null; // null = waiting to be placed
}

export interface LogEntry {
  id: number;
  tick: number;
  text: string;
}

export interface SimState {
  strategy: Strategy;
  nodes: ClusterNode[];
  models: Model[];
  instances: Instance[]; // creation order doubles as the waiting-line order
  nextId: number;
  tick: number;
  log: LogEntry[];
}

export type Action =
  | { type: 'deploy'; name: string; gpus: number; replicas: number }
  | { type: 'setReplicas'; modelId: string; replicas: number }
  | { type: 'upgrade'; modelId: string }
  | { type: 'delete'; modelId: string }
  | { type: 'setNodeUp'; nodeId: string; up: boolean }
  | { type: 'setStrategy'; strategy: Strategy }
  | { type: 'reset' }
  | { type: 'clearLog' }
  | { type: 'tick' };
