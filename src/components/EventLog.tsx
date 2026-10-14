import type { LogEntry } from '../sim/types';

export function EventLog({ log, onClear }: { log: LogEntry[]; onClear: () => void }) {
  return (
    <section className="panel" aria-label="What happened">
      <div className="panel-head">
        <h2>What happened</h2>
        <button className="btn small ghost" onClick={onClear} disabled={log.length === 0}>
          Clear
        </button>
      </div>
      {log.length === 0 ? (
        <p className="empty">Events will show up here.</p>
      ) : (
        <ol className="log">
          {log.map((e) => (
            <li key={e.id}>{e.text}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
