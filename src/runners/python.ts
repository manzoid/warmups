import type { Exercise, RunResult, Runner } from '../core/types';

// ---------------------------------------------------------------------------
// Pyodide loading (from the jsdelivr CDN — Pyodide is NOT an npm dependency).
// ---------------------------------------------------------------------------

// Pin a Pyodide version. The wasm/stdlib assets are fetched from the matching
// indexURL below.
const PYODIDE_VERSION = 'v0.28.3';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;

// Minimal structural type for the bits of the Pyodide API we use. Pyodide has
// no bundled TS types here (loaded from CDN at runtime), so we declare our own.
interface PyProxyDict {
  destroy(): void;
}
interface PyodideAPI {
  runPython(code: string, options?: { globals?: PyProxyDict }): unknown;
  runPythonAsync(code: string, options?: { globals?: PyProxyDict }): Promise<unknown>;
  globals: {
    get(name: string): unknown;
  };
  setStdout(options: { batched?: (s: string) => void; write?: (buf: Uint8Array) => number }): void;
  setStderr(options: { batched?: (s: string) => void; write?: (buf: Uint8Array) => number }): void;
}

type LoadPyodideFn = (options: { indexURL: string }) => Promise<PyodideAPI>;

declare global {
  // Injected onto window by the CDN pyodide.js script.
  // eslint-disable-next-line no-var
  var loadPyodide: LoadPyodideFn | undefined;
}

let pyodidePromise: Promise<PyodideAPI> | null = null;

/**
 * Inject the CDN pyodide.js script (once) so that `globalThis.loadPyodide`
 * becomes available. In a Web Worker context we fall back to importScripts.
 */
function ensurePyodideScript(): Promise<void> {
  if (typeof globalThis.loadPyodide === 'function') return Promise.resolve();

  // Web Worker: use importScripts (synchronous).
  if (typeof (globalThis as unknown as { importScripts?: unknown }).importScripts === 'function') {
    (globalThis as unknown as { importScripts: (url: string) => void }).importScripts(
      PYODIDE_SCRIPT_URL,
    );
    return Promise.resolve();
  }

  // Browser main thread: inject a <script> tag.
  return new Promise<void>((resolve, reject) => {
    const doc = (globalThis as unknown as { document?: Document }).document;
    if (!doc) {
      reject(new Error('No document available to load Pyodide script'));
      return;
    }
    const existing = doc.querySelector(`script[data-pyodide="${PYODIDE_VERSION}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Pyodide script')));
      return;
    }
    const script = doc.createElement('script');
    script.src = PYODIDE_SCRIPT_URL;
    script.async = true;
    script.dataset.pyodide = PYODIDE_VERSION;
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Failed to load Pyodide script')));
    doc.head.appendChild(script);
  });
}

/**
 * Lazy-load Pyodide exactly once and cache the instance. Safe to call
 * concurrently — all callers await the same promise.
 */
export async function initPyodide(): Promise<PyodideAPI> {
  if (pyodidePromise) return pyodidePromise;
  pyodidePromise = (async () => {
    await ensurePyodideScript();
    const load = globalThis.loadPyodide;
    if (typeof load !== 'function') {
      throw new Error('loadPyodide is not available after loading the Pyodide script');
    }
    return load({ indexURL: PYODIDE_INDEX_URL });
  })();
  return pyodidePromise;
}

// ---------------------------------------------------------------------------
// Grading helpers (pure — mirrored in the node harness for validation).
// ---------------------------------------------------------------------------

/**
 * Whitespace-normalize a predicted/expected value: trim ends and collapse any
 * run of internal whitespace (including newlines/tabs) to a single space.
 */
export function normalizeAnswer(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** Compare a learner's typed answer against the canonical expected string. */
export function predictPasses(userAnswer: string, expected: string): boolean {
  return normalizeAnswer(userAnswer) === normalizeAnswer(expected);
}

// ---------------------------------------------------------------------------
// Runner implementation.
// ---------------------------------------------------------------------------

/**
 * Create a fresh Python global namespace (a new dict) so exercises never leak
 * state between runs. Caller must destroy() it when finished.
 */
function freshNamespace(py: PyodideAPI): PyProxyDict {
  // `dict()` from Python builtins → a brand-new mapping usable as globals.
  const dictCtor = py.globals.get('dict') as unknown as () => PyProxyDict;
  return dictCtor();
}

async function runWrite(
  py: PyodideAPI,
  userCode: string,
  ex: Exercise,
): Promise<RunResult> {
  const ns = freshNamespace(py);
  let stdout = '';
  const capture = (s: string) => {
    stdout += s;
  };
  py.setStdout({ batched: capture });
  py.setStderr({ batched: capture });
  try {
    const program = `${userCode}\n\n${ex.tests ?? ''}\n`;
    await py.runPythonAsync(program, { globals: ns });
    return { passed: true, actual: stdout.length ? stdout : undefined };
  } catch (err) {
    return {
      passed: false,
      actual: stdout.length ? stdout : undefined,
      error: formatError(err),
    };
  } finally {
    py.setStdout({});
    py.setStderr({});
    ns.destroy();
  }
}

async function runPredict(
  py: PyodideAPI,
  userAnswer: string,
  ex: Exercise,
): Promise<RunResult> {
  const expected = ex.expected ?? '';
  let actual: string | undefined;

  // Optionally evaluate the snippet to compute/confirm the canonical value.
  if (ex.snippet) {
    const ns = freshNamespace(py);
    try {
      // Evaluate the snippet as an expression and repr() its value.
      const src = `__wu_val = (\n${ex.snippet}\n)\nrepr(__wu_val)`;
      const reprd = await py.runPythonAsync(src, { globals: ns });
      actual = typeof reprd === 'string' ? reprd : String(reprd);
    } catch {
      // Snippet may not be a bare expression; leave actual undefined and grade
      // purely on the learner's typed answer vs expected.
      actual = undefined;
    } finally {
      ns.destroy();
    }
  }

  return { passed: predictPasses(userAnswer, expected), actual };
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export const pythonRunner: Runner = {
  track: 'python',
  async run(userCode: string, ex: Exercise): Promise<RunResult> {
    const py = await initPyodide();
    if (ex.kind === 'predict') {
      return runPredict(py, userCode, ex);
    }
    return runWrite(py, userCode, ex);
  },
};

export default pythonRunner;
