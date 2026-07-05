// Pure spaced-repetition session logic (no React), so it can be reasoned about
// and unit-tested in isolation.

import { State } from 'ts-fsrs';
import type { Exercise, Runner, Track } from '../core/types';
import { due, type Card } from '../core/srs';
import { getCard, isIntroduced, type ProgressState } from '../core/storage';
import pythonRunner from '../runners/python';
import javascriptRunner from '../runners/javascript';

export const RUNNERS: Record<Track, Runner> = {
  python: pythonRunner,
  javascript: javascriptRunner,
};

/**
 * `id` has been learned well enough to unlock exercises that depend on it:
 * its card exists, has been answered at least once (reps >= 1), and has
 * graduated out of the initial New state. Merely introducing an exercise is
 * no longer sufficient — the learner must actually have scheduled it.
 */
function learnedEnough(state: ProgressState, id: string): boolean {
  const card = getCard(state, id);
  return card !== undefined && card.reps >= 1 && card.state !== State.New;
}

/** All of `ex`'s prereqs have been learned well enough (not just introduced). */
function prereqsMet(ex: Exercise, state: ProgressState): boolean {
  return (ex.prereqs ?? []).every((id) => learnedEnough(state, id));
}

export interface NextPick {
  exercise: Exercise;
  /** True when this exercise is being introduced for the first time. */
  isNew: boolean;
}

/**
 * Choose the next exercise for a track:
 *   1. Due reviews first (earliest due date wins).
 *   2. Otherwise introduce a new exercise whose prereqs are all met, in the
 *      content's prereq order.
 * Returns null when everything is caught up (nothing due, nothing new).
 */
export function pickNext(
  exercises: Exercise[],
  state: ProgressState,
  now: Date,
): NextPick | null {
  let bestDue: { ex: Exercise; card: Card } | null = null;
  for (const ex of exercises) {
    const card = getCard(state, ex.id);
    if (card && due(card, now)) {
      if (!bestDue || card.due.getTime() < bestDue.card.due.getTime()) {
        bestDue = { ex, card };
      }
    }
  }
  if (bestDue) return { exercise: bestDue.ex, isNew: false };

  for (const ex of exercises) {
    if (!isIntroduced(state, ex.id) && prereqsMet(ex, state)) {
      return { exercise: ex, isNew: true };
    }
  }

  // Fallback: if new exercises remain but are locked by unmet prereqs, still
  // let the learner proceed with the first uncovered one.
  const firstNew = exercises.find((ex) => !isIntroduced(state, ex.id));
  if (firstNew) return { exercise: firstNew, isNew: true };

  return null;
}

export interface Counts {
  due: number;
  new: number;
  learned: number;
  total: number;
}

/** Progress tallies for a track: due now / never seen / seen & scheduled. */
export function computeCounts(
  exercises: Exercise[],
  state: ProgressState,
  now: Date,
): Counts {
  let dueN = 0;
  let newN = 0;
  let learned = 0;
  for (const ex of exercises) {
    const card = getCard(state, ex.id);
    if (!card || !isIntroduced(state, ex.id)) {
      newN += 1;
    } else if (due(card, now)) {
      dueN += 1;
    } else {
      learned += 1;
    }
  }
  return { due: dueN, new: newN, learned, total: exercises.length };
}
