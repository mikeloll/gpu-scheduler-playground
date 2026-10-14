import { createContext, useContext } from 'react';

/** What the current tour frame points at and which control (if any) is unlocked. */
export interface TourUi {
  active: boolean;
  highlights: ReadonlySet<string>;
  target: string | null;
}

export const TourUiContext = createContext<TourUi>({
  active: false,
  highlights: new Set(),
  target: null,
});

/**
 * Components use this to take part in the tour. Outside the tour it's a no-op: nothing is
 * highlighted and nothing is locked.
 */
export function useTourUi() {
  const ui = useContext(TourUiContext);
  return {
    active: ui.active,
    /** Class for something the current frame points at. Keys are listed in frames.ts. */
    highlight: (key: string) => (ui.highlights.has(key) ? 'tour-highlight' : ''),
    /** During the tour every control is locked except the current task's target. */
    control: (key: string) => {
      if (!ui.active) return { disabled: false, className: '' };
      const isTarget = ui.target === key;
      return { disabled: !isTarget, className: isTarget ? 'tour-target' : '' };
    },
  };
}
