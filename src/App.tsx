import { useEffect, useReducer, useState } from 'react';
import { LayoutGroup, MotionConfig } from 'motion/react';
import { initialState, reducer } from './sim/engine';
import { Toolbar } from './components/Toolbar';
import { Metrics } from './components/Metrics';
import { Cluster } from './components/Cluster';
import { ModelPanel } from './components/ModelPanel';
import { EventLog } from './components/EventLog';

/** Speed slider 0-100 → milliseconds between simulation steps: 10s (slowest) to 0.2s (fastest). */
const tickInterval = (speed: number) => Math.round(10000 * Math.pow(0.02, speed / 100));

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState('binpack'));
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(50); // midpoint: ~1.4s per step
  const interval = tickInterval(speed);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => dispatch({ type: 'tick' }), interval);
    return () => clearInterval(id);
  }, [playing, interval]);

  // Animations stay shorter than a step so movement never piles up.
  const duration = Math.min(0.45, (interval / 1000) * 0.6);

  return (
    <MotionConfig transition={{ duration, ease: 'easeInOut' }}>
      <div className="app">
        <header className="app-header">
          <h1>GPU Scheduler Playground</h1>
          <p className="subtitle">
            Deploy models onto a {state.nodes.length}-node cluster and watch where they land.
          </p>
          <Toolbar
            strategy={state.strategy}
            playing={playing}
            speed={speed}
            onStrategy={(strategy) => dispatch({ type: 'setStrategy', strategy })}
            onPlayPause={() => setPlaying((p) => !p)}
            onStep={() => dispatch({ type: 'tick' })}
            onSpeed={setSpeed}
            onReset={() => dispatch({ type: 'reset' })}
          />
        </header>

        <Metrics state={state} />

        <main className="layout">
          <aside className="sidebar">
            <ModelPanel state={state} dispatch={dispatch} />
            <EventLog log={state.log} onClear={() => dispatch({ type: 'clearLog' })} />
          </aside>
          <LayoutGroup>
            <Cluster state={state} dispatch={dispatch} />
          </LayoutGroup>
        </main>
      </div>
    </MotionConfig>
  );
}
