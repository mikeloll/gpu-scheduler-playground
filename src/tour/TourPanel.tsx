import { Fragment, type ReactNode } from 'react';
import { isSettled } from '../sim/engine';
import { FRAMES } from './frames';
import { activeTarget, canGoNext, type TourAction, type TourState } from './tour';

interface Props {
  tour: TourState;
  dispatch: (a: TourAction) => void;
  onKeepPlaying: () => void;
}

export function TourPanel({ tour, dispatch, onKeepPlaying }: Props) {
  const frame = FRAMES[tour.index];
  const waitingForUser = activeTarget(tour) !== null;
  const busy = !isSettled(tour.sim);
  const progress = ((tour.index + 1) / FRAMES.length) * 100;

  let status: string | null = null;
  if (waitingForUser) status = 'Your turn. Waiting for you…';
  else if (frame.task?.busyText) status = frame.task.busyText;
  else if (busy) status = 'Watch the cluster…';

  return (
    <section className="panel tour-panel" aria-label="Guided tour">
      <div className="tour-meta">
        <span>{frame.part}</span>
        <span>
          {tour.index + 1} of {FRAMES.length}
        </span>
      </div>
      <div className="tour-progress" aria-hidden>
        <div style={{ width: `${progress}%` }} />
      </div>

      <h2 className="tour-title">{frame.title}</h2>
      <div className="tour-text">{renderText(frame.text)}</div>

      {status && (
        <p className={`tour-status ${waitingForUser ? 'your-turn' : ''}`} role="status">
          {status}
        </p>
      )}

      {frame.end ? (
        <div className="tour-end">
          <button className="btn primary" onClick={onKeepPlaying}>
            Keep playing with this cluster
          </button>
          <div className="tour-nav">
            <BackButton tour={tour} dispatch={dispatch} />
            <button className="btn" onClick={() => dispatch({ type: 'restart' })}>
              Restart tour
            </button>
          </div>
        </div>
      ) : (
        <div className="tour-nav">
          <BackButton tour={tour} dispatch={dispatch} />
          {!frame.task && (
            <button
              className="btn primary"
              onClick={() => dispatch({ type: 'next' })}
              disabled={!canGoNext(tour)}
              title={busy ? 'Wait for the cluster to finish moving' : undefined}
            >
              Next
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function BackButton({ tour, dispatch }: Pick<Props, 'tour' | 'dispatch'>) {
  return (
    <button className="btn" onClick={() => dispatch({ type: 'back' })} disabled={tour.index === 0}>
      Back
    </button>
  );
}

/** Paragraphs, with runs of "- " lines grouped into a bullet list. */
function renderText(paragraphs: string[]): ReactNode[] {
  const out: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${out.length}`}>
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  for (const p of paragraphs) {
    if (p.startsWith('- ')) bullets.push(p.slice(2));
    else {
      flush();
      out.push(<p key={`p-${out.length}`}>{inline(p)}</p>);
    }
  }
  flush();
  return out;
}

/** **bold** and *italic*. */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.length > 1) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
