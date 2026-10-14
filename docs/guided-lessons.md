# Guided demo mode — lesson outline (parked)

Status: **not started**. We build the interactive mode first, then design these
lessons together. Style: a mix of narrated steps (the app performs actions, user
clicks Next) and hands-on tasks ("now take node-3 down and see what happens").
Lessons stop at explaining the problem — no remedies section.

Vocabulary: models, instances, nodes, GPUs. No Kubernetes terms.

1. **Meet the cluster** — nodes, GPUs, models, instances.
2. **Binpack** — watch the cluster fill tightly.
3. **Spread** — same deployments, spread out.
4. **Blast radius** — take down the busiest node under each strategy; compare how
   many models are hit.
5. **Fragmentation** — spread lots of 1–2 GPU models, then try to deploy an
   8-GPU model. It waits forever despite plenty of free GPUs.
6. **The stalled upgrade** — upgrade a 4-GPU model on a fragmented cluster.
   The new instance must start before the old one is retired, there's no single
   node with 4 free GPUs, so the upgrade sits stuck.

Ideas for later:
- Side-by-side binpack vs spread running the same script.
- v2: anti-affinity (don't put two instances of the same model on one node).
