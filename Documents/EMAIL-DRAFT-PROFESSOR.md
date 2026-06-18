# Email Draft — Technical Answers to Professor's Questions

> **Scope:** Technical portion only, written to be dropped into a fuller email.
> Greeting, framing, and closing are left to the other agent. One section per
> question; each stands alone.

---

## 1. How is the mind-map generated (inputs + grouping logic), and can users edit/correct it?

**Inputs.** The map is built from the questions you ask. Every question you send
through *Ask* becomes a candidate node — there's no separate "build my map" step;
the map grows as a byproduct of curiosity.

**Grouping logic.** Each question is placed into a four-layer hierarchy —
*Knowledge → Branch (discipline) → Cluster (domain) → Concept Anchor → Q&As*. A
new question is classified in two stages:

1. **Embedding pre-check (no LLM, no tokens).** We embed the question and compare
   it against every existing concept anchor by cosine similarity. If it's close
   enough to one we already have, we attach it there and inherit that anchor's
   branch and cluster. This is what stops the same concept from being duplicated
   across different branches.
2. **Tree descent (LLM, only on a miss).** If nothing matches, the model places
   the question by choosing a branch, then a cluster, then an existing-or-new
   anchor. Anchor names are normalized to clean concept nouns (e.g. *"What is
   spaced repetition?"* → *"Spaced Repetition"*) so the map reads as concepts,
   not paraphrased questions.

**Yes — users can edit and correct it.** This was a major focus of recent work.
In the Knowledge Graph you can directly **rename**, **move** (drag to re-parent,
with a magnetic snap), **merge** duplicates, **detach** a question, **prune**,
and **delete** — with a preview/confirmation step on the destructive ones. Every
correction is recorded in an append-only journal, so there's a **persistent Undo
that survives app restart**, and the AI's later re-organization is explicitly
told to *preserve* your manual corrections rather than overwrite them.

---

## 2. What's the intended filtering logic, and what was blocking it from working reliably?

**Intended logic.** Before a question is treated as a real learning query, it's
classified as *on-topic*, *off-topic*, or *malicious*. On-topic questions flow
into the normal Q&A and graph-building path; off-topic ones (small talk,
unrelated chatter) are handled separately so they don't pollute the knowledge
graph; the malicious category is reserved for genuine abuse (jailbreak templates,
disallowed-content requests).

**What went wrong in the presentation.** The specific failure was a benign
small-talk prompt — *"How are you doing?"* — that the off-topic classifier
**failed to flag**, so it was treated as a real question. It was a
**false negative on off-topic detection**, not a security issue. Root cause: the
original filter leaned on a hand-written **regex pattern library**, which only
catches phrasings it was explicitly written for and misses everything else —
casual small talk is exactly the kind of open-ended input it can't enumerate.

**The fix.** We replaced the regex approach with a **hybrid classifier**: a
narrow regex layer for unambiguous cases plus an **embedding-similarity layer**
that judges a prompt by *meaning* rather than exact strings. Off-topic small talk
now lands far from the on-topic concept corpus in embedding space and is caught
regardless of exact wording. (The same redesign also added a pre-LLM gate for the
malicious category, so abusive prompts are rejected before any model call — but
that's hardening on top; the presentation issue itself was simply the off-topic
miss described above.)

---

## 3. Can users control podcast length and style, and how is quality kept consistent across settings?

**Yes.** Users pick both a **length** and a **style** from bounded options, with
sensible educational defaults pre-selected. Length is capped on both ends so the
output stays coherent, and style changes the *framing* (e.g. an explanatory
walkthrough vs. a review-oriented pass) rather than the underlying facts.

**Consistency mechanism.** The content is always grounded in the same source —
your knowledge graph and concept summaries — so length/style change the
*presentation*, not the *facts*. The prompt is templated per option so each
setting produces a predictable shape, and generation is **cached by a hash of the
options**, so the same concept at the same settings reproduces the same episode
instead of drifting run to run. The TTS voice model is configurable with a safe
fallback if a chosen model is unavailable, so audio quality doesn't silently
degrade.

---

## 4. On "dark patterns" — how do you balance engagement vs. learning?

This one is intentional, and we'd argue it's a *benevolent* version of the
pattern. The curiosity feed deliberately borrows the format that makes social
media so engaging — a visually rich, swipeable, personalized discovery feed — but
points that pull **toward** learning instead of away from it. The engagement
surface is the on-ramp: every post is tied to a concept in your knowledge graph,
and exploring posts is what feeds the spaced-repetition system underneath. So
engagement and learning aren't in tension here; the attention-grabbing feed is
the delivery mechanism for the learning.

Where we draw the line is on the *coercive* mechanics. We deliberately **don't**
ship streaks, leaderboards, public likes, or guilt-driven daily-goal pressure —
the things that make engagement feel like an obligation. And rather than bolt on
mandated stop cues or forced reflection prompts (which we view as their own form
of pressure), the loop is **reward-based and self-limiting**: the daily feed is
finite and resolves into a "bloom" end-state rather than scrolling forever (a
natural stopping point instead of an imposed one), and review is *invited* when a
concept starts to fade — shown by the wilting/blossoming leaf states on the tree
— never demanded. The intent is to keep the engaging surface while removing the
parts of the social-media playbook that work against the user.

---

## 5. Scroll is great for discovery — what supports retrieval later (search, bookmarks, history, dashboards)?

Discovery is no longer a dead end — everything is retrievable:

- **Search** — debounced fuzzy search with match highlighting across saved
  content and concepts.
- **Bookmarks / Collections** — save any post (and podcasts) into local
  Collections you name; "Saved" and "Liked" views collect them.
- **History** — a record of what you've read, to get back to something you
  scrolled past.
- **Per-concept dashboard** — each concept has its own page showing review
  health, where it "appears in" (backlinks to the posts and questions that
  reference it), and a one-tap recovery action to pull a fading concept back into
  review.

All of these read from the **same knowledge graph** the corrections in Q1 mutate,
and refresh live when the graph or your collections change — so search,
dashboards, and the map never disagree.
