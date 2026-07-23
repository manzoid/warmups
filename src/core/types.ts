export type Track = 'python' | 'javascript';
export type ExerciseKind = 'predict' | 'write';
export interface Exercise {
  id: string;            // unique, e.g. "py.counter.freq"
  track: Track;
  group: string;         // concept group, e.g. "Dicts & counting"
  concept: string;       // short label, e.g. "Counter for frequencies"
  kind: ExerciseKind;
  prompt: string;        // what to do (plain text / light markdown)
  // Optional hint-ladder rungs (lower rungs of docs/scaffolding.md). Shown as
  // early, cheap help before the deeper visualize/walkthrough/reveal rungs.
  cue?: string;          // rung 1: a nudge toward the idea; must not give the answer
  syntax?: string;       // rung 2: a syntax reminder; must not give the answer
  // kind === 'predict': user types the value that snippet evaluates to
  snippet?: string;      // code whose resulting value the learner predicts
  expected?: string;     // canonical expected value, as a string (e.g. "[2, 4, 6]")
  // kind === 'write': user writes/completes code; tests decide pass/fail
  starter?: string;      // pre-filled editor content
  solution?: string;     // reference solution (hidden; used only for content validation)
  tests?: string;        // legacy: appended after the user's code; must throw/assert on failure
  // Structured test cases (preferred over `tests`): each runs the learner's code
  // then evaluates `call` and checks it. Lets the runner report WHICH case failed
  // (with its input, expected, and actual) and drive the visualizer with exactly
  // the failing case. `tests` stays supported for exercises not yet migrated.
  cases?: Case[];
  banned?: string[];     // substrings the learner's code may NOT contain (enforces "do not use X")
  prereqs?: string[];    // exercise ids that should be learned first
  // Shown only AFTER solving (never in the prompt — prompts stay terse):
  note?: string;         // one-line "why" / under-the-hood / big-O payoff
  mapsTo?: string;       // real interview problem this maps to, e.g. "LC 76 · Minimum Window Substring"
  // Fluency generators (Kumon-style infinite drilling). Trusted source code in
  // the exercise's language defining `make()`, which returns a fresh randomized
  // instance ({snippet,expected} for predict; {starter,tests,solution} for write).
  // Ground truth is computed by executing, so instances are self-verifying.
  generator?: string;
  // Stamped at load time from the source file (see ui/content.ts), used by the
  // curriculum-scope filter to hide content without deleting it:
  unit?: string;        // e.g. "u01" (derived from the id / file); undefined for fluency
  spiral?: boolean;     // true if it came from a "-more" spiral-review file
}
/**
 * One structured test case for a `write` exercise. `setup` (optional) runs first
 * (e.g. to build a fixture or call a mutating function), then `call` is
 * evaluated as an expression. Its value is compared to `expect` (by value), or
 * checked with `check` (a boolean expression where `_` is the call's result).
 * Exactly one of `expect` / `check` is used.
 */
export interface Case {
  setup?: string;
  call: string;
  expect?: string;
  check?: string;
}

export interface RunResult {
  passed: boolean;
  actual?: string;
  error?: string;
  // When a structured `cases` run fails, which case failed (for a clearer
  // message and to drive the visualizer with exactly this case).
  failingCase?: { setup?: string; call: string; expected?: string; actual?: string };
}

/** One freshly-generated exercise instance (from an Exercise's `generator`). */
export interface GeneratedInstance {
  prompt?: string;
  snippet?: string;
  expected?: string;
  starter?: string;
  solution?: string;
  tests?: string;
  banned?: string[];
}

export interface Runner {
  track: Track;
  run(userCode: string, ex: Exercise): Promise<RunResult>;
  /** Run ex.generator (trusted content code) to produce a fresh random instance. */
  generate?(ex: Exercise): Promise<GeneratedInstance>;
}
