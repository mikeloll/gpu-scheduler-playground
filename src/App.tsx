import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { reducer, starterState } from './sim/engine';
import type { Action, SimState } from './sim/types';
import { Toolbar } from './components/Toolbar';
import { Metrics } from './components/Metrics';
import { Cluster } from './components/Cluster';
import { ModelPanel } from './components/ModelPanel';
import { EventLog } from './components/EventLog';
import { FRAMES } from './tour/frames';
import { activeTarget, startTour, tourReducer } from './tour/tour';
import { TourPanel } from './tour/TourPanel';
import { TourUiContext, type TourUi } from './tour/TourContext';

type Mode = 'playground' | 'tour';

/** Speed slider 0-100 → milliseconds between simulation steps: 10s (slowest) to 0.2s (fastest). */
const tickInterval = (speed: number) => Math.round(10000 * Math.pow(0.02, speed / 100));

/** The playground also accepts a whole cluster, handed over from the end of the tour. */
function playgroundReducer(state: SimState, action: Action | { type: 'load'; state: SimState }) {
  return action.type === 'load' ? action.state : reducer(state, action);
}

/** Index of the most recent frame (at or before `index`) that set up a fresh cluster. */
function sceneStart(index: number) {
  for (let i = index; i > 0; i--) if (FRAMES[i].setup) return i;
  return 0;
}

const PLAYGROUND_UI: TourUi = { active: false, highlights: new Set(), target: null };

export default function App() {
  const [mode, setMode] = useState<Mode>('playground');
  const [playground, playgroundDispatch] = useReducer(playgroundReducer, undefined, () => starterState('binpack'));
  const [tour, tourDispatch] = useReducer(tourReducer, undefined, startTour);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(50); // midpoint: ~1.4s per step
  const interval = tickInterval(speed);

  const inTour = mode === 'tour';
  const state = inTour ? tour.sim : playground;
  const dispatch = useCallback(
    (action: Action) => (inTour ? tourDispatch({ type: 'sim', action }) : playgroundDispatch(action)),
    [inTour],
  );

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), interval);
    return () => clearInterval(id);
  }, [playing, interval, dispatch]);

  const tourUi = useMemo<TourUi>(
    () =>
      inTour
        ? { active: true, highlights: new Set(FRAMES[tour.index].highlight), target: activeTarget(tour) }
        : PLAYGROUND_UI,
    [inTour, tour],
  );

  /** Leaving the tour (tab or "Keep playing") carries its cluster into the playground. */
  const keepPlaying = () => {
    playgroundDispatch({ type: 'load', state: { ...tour.sim, log: [] } });
    setMode('playground');
  };
  const selectMode = (m: Mode) => {
    if (m === mode) return;
    if (m === 'playground') keepPlaying();
    else setMode(m);
  };

  // A frame that swaps in a new cluster starts a new scene; remounting avoids blocks morphing
  // into unrelated new ones that happen to share an id.
  const scene = inTour ? `tour-${sceneStart(tour.index)}` : 'playground';

  // Animations stay shorter than a step so movement never piles up.
  const duration = Math.min(0.45, (interval / 1000) * 0.6);

  return (
    <MotionConfig transition={{ duration, ease: 'easeInOut' }}>
      <TourUiContext.Provider value={tourUi}>
        <div className="app">
          <header className="app-header">
            <h1>GPU Scheduler Playground</h1>
            <p className="subtitle">
              Deploy models onto a {state.nodes.length}-node cluster and watch where they land.
            </p>
            <nav className="mode-tabs" role="tablist" aria-label="Mode">
              {(
                [
                  ['playground', 'Playground'],
                  ['tour', 'Guided tour'],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  className={mode === m ? 'active' : ''}
                  onClick={() => selectMode(m)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <Toolbar
              strategy={state.strategy}
              playing={playing}
              speed={speed}
              onStrategy={(strategy) => dispatch({ type: 'setStrategy', strategy })}
              onPlayPause={() => setPlaying((p) => !p)}
              onStep={() => dispatch({ type: 'tick' })}
              onSpeed={setSpeed}
              onReset={inTour ? undefined : () => playgroundDispatch({ type: 'reset' })}
            />
          </header>

          <Metrics state={state} />

          <main className="layout">
            <aside className="sidebar">
              {inTour && <TourPanel tour={tour} dispatch={tourDispatch} onKeepPlaying={keepPlaying} />}
              <ModelPanel state={state} dispatch={dispatch} />
              {!inTour && (
                <EventLog log={state.log} onClear={() => playgroundDispatch({ type: 'clearLog' })} />
              )}
            </aside>
            <LayoutGroup id={scene}>
              <Cluster key={scene} state={state} dispatch={dispatch} />
            </LayoutGroup>
          </main>
        </div>
      </TourUiContext.Provider>
    </MotionConfig>
  );
}
