// Small durable UI preferences (e.g. "experienced" mode, "seen the
// skip-to-first-write shortcut"). Server-backed like paces, not localStorage —
// loadPrefs() hydrates an in-memory cache at startup; reads are synchronous off
// it, writes update it and PUT to the server.

import { DATA_API_BASE } from './storage';

let cache: Record<string, string> = {};

export async function loadPrefs(): Promise<void> {
  try {
    const res = await fetch(`${DATA_API_BASE}/prefs`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return;
    cache = (await res.json()) as Record<string, string>;
  } catch {
    // server down: prefs fall back to their defaults
  }
}

export function getPref(key: string): string | null {
  return key in cache ? cache[key] : null;
}

/** Boolean convenience: true only when the stored value is '1'. */
export function getFlagPref(key: string): boolean {
  return cache[key] === '1';
}

export function setPref(key: string, value: string): void {
  cache[key] = value;
  try {
    void fetch(`${DATA_API_BASE}/prefs`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    // best-effort
  }
}
