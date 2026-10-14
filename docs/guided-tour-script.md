# Guided tour script (draft, under review)

One linear tour. Playground controls are locked except the one the current
frame asks the user to use, and that control gets attention-drawing styling.
Each frame shows lesson text in the left column. **Next** advances narrated
frames. Task frames advance on their own once the user does the task.

All numbers below were checked against the simulation engine.

Open question: the Models list (without the deploy form, other buttons locked)
shows under the lesson panel for the whole tour, because Frame 13 needs its
Upgrade button. Revisit whether it should only appear for some frames.

Status legend: ⬜ draft · ✅ approved · ✏️ edited

---

## Part 1 — The cluster

### Frame 1 — Welcome ✅
- **Cluster:** empty, 8 nodes, binpack.
- **Highlight:** the cluster.
- **User:** Next.
- **Text:**
  > This is a GPU cluster: 8 machines, called **nodes**, each with 8 GPUs. That's 64 GPUs in total.
  >
  > AI models run on these GPUs. Over the next few minutes you'll see how models get placed onto nodes, what happens when a node fails, and why a deployment can get stuck even when plenty of GPUs look free.

### Frame 2 — Models and instances ✅
- **App does:** deploys chat-medium (4 GPUs × 2 instances). Both land on node-1.
- **Highlight:** the two chat-medium blocks.
- **User:** Next.
- **Text:**
  > Every model needs a fixed number of GPUs, and they all have to be on the **same node**. chat-medium needs 4.
  >
  > We usually run more than one copy of a model so it can handle more traffic and survive problems. Each copy is called an **instance**. Here chat-medium has 2 instances, shown as two 4-GPU blocks.

## Part 2 — Binpack

### Frame 3 — Who decides where things go? ✅
- **App does:** deploys code-assist (2×1), vision (2×1), summarizer (2×1), embeddings (1×2), reranker (1×2), one at a time.
- **Highlight:** the strategy toggle (Binpack), shown locked.
- **User:** Next, once placement finishes.
- **Text:**
  > When you deploy a model, something has to choose a node for each instance. That's the **scheduler**, and it follows a strategy.
  >
  > This cluster uses **binpack**: put each instance on the *fullest* node that still has room, like packing a suitcase before opening the next one. Watch where these models land.

### Frame 4 — Efficient packing ✅
- **Cluster:** node-1 full, node-2 full, node-3 has 2 GPUs used, nodes 4–8 empty. 18/64 used.
- **Highlight:** the empty nodes, plus the "Largest model that fits now: 8 GPUs" tile.
- **User:** Next.
- **Text:**
  > Binpack squeezed everything onto 3 nodes and left 5 completely empty.
  >
  > That's efficient. An empty node can take anything, even a model that needs all 8 GPUs. The largest model that fits right now is **8 GPUs**.

## Part 3 — Blast radius

### Frame 5 — Eggs in one basket ✏️
- **Highlight:** node-2, node-1, and the "Biggest blast radius" tile.
- **User:** Next.
- **Text:**
  > Packing tightly has a cost. node-2 is running **4 different models**. Three of them (code-assist, vision, summarizer) have only one instance, and it's on node-2.
  >
  > Also look at node-1: *both* chat-medium instances are there. The two copies are meant to back each other up, but they share one machine.
  >
  > The number of models degraded or taken offline when a single node fails is that node's **blast radius**.

### Frame 6 — Your turn: a node fails ✅
- **Task:** take node-2 down. Only node-2's "Take down" button is unlocked, with attention styling.
- **Advances when:** node-2 is down.
- **Text:**
  > Let's see it happen. Click **Take down** on node-2 to simulate a crash.

### Frame 7 — The damage ✅ (revisit after seeing it live)
- **App does:** nothing new. The displaced instances move to the waiting area, then get re-placed. Binpack puts code-assist, vision and summarizer on node-3 (now 4 models) and the two embeddings instances on node-4.
- **Highlight:** the waiting area while instances pass through it, then node-3.
- **User:** Next, once everything is placed again.
- **Text:**
  > One failure hit 4 models at once. code-assist, vision and summarizer were **completely offline** until the scheduler found them a new node.
  >
  > They recovered quickly because there was room elsewhere. On a fuller cluster they could have been stuck waiting.
  >
  > Notice where they went: binpack packed them onto node-3, which now runs 4 models. The basket got rebuilt.

## Part 4 — Spread

### Frame 8 — Your turn: try spread ✏️
- **App does (before the task):** resets to an empty cluster with all nodes up.
- **Task:** switch the strategy toggle to Spread. Only the toggle is unlocked, with attention styling.
- **After the toggle:** still on this frame, the app deploys the same models as Frames 2 and 3, in the same order. A status line under the text says "Deploying the same models with spread…".
- **Advances when:** every instance is placed. Frame 9 then appears on its own.
- **Text:**
  > Now let's deploy exactly the same models with a different strategy.
  >
  > **Spread** puts each instance on the *emptiest* node, spreading the work around. Switch the strategy to **Spread**.

### Frame 9 — A smaller blast radius ✏️
- **Cluster:** nodes 1–2 each have a chat-medium instance, and the rest of the instances are spread across nodes 3–8. No node runs more than 2 models.
- **Highlight:** the "Biggest blast radius" tile (2 models).
- **User:** Next.
- **Text:**
  > Same models, very different picture. Every node is lightly loaded, and no node runs more than **2 models**.
  >
  > The two chat-medium instances are now on different nodes, so a single node failure can't take chat-medium fully offline. A failure still degrades whatever was on that node, but far fewer models at once.

## Part 5 — Fragmentation

### Frame 10 — The catch ✅
- **App does:** deploys chat-large (8 GPUs × 1). It goes to the waiting area and stays there.
- **Highlight:** the waiting area, the "Free GPUs: 46" tile, and the "Largest model that fits now: 7 GPUs" tile.
- **User:** Next.
- **Text:**
  > Now let's deploy **chat-large**, which needs a whole node: 8 GPUs.
  >
  > It can't be placed. There are **46 free GPUs**, but every node has something on it, so no single node has 8 free.

### Frame 11 — Fragmentation ✅
- **User:** Next.
- **Text:**
  > This is **fragmentation**: plenty of free capacity in total, but broken into pieces too small to use.
  >
  > Under binpack, chat-large would have landed on one of the 5 empty nodes. Spread lowered the blast radius but left no room for a big model.

## Part 6 — The stalled upgrade

### Frame 12 — A busier cluster ✅
- **App does:** swaps in a busier spread cluster, all at once: chat-medium (4×2) plus 32 single-GPU instances across embeddings, reranker and classifier. Every node is 5/8 full: 40 used, 24 free, largest fit 3.
- **Highlight:** the "Free GPUs: 24" and "Largest model that fits now: 3 GPUs" tiles.
- **User:** Next.
- **Text:**
  > Fast-forward a few weeks. The cluster is busier, still placed with spread. Every node has 3 GPUs free: **24 free GPUs** in total.
  >
  > Everything is running fine. Now it's time to ship a new version of chat-medium.

### Frame 13 — Your turn: upgrade ✅
- **Task:** click Upgrade on chat-medium. Only that button is unlocked, with attention styling.
- **Advances when:** the upgrade has started.
- **Text:**
  > To upgrade without downtime, the new version (**v2**) starts first. The old version (**v1**) is only removed once v2 is running, so the model keeps serving the whole time.
  >
  > Click **Upgrade** on chat-medium.

### Frame 14 — Stuck ✏️
- **App does:** nothing new. chat-medium v2 sits in the waiting area. Both v1 instances keep running.
- **Highlight:** the waiting v2 block and chat-medium's "Upgrade stalled" status.
- **User:** Next.
- **Text:**
  > The upgrade is **stuck**. v2 needs 4 GPUs on one node, and while 24 GPUs are free, no node has more than 3.
  >
  > And because v1 is only removed *after* v2 is running, v1 never gives up its 4 GPUs. Nothing changes until something else frees up space. This is a common reason model deployments stall.

### Frame 15 — What to remember ✏️
- **User:** "Restart tour" or "Keep playing with this cluster" (switches to the playground with this cluster as it is).
- **Text:**
  > - **Binpack** packs models tightly and leaves whole nodes free, but one node failure can hit many models at once.
  > - **Spread** limits how many models one failure degrades, but scatters free GPUs into pieces too small for big models.
  > - **Fragmentation** means "free GPUs" isn't the same as "room for my model". What matters is the most free on a *single* node.
  > - **Upgrades** need room for the new version *before* the old one leaves, so a fragmented cluster can stall them.
  >
  > Choose **Keep playing with this cluster** to try it yourself. Can you get it unstuck? Or use the **Reset** button to reset the cluster and start fresh.
