import type { Strategy } from '../sim/types';

const STRATEGY_HELP: Record<Strategy, string> = {
  binpack: 'Binpack: put each instance on the fullest node that still has room.',
  spread: 'Spread: put each instance on the emptiest node.',
};

interface Props {
  strategy: Strategy;
  playing: boolean;
  speed: number;
  onStrategy: (s: Strategy) => void;
  onPlayPause: () => void;
  onStep: () => void;
  onSpeed: (v: number) => void;
  onReset: () => void;
}

export function Toolbar(p: Props) {
  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <div className="segmented" role="radiogroup" aria-label="Placement strategy">
          {(['binpack', 'spread'] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={p.strategy === s}
              className={p.strategy === s ? 'active' : ''}
              onClick={() => p.onStrategy(s)}
            >
              {s === 'binpack' ? 'Binpack' : 'Spread'}
            </button>
          ))}
        </div>
        <span className="strategy-help">{STRATEGY_HELP[p.strategy]}</span>
      </div>

      <div className="toolbar-group controls">
        <button className="icon-btn" onClick={p.onPlayPause} title={p.playing ? 'Pause' : 'Play'}>
          {p.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="btn" onClick={p.onStep} disabled={p.playing} title="Advance one step">
          Step
        </button>
        <label className="speed" title="Simulation speed">
          <SpeedIcon />
          <input
            type="range"
            min={0}
            max={100}
            value={p.speed}
            onChange={(e) => p.onSpeed(Number(e.target.value))}
            aria-label="Simulation speed"
            style={{ '--fill': `${p.speed}%` } as React.CSSProperties}
          />
        </label>
        <button className="btn" onClick={p.onReset} title="Start over with the starting models">
          Reset
        </button>
      </div>
    </div>
  );
}

const PlayIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
    <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
    <rect x="3.5" y="2.5" width="3" height="11" rx="0.5" fill="currentColor" />
    <rect x="9.5" y="2.5" width="3" height="11" rx="0.5" fill="currentColor" />
  </svg>
);
const SpeedIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
    <path
      d="M8 3a6 6 0 0 0-6 6h1.5a4.5 4.5 0 0 1 9 0H14a6 6 0 0 0-6-6zm2.6 2.4L7.4 8.6a1 1 0 1 0 1.4 1.4l3.2-3.2z"
      fill="currentColor"
    />
  </svg>
);
