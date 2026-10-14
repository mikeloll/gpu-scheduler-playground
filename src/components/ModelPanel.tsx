import { useState } from 'react';
import { modelStatus } from '../sim/selectors';
import { GPUS_PER_NODE, type Action, type Model, type SimState } from '../sim/types';
import { modelColor } from '../colors';

const PRESETS = [
  { name: 'chat-large', gpus: 8 },
  { name: 'chat-medium', gpus: 4 },
  { name: 'code-assist', gpus: 2 },
  { name: 'vision', gpus: 2 },
  { name: 'embeddings', gpus: 1 },
  { name: 'reranker', gpus: 1 },
];

interface Props {
  state: SimState;
  dispatch: (a: Action) => void;
}

export function ModelPanel({ state, dispatch }: Props) {
  return (
    <section className="panel" aria-label="Models">
      <div className="section-head">
        <h2>Models</h2>
        <span className="hint">Pick a predefined model or create your own.</span>
      </div>
      <DeployForm dispatch={dispatch} />
      {state.models.length === 0 ? (
        <p className="empty">No models yet. Deploy one above.</p>
      ) : (
        <ul className="model-list">
          {state.models.map((m) => (
            <ModelItem key={m.id} model={m} state={state} dispatch={dispatch} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DeployForm({ dispatch }: { dispatch: Props['dispatch'] }) {
  const [name, setName] = useState('');
  const [gpus, setGpus] = useState(2);
  const [replicas, setReplicas] = useState(2);

  return (
    <form
      className="deploy"
      onSubmit={(e) => {
        e.preventDefault();
        dispatch({ type: 'deploy', name, gpus, replicas });
        setName('');
      }}
    >
      <div className="presets">
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p.name}
            className="chip"
            onClick={() => {
              setName(p.name);
              setGpus(p.gpus);
            }}
          >
            {p.name} · {p.gpus}
          </button>
        ))}
      </div>
      <div className="deploy-row">
        <label className="field grow">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-model" />
        </label>
        <label className="field">
          <span>GPUs each</span>
          <select value={gpus} onChange={(e) => setGpus(Number(e.target.value))}>
            {Array.from({ length: GPUS_PER_NODE }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Instances</span>
          <input
            type="number"
            min={1}
            max={48}
            value={replicas}
            onChange={(e) => setReplicas(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <button type="submit" className="btn primary">
          Deploy
        </button>
      </div>
    </form>
  );
}

function ModelItem({ model, state, dispatch }: { model: Model } & Props) {
  const mine = state.instances.filter((i) => i.modelId === model.id);
  const running = mine.filter((i) => i.nodeId !== null);
  const current = running.filter((i) => i.version === model.version).length;
  const status = modelStatus(state, model);

  let statusText: string;
  switch (status.kind) {
    case 'running':
      statusText = `Running ${running.length}/${model.replicas}`;
      break;
    case 'placing':
      statusText = `Placing — ${running.length}/${model.replicas} running`;
      break;
    case 'upgrading':
      statusText = `Upgrading to v${model.version} — ${current}/${model.replicas} done`;
      break;
    case 'stuck':
      statusText = status.upgrading
        ? `Upgrade stalled — ${current}/${model.replicas} on v${model.version}`
        : `Can't place — ${running.length}/${model.replicas} running`;
      break;
  }

  return (
    <li className={`model ${status.kind}`} aria-label={model.name}>
      <div className="model-top">
        <span className="swatch" style={{ background: modelColor(model.color) }} />
        <span className="model-name">{model.name}</span>
        <span className="model-meta">
          {model.gpus} GPU{model.gpus === 1 ? '' : 's'} × {model.replicas} · v{model.version}
        </span>
      </div>
      <div className={`model-status ${status.kind}`}>{statusText}</div>
      {status.kind === 'stuck' && <p className="model-reason">{status.reason}</p>}
      <div className="model-actions">
        <div className="stepper" aria-label="Instances">
          <button
            className="btn small"
            onClick={() => dispatch({ type: 'setReplicas', modelId: model.id, replicas: model.replicas - 1 })}
            disabled={model.replicas <= 0}
            aria-label="Remove one instance"
          >
            −
          </button>
          <span>{model.replicas}</span>
          <button
            className="btn small"
            onClick={() => dispatch({ type: 'setReplicas', modelId: model.id, replicas: model.replicas + 1 })}
            aria-label="Add one instance"
          >
            +
          </button>
        </div>
        <button
          className="btn small"
          onClick={() => dispatch({ type: 'upgrade', modelId: model.id })}
          disabled={status.kind === 'upgrading' || (status.kind === 'stuck' && status.upgrading)}
        >
          Upgrade
        </button>
        <button className="btn small ghost" onClick={() => dispatch({ type: 'delete', modelId: model.id })}>
          Delete
        </button>
      </div>
    </li>
  );
}
