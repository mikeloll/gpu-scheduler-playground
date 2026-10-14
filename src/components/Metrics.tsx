import { clusterMetrics } from '../sim/selectors';
import type { SimState } from '../sim/types';

export function Metrics({ state }: { state: SimState }) {
  const m = clusterMetrics(state);
  const pct = m.capacity ? Math.round((m.used / m.capacity) * 100) : 0;
  return (
    <section className="metrics" aria-label="Cluster metrics">
      <Tile label="GPUs in use" value={`${m.used} / ${m.capacity}`} note={`${pct}% of GPUs on running nodes`}>
        <div className="meter">
          <div className="meter-fill" style={{ width: `${pct}%` }} />
        </div>
      </Tile>
      <Tile label="Free GPUs" value={m.free} note="Total across all running nodes" />
      <Tile
        label="Largest model that fits now"
        value={`${m.largestFit} GPU${m.largestFit === 1 ? '' : 's'}`}
        note="Most free GPUs on any single node"
        warn={m.free > m.largestFit && m.largestFit < 8}
      />
      <Tile
        label="Waiting instances"
        value={m.waiting}
        note="Instances with no node to run on"
        warn={m.waiting > 0}
      />
      <Tile
        label="Biggest blast radius"
        value={m.worstBlast ? `${m.worstBlast.models} model${m.worstBlast.models === 1 ? '' : 's'}` : '—'}
        note={m.worstBlast ? `Hit if ${m.worstBlast.nodeName} goes down` : 'No models running'}
      />
    </section>
  );
}

function Tile(props: {
  label: string;
  value: string | number;
  note: string;
  warn?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`tile ${props.warn ? 'warn' : ''}`}>
      <div className="tile-label">{props.label}</div>
      <div className="tile-value">{props.value}</div>
      {props.children}
      <div className="tile-note">{props.note}</div>
    </div>
  );
}
