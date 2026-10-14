import type { LogEntry } from '../sim/types';

export function EventLog({ log }: { log: LogEntry[] }) {
  return (
    <section className="panel" aria-label="What happened">
      <h2>What happened</h2>
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
