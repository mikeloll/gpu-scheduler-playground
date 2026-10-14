import { AnimatePresence, motion } from 'motion/react';
import { chooseNode, usedGpus } from '../sim/engine';
import { GPUS_PER_NODE, type Action, type ClusterNode, type Instance, type SimState } from '../sim/types';
import { modelColor } from '../colors';

interface Props {
  state: SimState;
  dispatch: (a: Action) => void;
}

export function Cluster({ state, dispatch }: Props) {
  const waiting = state.instances.filter((i) => i.nodeId === null);
  return (
    <section className="cluster" aria-label="Cluster">
      <div className="section-head">
        <h2>Cluster</h2>
        <span className="hint">Each node has {GPUS_PER_NODE} GPUs. Each block is one model instance.</span>
      </div>
      <div className="nodes">
        {state.nodes.map((node) => (
          <NodeRow key={node.id} node={node} state={state} dispatch={dispatch} />
        ))}
      </div>

      <div className="waiting" role="region" aria-label="Waiting for a node">
        <div className="section-head">
          <h3>Waiting for a node</h3>
          <span className="hint">
            {waiting.length === 0
              ? 'Nothing waiting.'
              : 'Instances here are not running. They need a node with enough free GPUs.'}
          </span>
        </div>
        <div className="waiting-tray">
          <AnimatePresence>
            {waiting.map((inst) => (
              <InstanceBlock
                key={inst.id}
                inst={inst}
                state={state}
                stuck={!chooseNode(state, inst.gpus)}
                inTray
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function NodeRow({ node, state, dispatch }: { node: ClusterNode } & Props) {
  const here = state.instances.filter((i) => i.nodeId === node.id);
  const used = usedGpus(state, node.id);
  return (
    <div className={`node ${node.up ? '' : 'down'}`} role="group" aria-label={node.name}>
      <div className="node-head">
        <span className="node-name">{node.name}</span>
        <span className="node-usage">{node.up ? `${used}/${GPUS_PER_NODE} GPUs used` : 'Down'}</span>
      </div>

      <div className="slots">
        <AnimatePresence>
          {here.map((inst) => (
            <InstanceBlock key={inst.id} inst={inst} state={state} />
          ))}
        </AnimatePresence>
        {Array.from({ length: GPUS_PER_NODE - used }, (_, i) => (
          <div key={`free-${i}`} className="slot-free" />
        ))}
      </div>

      <div className="node-side">
        <button
          className={`btn small ${node.up ? 'danger' : ''}`}
          onClick={() => dispatch({ type: 'setNodeUp', nodeId: node.id, up: !node.up })}
        >
          {node.up ? 'Take down' : 'Bring up'}
        </button>
      </div>
    </div>
  );
}

function InstanceBlock({
  inst,
  state,
  stuck = false,
  inTray = false,
}: {
  inst: Instance;
  state: SimState;
  stuck?: boolean;
  inTray?: boolean;
}) {
  const model = state.models.find((m) => m.id === inst.modelId);
  if (!model) return null;
  const outdated = inst.version < model.version;
  const label = `${model.name} v${inst.version} · ${inst.gpus} GPU${inst.gpus === 1 ? '' : 's'}${
    outdated ? ' (old version, will be replaced)' : ''
  }${stuck ? ' — no node has room' : ''}`;
  return (
    <motion.div
      layoutId={inst.id}
      className={`instance ${outdated ? 'outdated' : ''} ${stuck ? 'stuck' : ''}`}
      style={{
        background: modelColor(model.color),
        ...(inTray
          ? { width: `calc(${inst.gpus} * var(--cell) + ${inst.gpus - 1} * var(--gap))` }
          : { gridColumn: `span ${inst.gpus}` }),
      }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      title={label}
    >
      <span className="instance-name">{model.name}</span>
      <span className="instance-version">v{inst.version}</span>
    </motion.div>
  );
}
