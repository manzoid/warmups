import {
  createEmptyCard,
  fsrs,
  Rating,
  type Card as FsrsCard,
  type FSRS,
} from 'ts-fsrs';

/**
 * SRS scheduler — a thin wrapper around `ts-fsrs` exposing a two-button
 * ('again' / 'good') review flow for the warmups app.
 */

export type Grade = 'again' | 'good';

/** Re-export the ts-fsrs Card shape as our canonical Card type. */
export type Card = FsrsCard;

// A single shared scheduler instance using ts-fsrs defaults.
// Fuzz is disabled so scheduling is deterministic (important for tests).
const scheduler: FSRS = fsrs({ enable_fuzz: false });

const RATING_BY_GRADE: Record<Grade, Rating.Again | Rating.Good> = {
  again: Rating.Again,
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
