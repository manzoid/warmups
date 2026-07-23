// Fluency pace targets, resolved in three tiers (highest priority first):
//   1. the learner's PERSONAL override (adapted from their own performance),
//   2. the shipped CONFIG (src/data/pace-targets.json) a time-trainer exports —
//      authored against the PYTHON drills; a JS drill with no entry of its own
//      borrows its Python counterpart's timing as a default,
//   3. a kind-based FALLBACK so there is always a target.
//
// Personal + trainer paces are DURABLE user data, persisted on the local data
// server (GET/PUT /pace) — NOT localStorage, so they survive reloads and are the
// same regardless of the app's origin. loadPaces() hydrates an in-memory cache
// at startup; reads are synchronous off that cache, writes update it and PUT to
// the server.
//
// Timings are CONTENT-ADDRESSED: every locked time is stored with a hash of the
// pattern's difficulty-affecting content (generator source, kind, bans), and is
// only used while that hash still matches. Editing a problem auto-invalidates
// its stale timing (falls back to the default) and surfaces it as "dirty".

import config from '../data/pace-targets.json';
import { DATA_API_BASE } from './storage';
import type { Exercise } from './types';

/** A locked time plus the content hash it was measured against. */
export interface PaceEntry {
  ms: number;
  hash: string;
}
type Store = Record<string, PaceEntry>;

const CONFIG = config as Record<string, PaceEntry>;
const KIND_DEFAULT = { predict: 10000, write: 60000 } as const;

// A learner's personal target = median(their clean solve times) × this modifier.
export const PERSONAL_MODIFIER = 1.1;

// In-memory caches, hydrated from the server by loadPaces().
let personal: Store = {};
let trainer: Store = {};

export function kindDefaultMs(kind: 'predict' | 'write'): number {
  return kind === 'write' ? KIND_DEFAULT.write : KIND_DEFAULT.predict;
}

// --- content fingerprint -----------------------------------------------------

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// Whitespace-normalize so reformatting the generator doesn't change the hash,
// while real content edits do. Only whitespace: the generators embed code as
// strings, so stripping comments/blank lines could mask a real change.
function normalizeSource(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function patternHash(ex: Exercise): string {
  return hashString(
    [ex.kind, normalizeSource(ex.generator ?? ''), JSON.stringify(ex.banned ?? [])].join(' '),
  );
}

// --- server-backed store -----------------------------------------------------

/** Hydrate the in-memory pace caches from the data server. Call once at startup. */
export async function loadPaces(): Promise<void> {
  try {
    const res = await fetch(`${DATA_API_BASE}/pace`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return;
    const data = (await res.json()) as { personal?: Store; trainer?: Store };
    personal = data.personal ?? {};
    trainer = data.trainer ?? {};
  } catch {
    // Server down: caches stay empty (paces fall back to config/kind default).
  }
}

function putPace(scope: 'personal' | 'trainer', id: string, ms: number, hash: string): void {
  try {
    void fetch(`${DATA_API_BASE}/pace`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, id, ms: Math.round(ms), hash }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // best-effort
  }
}

/** Personal pace, but only if it was measured against the CURRENT content. */
export function readPersonalPace(id: string, hash: string): number | null {
  const e = personal[id];
  return e && e.hash === hash ? e.ms : null;
}
export function savePersonalPace(id: string, ms: number, hash: string): void {
  personal[id] = { ms: Math.round(ms), hash };
  putPace('personal', id, ms, hash);
}
export function saveTrainerPace(id: string, ms: number, hash: string): void {
  trainer[id] = { ms: Math.round(ms), hash };
  putPace('trainer', id, ms, hash);
}

/** The Python counterpart of a JS drill id (pacing is authored against Python). */
function pyCounterpartId(id: string): string | null {
  return id.startsWith('js.') ? `py.${id.slice(3)}` : null;
}

/** Shipped config pace, but only if its hash still matches the pattern. */
export function configPaceMs(id: string, hash: string): number | null {
  const e = CONFIG[id];
  if (e && typeof e.ms === 'number' && e.hash === hash) return e.ms;
  // Cross-language default: paces are authored against the Python drills, and a
  // JS drill with no entry of its own borrows its Python counterpart's timing
  // (the patterns are semantically equivalent). The stored hash is the Python
  // generator's, so it can't be checked against this exercise — this tier is a
  // default, not a verified pace. Add a js.* entry to tune per-language.
  const pyId = pyCounterpartId(id);
  if (pyId) {
    const c = CONFIG[pyId];
    if (c && typeof c.ms === 'number') return c.ms;
  }
  return null;
}

/** Resolved drill target: personal override > shipped config > kind default. */
export function resolvedTargetMs(id: string, kind: 'predict' | 'write', hash: string): number {
  return readPersonalPace(id, hash) ?? configPaceMs(id, hash) ?? kindDefaultMs(kind);
}

// --- trainer view: which patterns need pacing --------------------------------

export type PaceStatus = 'fresh' | 'dirty' | 'missing';

/** Status of the SHIPPED config entry for a pattern (what a trainer maintains). */
export function configStatus(ex: Exercise): PaceStatus {
  const e = CONFIG[ex.id];
  if (!e) return 'missing';
  return e.hash === patternHash(ex) ? 'fresh' : 'dirty';
}

/**
 * The portable pace config to export: the shipped config with every
 * trainer-locked pace merged over it. Paste into src/data/pace-targets.json
 * (or use "Save pace config" to write it directly).
 */
export function exportPaceConfig(): Record<string, PaceEntry> {
  const out: Record<string, PaceEntry> = { ...CONFIG };
  for (const [id, e] of Object.entries(trainer)) out[id] = { ms: Math.round(e.ms), hash: e.hash };
  return out;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
