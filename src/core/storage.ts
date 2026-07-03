import type { Card } from './srs';

/**
 * localStorage-backed persistence for SRS progress.
 *
 * Persists a Map<exerciseId, Card> plus the set of "introduced" exercise ids
 * and a schema version. All access is guarded against SSR / missing `window`.
 */

export const STORAGE_KEY = 'warmups.progress.v1';
export const SCHEMA_VERSION = 1;

export interface ProgressState {
  version: number;
  cards: Map<string, Card>;
  introduced: Set<string>;
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
}

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

function emptyState(): ProgressState {
  return { version: SCHEMA_VERSION, cards: new Map(), introduced: new Set() };
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
