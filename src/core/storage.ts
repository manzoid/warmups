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
  skipped?: boolean; // learner tested out / skipped it (counts as "seen", not passed)
  ms?: number; // wall-clock time from when the exercise appeared to submit (fluency signal)
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

function serialize(state: ProgressState): StoredState {
  const cards: Record<string, StoredCard> = {};
  for (const [id, card] of state.cards) cards[id] = serializeCard(card);
  return {
    version: SCHEMA_VERSION,
    cards,
    introduced: [...state.introduced],
    attempts: state.attempts,
  };
}

function deserialize(parsed: StoredState | null): ProgressState | null {
  if (!parsed || parsed.version !== SCHEMA_VERSION) return null;
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
}

/** Load persisted progress from localStorage (a fast cache), or a fresh state. */
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
    return deserialize(JSON.parse(raw)) ?? emptyState();
  } catch {
    return emptyState();
  }
}

/** Persist progress to localStorage (the offline cache). No-op without storage. */
export function save(state: ProgressState): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(state)));
  } catch {
    // Quota / disabled storage — swallow; persistence is best-effort.
  }
}

// --- Durable store: the local data server (SQLite), when running --------------

export const DATA_API_BASE = 'http://127.0.0.1:8931';

/** Fetch progress from the local data server. `up` distinguishes "not running". */
export async function loadRemote(): Promise<{ state: ProgressState | null; up: boolean }> {
  try {
    const res = await fetch(`${DATA_API_BASE}/progress`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return { state: null, up: true };
    return { state: deserialize((await res.json()) as StoredState), up: true };
  } catch {
    return { state: null, up: false };
  }
}

/** Push progress to the local data server. Silent no-op if it isn't running. */
export async function saveRemote(state: ProgressState): Promise<void> {
  try {
    await fetch(`${DATA_API_BASE}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serialize(state)),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // Backend down — the localStorage cache still holds it; it'll sync next run.
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

/** Fastest unaided passing time (ms) for `id`, or null if never cleanly cleared. */
export function bestTimeMs(state: ProgressState, id: string): number | null {
  let best: number | null = null;
  for (const a of state.attempts) {
    if (a.id === id && a.passed && !a.skipped && a.rung === 0 && typeof a.ms === 'number') {
      if (best === null || a.ms < best) best = a.ms;
    }
  }
  return best;
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
