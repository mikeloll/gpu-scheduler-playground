# v2 ideas

Ideas that came up while building v1 and were deliberately left out. None of them are scheduled yet. For things ruled out entirely, and v1's trade-offs, see `docs/decisions.md`.

## Guided tour

- **Lesson menu:** let people jump straight to one part of the tour (for example, "The stalled upgrade") instead of only running it from the start. v1 is a single linear tour to keep it simple.
- **Side-by-side strategies:** run binpack and spread on two clusters at once with the same models, so the difference shows in one view. v1 shows them one after the other because two clusters were too much work for now and would squeeze the screen.

## Simulation

- **Anti-affinity:** an option so the scheduler never puts two instances of the same model on one node. That way one node failure can't take a model fully offline. It strengthens the blast-radius story, but it adds a concept, so it was left out of v1.
