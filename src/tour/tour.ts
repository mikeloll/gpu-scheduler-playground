import { initialState, isSettled, reducer, settle } from '../sim/engine';
import type { Action, SimState } from '../sim/types';
import { FRAMES } from './frames';

export interface TourState {
  index: number;
  sim: SimState;
  taskDone: boolean;
}

export type TourAction =
  | { type: 'sim'; action: Action }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'restart' };

/** Enter frame `index`: apply its setup, then queue its actions for the user to watch. */
export function enterFrame(sim: SimState, index: number): TourState {
  const frame = FRAMES[index];
  let s = frame.setup ? frame.setup() : sim;
  for (const a of frame.actions ?? []) s = reducer(s, a);
  return { index, sim: s, taskDone: false };
}

export const startTour = () => enterFrame(initialState(), 0);

/**
 * Rebuild the cluster at the start of a frame by replaying every earlier frame, so Back always
 * lands on exactly what that frame describes. The last task replayed is left unsettled so its
 * effect animates again (e.g. instances leaving a downed node).
 */
export function frameStart(index: number): TourState {
  let t = startTour();
  for (let i = 0; i < index; i++) {
    let s = settle(t.sim);
    const task = FRAMES[i].task;
    if (task) {
      s = reducer(s, task.action(s));
      for (const a of task.then ?? []) s = reducer(s, a);
      if (i < index - 1) s = settle(s);
    }
    t = enterFrame(s, i + 1);
  }
  return t;
}

/** Next is available on narrated frames once the cluster has finished moving. */
export function canGoNext(t: TourState): boolean {
  const frame = FRAMES[t.index];
  return !frame.task && !frame.end && isSettled(t.sim);
}

/** The control the user must use right now, if any. */
export function activeTarget(t: TourState): string | null {
  const task = FRAMES[t.index].task;
  return task && !t.taskDone ? task.target : null;
}

const sameAction = (a: Action, b: Action) => JSON.stringify(a) === JSON.stringify(b);

export function tourReducer(t: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'sim': {
      const task = FRAMES[t.index].task;
      const isTick = action.action.type === 'tick';
      // Controls are locked in the UI; this also ignores anything except the current task.
      if (!isTick && (!task || t.taskDone || !sameAction(action.action, task.action(t.sim)))) return t;

      let sim = reducer(t.sim, action.action);
      let taskDone = t.taskDone;
      if (task && !taskDone && task.done(sim)) {
        taskDone = true;
        for (const a of task.then ?? []) sim = reducer(sim, a);
      }
      // Move on right away, or once the follow-up actions have played out.
      if (task && taskDone && (!task.then || isSettled(sim))) return enterFrame(sim, t.index + 1);
      return sim === t.sim && taskDone === t.taskDone ? t : { ...t, sim, taskDone };
    }
    case 'next':
      return canGoNext(t) && t.index < FRAMES.length - 1 ? enterFrame(t.sim, t.index + 1) : t;
    case 'back':
      return t.index > 0 ? frameStart(t.index - 1) : t;
    case 'restart':
      return startTour();
  }
}
