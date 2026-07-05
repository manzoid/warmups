// Client for a locally-running codeviz trace API (start it with `codeviz api`).
//
// Only the "Visualize my run" rung uses this. Running and grading exercises
// happens fully in-browser (Pyodide / the worker), so warmups stays usable
// offline; only visualization needs the companion process.

import type { Track } from '../core/types';

// Where the local codeviz API listens (see `codeviz api --port`). Change here if
// you run it on another port.
export const CODEVIZ_API_BASE = 'http://127.0.0.1:8930';

const LANG: Record<Track, string> = { python: '.py', javascript: '.js' };

/** The request codeviz's POST /trace expects. Pure, so it can be unit-tested. */
export function traceRequest(
  code: string,
  track: Track,
): { url: string; body: string } {
  return {
    url: `${CODEVIZ_API_BASE}/trace`,
    body: JSON.stringify({ code, lang: LANG[track] }),
  };
}

/** Thrown when codeviz isn't reachable (not running), as opposed to a trace error. */
export class CodevizUnavailable extends Error {}

/**
 * Trace `code` for `track` via the local codeviz API and return the
 * self-contained viewer HTML. Throws CodevizUnavailable if codeviz isn't
 * running, or Error with codeviz's message on a trace failure.
 */
export async function traceViaCodeviz(code: string, track: Track): Promise<string> {
  const { url, body } = traceRequest(code, track);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch {
    throw new CodevizUnavailable('codeviz is not running');
  }
  if (!res.ok) {
    let msg = `codeviz error (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) msg = j.error;
    } catch {
      /* keep the status-code message */
    }
    throw new Error(msg);
  }
  return res.text();
}
