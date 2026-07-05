# Scaffolding & remediation design

How warmups should help a learner who is stuck, grounded in learning theory. This
is the design reference; the build-order section at the end tracks what has
shipped (the hint ladder, ladder-depth grading, and mastery-based advancement are
in). The companion `authoring.md` covers how individual exercises are written;
this covers what happens around them.

## The one frame: a desirable-difficulty thermostat

Every principle below reduces to one control problem: keep the learner in the
desirable-difficulty zone, effortful but succeeding around 85 to 90% of the time,
doing the practice that feels worse but transfers.

That makes scaffolding a two-way thermostat, not a safety net:

- When an item overloads the learner, a scaffold pulls them back down into the
  zone.
- When a learner is coasting, removing help pushes them back up into it.

Fade is not politeness. It is the up-direction of the same thermostat.

Two facts make this necessary rather than optional:

- The practices that build durable, transferable skill (spacing, interleaving,
  effortful retrieval) lower performance during practice and feel worse. The ones
  that feel great (cramming, rereading, ten of the same problem in a row) produce
  a fluency that evaporates. A learner's feeling of knowing is a weak guide to
  whether they actually know.
- So the system, not the learner's comfort, has to hold the difficulty. Help must
  be metered and must cost something, or it decays into the illusion of learning.

## Diagnose, then dose: failure mode drives the remedy

"Too hard" almost always means demand exceeds working memory right now. The remedies
point in different directions, so the design question is which kind of hard.

Per-item scaffolds (fire when a single item is too hard):

| Failure mode | Tell | Remedy |
|---|---|---|
| Missing syntax / notation | Can describe the intent, can't spell it | Reveal one fact / a reference card. Cheap, small penalty. Watch: syntax can mask a concept gap (tell them apart by whether one example unblocks them). |
| Can't recall (retrieval blip) | A small cue produces "oh, right" | A cue/hint, never a full reveal. The almost-succeeded retrieval is the most valuable thing to protect. |
| Missing schema (no model of the pattern) | Can't propose any approach, or a structurally wrong one | Worked example, the raw-first build, or the AI Socratic walkthrough (its strongest use). Fade from full example toward blank. |
| Too many interacting parts (intrinsic load) | Can do each piece alone, not combined | Segment (the starter-threaded build steps), or the execution visualizer, which externalizes the state that is overloading working memory. |
| Sub-skill not automatic | Has the idea, bogs down in mechanics and runs out of attention | Do NOT scaffold this item. Drop to the prerequisite and drill it to fluency. |

Curriculum / scheduler fixes (cannot be a per-item hint):

| Failure mode | Remedy |
|---|---|
| Sub-skill not automatic | Mastery-based advancement: hold the sugar until the raw pattern's card is actually stable, not merely "introduced". |
| Transfer gap (doesn't see it is the same pattern) | Interleaving + varied instances + side-by-side comparison. This is the current weak spot. |
| Extraneous load (bad presentation: cryptic prompt, split attention) | Fix the item, do not add help. Note the tension with the terse-prompt rule: terse is good until it becomes cryptic. |

## The hint ladder: the delivery vehicle

Progressive disclosure is where "minimal effective scaffold, then fade" becomes
concrete. Rungs, each tagged with the mode it targets and its scheduling cost:

0. **Attempt** (mandatory). Even a failed attempt helps (productive failure,
   pretesting effect). No scaffold is offered before a commit, or it eats the
   retrieval we are trying to train.
1. **Cue**: name the pattern or the first step. Retrieval blip / "where do I
   start." Small penalty.
2. **One relevant syntax or fact.** Syntax gap. Small penalty.
3. **Execution visualization** (codeviz). Trace and intrinsic-load gaps,
   especially predicts and the loop / pointer / window units. Medium penalty.
   See the codeviz integration note below.
4. **AI Socratic walkthrough** (prompt handoff to the user's own coding agent).
   Schema and strategy gaps, adaptive to the person. Medium-large penalty.
5. **Faded solution, then full solution.** Deep schema gap. Largest penalty, a
   full lapse.

### The ladder does triple duty

The rung a learner reaches is at once:

1. The minimal-scaffold dosing (least help first, escalate only if still stuck).
2. The diagnosis of which failure mode they were in (the rung that unblocks them
   names the gap).
3. The fine-grained grade signal for FSRS. **BUILT** (`gradeFor` in
   `src/core/srs.ts`): the deepest rung reached maps onto three grades — solved
   at rung 0 → good, rungs 1 to 2 (cue/syntax) → hard, rungs 3 to 5 (visualize,
   walkthrough, reveal) or any fail → again. This replaced the old binary
   pass/fail-to-good/again collapse and closes the "we underuse FSRS's grades"
   gap with no separate self-rating screen. (A distinct easy grade and a
   time-to-solve tiebreak remain possible later refinements.)

### Honesty rule

The rung reached always costs something, so the spaced-repetition loop stays
honest regardless of which rung was used (including the external AI walkthrough
and the visualizer, which the app cannot observe directly). As built: a
cue/syntax rung (1 to 2) drops the grade to hard, so the item repeats sooner
without a full lapse; anything deeper (visualize, walkthrough, reveal) schedules
it as a lapse (again), the same as a fail.

### codeviz integration (rung 3)

This rung uses a **locally-running codeviz** as-is, for both tracks. The
"Visualize my run" button sends the learner's **own submitted code** (for a
predict item, the snippet they mis-traced) to codeviz and shows the step-through
inline. See `src/ui/Visualizer.tsx` and `src/ui/codevizApi.ts`; the codeviz side
is the `codeviz api` server (`serve_api` in codeviz's `server.py`).

- **How it flows.** warmups `POST`s `{code, lang}` to `http://127.0.0.1:8930/trace`.
  codeviz traces it with its real Python or JavaScript backend and returns a
  **single self-contained, offline HTML page** (step-through code, stack frames,
  heap objects, reference arrows). warmups drops that HTML into a sandboxed
  `<iframe srcdoc>` (`sandbox="allow-scripts"`). CORS is open on the codeviz side
  so the static page can call it.
- **Both languages work now**, because codeviz already has mature Python (OPT
  `pg_logger`) and JavaScript (Node V8 Inspector) tracers. This is the whole
  reason for the local-process model: no in-browser JS tracer to build.
- **The core loop stays in-browser and offline.** Running and grading exercises
  still happen entirely in the browser (Pyodide / the worker); only this
  visualization rung needs codeviz. If codeviz is not running, the rung shows how
  to start it (`uv tool install git+https://github.com/manzoid/codeviz` then
  `codeviz api`) instead of failing.

Why a local process rather than in-browser tracing: it reuses codeviz's existing,
faithful tracers for **both** languages (an in-browser JS tracer is a real
project), and the learner's code stays on their machine (sent only to
`127.0.0.1`). The trade-off is a companion install + a running process, so
visualization is not a pure static-site feature the way grading is. An earlier
in-browser Python path (pg_logger under Pyodide) was retired in favor of this
single, consistent path for both tracks.

**Caveat (mixed content).** If warmups is ever served over https, browsers may
block its calls to the `http://127.0.0.1` codeviz API. warmups is local-first and
normally served over http (dev/preview), where this is a non-issue; run it
locally to visualize. codeviz repo: https://github.com/manzoid/codeviz (also
cloned locally at ../codeviz).

## Fade is the same ladder with a moving entry point

Expertise reversal: worked examples help a novice and start to hurt once skilled.
Operationalize it by making the default entry rung a function of the item's FSRS
stability.

- New pattern: start higher. Offer the visualizer or a worked step early, because
  unguided struggle just overloads a novice.
- Mature card: start lower. Require more attempts before a rung unlocks. Eventually
  attempt-only.

One ladder, different default depth by mastery. That is "scaffold heavily first,
fade the scaffolding" made mechanical.

## Curriculum grain (separate from the ladder)

- **Block to acquire, interleave to transfer.** First exposures to a new pattern
  can be blocked; after acquisition, let FSRS interleave due items across patterns
  for discrimination and transfer. Blocking feels better and teaches narrowly, so
  confine it to acquisition.
- **Variety** is the only fix for the transfer gap: more varied instances per
  pattern, not more copies of the same surface form. This is where the current
  corpus is thinnest.
- **The predict-to-write ramp** within a concept mirrors the worked-example-to-
  solving fade at the curriculum grain: predict-heavy at acquisition, write-heavy
  as the concept consolidates. (Current mix is a roughly flat 55/45 predict/write
  per unit; the change would be to ramp it within each concept rather than change
  the overall ratio.)

## What this says not to build yet

The ladder-depth signal plus FSRS gives most of the adaptivity payoff cheaply.
Defer heavy per-skill knowledge tracing and adaptive item selection until real
usage shows where people actually stall. Bad adaptation is worse than none (it can
trap people on the wrong material), and it fights the local-first simplicity.

Adherence is the reason the ladder matters at all: a stuck learner always has a
next rung, so they keep showing up, while help stays metered and penalized so it
does not decay into the illusion of learning. The schedule a learner will actually
keep beats the optimal one they abandon.

## Net design

One thermostat, delivered as a diagnosis-driven hint ladder whose depth also feeds
FSRS, whose entry point fades with mastery, with the AI handoff and the execution
visualizer slotted in as the mode-specific middle rungs, and with interleaving,
variety, and the predict-to-write ramp handled at the curriculum level.

## Build order (when we act on this)

1. Reveal-answer as a miss (the rung-5 base case; smallest change, closes the
   worst current gap where a stuck write has no escape). **BUILT.**
2. The cue / syntax rungs (1 and 2) plus ladder-depth to FSRS-grade mapping (turns
   the reveal into a real ladder and upgrades the scheduler signal). **BUILT.**
   The optional `cue`/`syntax` fields on an exercise surface as the two shallow
   rungs; the deepest rung reached maps to a three-grade FSRS signal
   (good / hard / again) via `gradeFor` in `src/core/srs.ts`.
3. Execution visualization rung: **Python path done** — trace the learner's own
   submitted code with the vendored codeviz tracer inside the Pyodide runtime
   already used for grading, and iframe the self-contained offline HTML. JS live
   tracing is the next increment. See the codeviz integration note above.
4. AI Socratic walkthrough rung: a copyable, well-tuned prompt handoff. **BUILT**
   (`src/ui/walkthroughPrompt.ts`).
5. Mastery-based advancement (**BUILT** — `learnedEnough` in `src/ui/session.ts`
   gates prereqs on a card that has actually been scheduled out of the New state,
   not merely introduced) + the predict-to-write ramp (still pending).
6. Variety pass on the content for transfer.
7. Only then, if data warrants: adaptive entry-rung by card state, and anything
   heavier.
