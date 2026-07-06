import type { Card } from './srs';

/**
 * localStorage-backed persistence for progress.
 *
 * Holds an append-only **attempt log** (the source of truth for the history view
 * and learner-driven redo), plus a Map<exerciseId, Card> and an "introduced" set
 * that the (now-demoted) SRS scheduler still uses. All access is guarded against
 * SSR / missing `window`.
 */

export const STORAGE_KEY = 'warmups.progress.v1';
export const SCHEMA_VERSION = 1;

/** One graded attempt at an exercise. Append-only; never mutated. */
export interface Attempt {
  id: string; // exercise id
  at: number; // epoch ms
  passed: boolean;
  rung: number; // deepest hint-ladder rung used (0 = unaided, 1 cue … 5 reveal)
}

export interface ProgressState {
  version: number;
  cards: Map<string, Card>;
  introduced: Set<string>;
  attempts: Attempt[];
}

// JSON-serializable on-disk shape. Cards store `due` / `last_review` as ISO
// strings (Dates don't survive JSON) and are revived on load.
interface StoredCard extends Omit<Card, 'due' | 'last_review'> {
  due: string;
  last_review?: string | null;
}
interface StoredState {
  version: number;
  cards: Record<string, StoredCard>;
  introduced: string[];
  attempts?: Attempt[]; // optional: pre-existing v1 saves predate the log
}

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function emptyState(): ProgressState {
  return {
    version: SCHEMA_VERSION,
    cards: new Map(),
    introduced: new Set(),
    attempts: [],
  };
}

function reviveCard(stored: StoredCard): Card {
  return {
    ...stored,
    due: new Date(stored.due),
    last_review:
      stored.last_review == null ? undefined : new Date(stored.last_review),
  } as Card;
}

function serializeCard(card: Card): StoredCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review ? card.last_review.toISOString() : null,
  } as StoredCard;
}

/** Load persisted progress, or a fresh empty state if none/invalid. */
export function load(): ProgressState {
  if (!hasStorage()) return emptyState();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyState();
  }
  if (!raw) return emptyState();

  try {
    const parsed = JSON.parse(raw) as StoredState;
    if (!parsed || parsed.version !== SCHEMA_VERSION) return emptyState();
    const cards = new Map<string, Card>();
    for (const [id, sc] of Object.entries(parsed.cards ?? {})) {
      cards.set(id, reviveCard(sc));
    }
    return {
      version: SCHEMA_VERSION,
      cards,
      introduced: new Set(parsed.introduced ?? []),
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
    };
  } catch {
    return emptyState();
  }
}

/** Persist progress to localStorage. No-op without storage. */
export function save(state: ProgressState): void {
  if (!hasStorage()) return;
  const cards: Record<string, StoredCard> = {};
  for (const [id, card] of state.cards) {
    cards[id] = serializeCard(card);
  }
  const out: StoredState = {
    version: SCHEMA_VERSION,
    cards,
    introduced: [...state.introduced],
    attempts: state.attempts,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
  } catch {
    // Quota / disabled storage — swallow; persistence is best-effort.
  }
}

// --- Small helpers operating on a ProgressState ---

export function getCard(state: ProgressState, id: string): Card | undefined {
  return state.cards.get(id);
}

export function putCard(state: ProgressState, id: string, card: Card): void {
  state.cards.set(id, card);
}

export function isIntroduced(state: ProgressState, id: string): boolean {
  return state.introduced.has(id);
}

export function markIntroduced(state: ProgressState, id: string): void {
  state.introduced.add(id);
}

// --- Attempt log ---

/** Append one graded attempt. */
export function recordAttempt(state: ProgressState, attempt: Attempt): void {
  state.attempts.push(attempt);
}

/** Wipe all progress (the attempt log + legacy SRS state), in place. */
export function resetProgress(state: ProgressState): void {
  state.attempts.length = 0;
  state.cards.clear();
  state.introduced.clear();
}

/** True if the learner has ever passed this exercise. */
export function hasPassed(state: ProgressState, id: string): boolean {
  for (const a of state.attempts) if (a.id === id && a.passed) return true;
  return false;
}

/** True if the learner has ever attempted this exercise (pass or fail). */
export function hasAttempted(state: ProgressState, id: string): boolean {
  for (const a of state.attempts) if (a.id === id) return true;
  return false;
}

/** The most recent attempt at `id`, or undefined. */
export function lastAttempt(state: ProgressState, id: string): Attempt | undefined {
  let best: Attempt | undefined;
  for (const a of state.attempts) {
    if (a.id === id && (!best || a.at > best.at)) best = a;
  }
  return best;
}

/**
 * Raise the deepest-rung recorded on the most recent attempt at `id` (used when
 * a learner opens a deeper hint AFTER submitting — one attempt per sitting, but
 * the rung reflects the most help they ended up taking).
 */
export function bumpLastAttemptRung(
  state: ProgressState,
  id: string,
  rung: number,
): void {
  const a = lastAttempt(state, id);
  if (a && rung > a.rung) a.rung = rung;
}
