# Decisions

What v1 deliberately leaves out, the trade-offs it makes, and where the simulation is simpler than a real cluster. Ideas that may come back later are in `docs/v2-ideas.md`.

## Ruled out

- **Kubernetes vocabulary.** The app only talks about models, instances, nodes and GPUs. It teaches the concepts, not a particular platform.
- **A second upgrade option.** Upgrades always start the new instance before removing the old one. There's no "take the old one down first" setting, because the "new before old" ordering is what causes the stall the app is meant to explain.
- **Remedies in the tour.** The tour explains problems (blast radius, fragmentation, stalled upgrades) but doesn't teach fixes such as defragmenting or keeping spare room.
- **Rebalance/defrag button.** Switching strategy only affects new placements. Reset is the only way to start over.
- **Configurable cluster size and mixed GPU types.** The cluster is fixed at 8 nodes with 8 GPUs each, to keep the picture simple.
- **Shareable scenario links.** A cluster can't be saved or shared through the URL.
- **A state-management library.** The engine is a single reducer, so React's `useReducer` is enough. Zustand was considered and dropped.
- **Per-node "If down: N models hit" text.** Removed from the node rows. The "Biggest blast radius" metric tile already covers it.
- **Reworking the waiting area into an action queue.** The area shows the instances that are waiting rather than the steps ahead. A queue would add little, and it risks suggesting the wrong upgrade order.

## Trade-offs

- **Reset returns to the starter cluster** (three models already running), not an empty one, so the app never opens to a blank screen.
- **Only stuck models move to the top of the Models list.** Models that are briefly short of instances while they're being placed keep their position, so the list doesn't jump around during normal moves.
- **The welcome dialog appears on every load.** There's no "don't show this again".
- **Leaving the tour overwrites the playground's cluster.** Switching tabs from the tour, or choosing "Keep playing", carries the tour's cluster into the playground. Anything you had built there is replaced.
- **One linear tour.** There's no lesson menu, and binpack and spread are shown one after the other rather than side by side.
- **Tour mode hides the deploy form and the event log.** The Models list stays visible for the whole tour with every button locked, except chat-medium's Upgrade button in Frame 13.
- **Frame 12 swaps in its busy cluster instantly** ("fast-forward a few weeks") instead of animating 34 placements, which would take about 45 seconds.
- **Long names are cut short on 1-GPU blocks** (for example "embedd…"). Hovering a block shows the full name.

## Simulation simplifications

These keep the explainer easy to follow. They are not claims about how any real scheduler behaves.

- An instance always fits on a single node. Ties between equally good nodes go to the lowest-numbered one.
- Each simulation step makes one visible change, so viewers can follow along.
- Upgrades replace one instance at a time.
- When a node comes back up, instances that moved off it stay where they are.
- If a node fails during an upgrade, its old-version instances are placed again as the old version. The upgrade then replaces them in the normal way.
