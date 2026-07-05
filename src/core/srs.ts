import {
  createEmptyCard,
  fsrs,
  Rating,
  type Card as FsrsCard,
  type FSRS,
} from 'ts-fsrs';

/**
 * SRS scheduler — a thin wrapper around `ts-fsrs` exposing a three-grade
 * ('again' / 'hard' / 'good') review flow for the warmups app. The grade is
 * derived from how far the learner descended the hint ladder (see gradeFor).
 */

export type Grade = 'again' | 'hard' | 'good';

/** Re-export the ts-fsrs Card shape as our canonical Card type. */
export type Card = FsrsCard;

// A single shared scheduler instance using ts-fsrs defaults.
// Fuzz is disabled so scheduling is deterministic (important for tests).
const scheduler: FSRS = fsrs({ enable_fuzz: false });

const RATING_BY_GRADE: Record<Grade, Rating.Again | Rating.Hard | Rating.Good> =
  {
    again: Rating.Again,
    hard: Rating.Hard,
    good: Rating.Good,
  };

/** Create a fresh card, due immediately at `now`. */
export function newCard(now: Date): Card {
  return createEmptyCard(now);
}

/** Apply a review grade to `card` at `now`, returning the updated card. */
export function review(card: Card, grade: Grade, now: Date): Card {
  const rating = RATING_BY_GRADE[grade];
  return scheduler.next(card, now, rating).card;
}

/** True if `card` is due (its due date is at or before `now`). */
export function due(card: Card, now: Date): boolean {
  return card.due.getTime() <= now.getTime();
}

/**
 * Map an attempt outcome to a review grade from the deepest hint-ladder rung
 * the learner reached (docs/scaffolding.md):
 *   0 = attempt, 1 = cue, 2 = syntax, 3 = visualize, 4 = walkthrough, 5 = reveal.
 *
 *   not passed                 -> 'again'
 *   passed, deepest rung 0     -> 'good'  (unassisted)
 *   passed, deepest rung 1-2   -> 'hard'  (cue/syntax: a nudge, repeats sooner)
 *   passed, deepest rung >= 3  -> 'again' (visualize/walkthrough/reveal: a lapse)
 */
export function gradeFor({
  passed,
  deepestRung,
}: {
  passed: boolean;
  deepestRung: number;
}): Grade {
  if (!passed) return 'again';
  if (deepestRung <= 0) return 'good';
  if (deepestRung <= 2) return 'hard';
  return 'again';
}
