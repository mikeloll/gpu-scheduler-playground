# GPU Scheduler Playground

A browser-based visual explainer for how models get placed on a GPU cluster, and why deployments stall.

**Live site:** https://mikeloll.github.io/gpu-scheduler-playground/

You get an 8-node cluster (8 GPUs per node) with a few models already running. You can deploy models, scale them, upgrade them, take nodes down and bring them back, and switch between two placement strategies. It covers:

- **Binpack vs spread:** binpack puts each instance on the fullest node that still has room; spread puts it on the emptiest node.
- **Blast radius:** binpack uses GPUs efficiently but puts more models on each node, so losing one node hurts more.
- **Fragmentation:** spread limits blast radius but scatters free GPUs, so a large model may not fit anywhere even when plenty of GPUs are free.
- **Stalled upgrades:** an upgrade starts the new instance *before* retiring the old one. On a fragmented cluster the new instance has nowhere to go, so the upgrade sits stuck.

The app uses plain terms (models, instances, nodes, GPUs) on purpose. It isn't tied to any particular orchestration platform.

## Running locally

Requires Node.js 22 or newer.

```bash
npm install
npm run dev        # dev server with hot reload; open the URL it prints
```

To check the production build, which is what GitHub Pages serves:

```bash
npm run build
npm run preview
```

## Testing

There are two test suites:

```bash
npm test           # engine unit tests (Vitest), runs in under a second
npm run test:e2e   # browser tests (Playwright) against the production build
```

The first time you run the browser tests, install the browser:

```bash
npx playwright install chromium
```

`npm run test:e2e` builds the app and starts a preview server on port 4173 by itself. If a test fails, Playwright keeps a trace in `test-results/`; open it with `npx playwright show-trace <path-to-trace.zip>`.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`. It runs both test suites, builds the app and publishes `dist/` to GitHub Pages. If either suite fails, nothing is published.

The repo's Pages source must be set to **GitHub Actions** (Settings → Pages). The site lives under `/gpu-scheduler-playground/`; that base path is set in `vite.config.ts` and needs to change if the repo is renamed.

## How the code is organized

The simulation and the UI are kept separate. The engine is plain TypeScript with no React in it. It takes the current state and an action and returns the new state. The UI just renders that state and sends actions.

```
src/
  sim/                  Simulation engine (no UI code)
    types.ts            Cluster shape (node count, GPUs per node), state, and the list of actions
    engine.ts           Reducer, placement strategies, step-by-step simulation, starter models
    selectors.ts        Derived values: metrics, blast radius, model status, "why can't this fit?"
    engine.test.ts      Unit tests for the engine
  components/
    Toolbar.tsx         Strategy toggle, play/pause/step, speed slider, reset
    Metrics.tsx         The metric tiles across the top
    Cluster.tsx         Node rows, instance blocks, and the "Waiting for a node" area
    ModelPanel.tsx      Deploy form and model list (stuck models sort to the top)
    EventLog.tsx        The "What happened" pane
  App.tsx               Wires state to components and runs the simulation timer
  styles.css            All styling, with light and dark themes
e2e/                    Playwright browser tests and helpers
docs/guided-lessons.md  Outline for the planned guided demo mode
```

### Key places to look

- **Placement:** `chooseNode` in `src/sim/engine.ts`. This is where binpack and spread differ: binpack picks the fullest node with room, spread picks the emptiest. Ties go to the lowest-numbered node.
- **Simulation steps:** `step` in `src/sim/engine.ts`. Each tick makes one visible change, so viewers can follow along:
  1. Place the first waiting instance that fits somewhere.
  2. Otherwise, move an upgrade forward one step: start a new-version instance, or retire an old one once the new one is running.

  If nothing can happen, `step` returns the same state and React skips the render.
- **Upgrade ordering:** also in `step`. An old instance is only retired after its replacement is running. That's why a fragmented cluster stalls upgrades.
- **Node failure:** the `setNodeUp` case in the reducer. Instances on a downed node go back to waiting, and `step` re-places them.
- **Starting cluster:** `STARTER_MODELS` and `starterState` in `src/sim/engine.ts`. These are the models shown on load and on Reset.
- **Cluster size:** `NODE_COUNT` and `GPUS_PER_NODE` in `src/sim/types.ts`.
- **Stuck explanations:** `explainNoFit` in `src/sim/selectors.ts` produces the plain-language reason shown under a stuck model.
- **Animation:** instance blocks are Motion elements keyed by instance id (`layoutId`). When an instance moves between a node and the waiting area, Motion animates the move. The speed slider maps to the step interval in `App.tsx`, and animation length scales with it.

### Adding a feature

1. If it changes cluster behavior, add an action to `Action` in `types.ts` and handle it in `reducer` in `engine.ts`.
2. Add a unit test in `engine.test.ts`.
3. Wire it up in a component by calling `dispatch`.
4. Add a browser test in `e2e/playground.spec.ts`. The tests select elements by accessible role and label (for example, `getByRole('group', { name: 'node-1' })`), so keep those labels when changing markup.
