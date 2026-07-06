// Pure session logic (no React), so it can be reasoned about and tested in
// isolation.
//
// Selection is sequence-driven off the attempt log, not an SRS schedule: the
// "Learn" flow just advances through the curriculum in order. Spacing comes
// naturally from a concept's variants appearing later in the sequence, and the
// learner drives review directly via practice / history filters.

import type { Exercise, Runner, Track } from '../core/types';
import { hasPassed, hasAttempted, type ProgressState } from '../core/storage';
import pythonRunner from '../runners/python';
import javascriptRunner from '../runners/javascript';

export const RUNNERS: Record<Track, Runner> = {
  python: pythonRunner,
  javascript: javascriptRunner,
};

export interface NextPick {
  exercise: Exercise;
  /** True when this exercise has never been attempted. */
  isNew: boolean;
}

/**
 * All of `ex`'s prereqs have at least been SEEN (attempted). We gate on "seen"
 * rather than "passed" so a failed prerequisite doesn't wall off progress —
 * failing something is fine, you just march on and redo it later from History.
 * (This also fixes content-glob order putting a `-more` variant file before its
 * base file: the variant is skipped until its base has been reached.)
 */
function prereqsSeen(ex: Exercise, state: ProgressState): boolean {
  return (ex.prereqs ?? []).every((id) => hasAttempted(state, id));
}

/**
 * The "Learn" flow: march forward through the curriculum. Pick the first
 * exercise, in content order, the learner has not yet ATTEMPTED and whose
 * prereqs have been seen. Falls back to the first un-attempted exercise so
 * nobody is hard-stuck. Returns null once everything has been attempted —
 * redo of fails/hinted items happens via Practice / History, not here.
 */
export function pickNextLearn(
  exercises: Exercise[],
  state: ProgressState,
): NextPick | null {
  for (const ex of exercises) {
    if (hasAttempted(state, ex.id)) continue;
    if (prereqsSeen(ex, state)) return { exercise: ex, isNew: true };
  }
  const first = exercises.find((ex) => !hasAttempted(state, ex.id));
  return first ? { exercise: first, isNew: true } : null;
}

export interface LearnCounts {
  done: number;
  total: number;
}

/** How many of `exercises` the learner has passed. */
export function learnCounts(
  exercises: Exercise[],
  state: ProgressState,
): LearnCounts {
  let done = 0;
  for (const ex of exercises) if (hasPassed(state, ex.id)) done += 1;
  return { done, total: exercises.length };
}
