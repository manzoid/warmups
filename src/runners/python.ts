import type { Exercise, GeneratedInstance, RunResult, Runner } from '../core/types';
import { firstBanned, bannedMessage } from '../core/banned';

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
export interface PyodideAPI {
  runPython(code: string, options?: { globals?: PyProxyDict }): unknown;
  runPythonAsync(code: string, options?: { globals?: PyProxyDict }): Promise<unknown>;
  globals: {
    get(name: string): unknown;
  };
  setStdout(options: { batched?: (s: string) => void; write?: (buf: Uint8Array) => number }): void;
  setStderr(options: { batched?: (s: string) => void; write?: (buf: Uint8Array) => number }): void;
  // Emscripten virtual filesystem. Used to write the vendored codeviz tracer
  // modules so they can be `import`ed inside the Pyodide runtime.
  FS: {
    writeFile(path: string, data: string | Uint8Array, opts?: { encoding?: 'utf8' }): void;
    mkdirTree(path: string): void;
  };
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
  const banned = firstBanned(userCode, ex.banned);
  if (banned) return { passed: false, error: bannedMessage(banned) };
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
  // Grade by VALUE, never by string: run the snippet's statements, evaluate its
  // trailing expression as the ground truth, evaluate the learner's typed
  // answer, and compare with Python `==`. So `{'a':1,'b':2}` and
  // `{'a': 1, 'b': 2}` are equal and dict/set order doesn't matter, while
  // strings that legitimately contain spaces still compare correctly.
  const ns = freshNamespace(py);
  try {
    const src = `
import ast as __wu_ast, json as __wu_json

__wu_tree = __wu_ast.parse(${JSON.stringify(ex.snippet ?? '')})
if not (__wu_tree.body and isinstance(__wu_tree.body[-1], __wu_ast.Expr)):
    raise SyntaxError("predict snippet has no trailing expression to evaluate")
__wu_last = __wu_tree.body.pop()
__wu_ns = {}
exec(compile(__wu_tree, "<snippet>", "exec"), __wu_ns)
__wu_actual = eval(compile(__wu_ast.Expression(__wu_last.value), "<snippet>", "eval"), __wu_ns)

# The learner's answer evaluates in a CLEAN namespace, so typing a variable
# name from the snippet (e.g. \`out\`) can't accidentally pass.
try:
    __wu_user = eval(${JSON.stringify(userAnswer)}, {})
    __wu_passed = bool(__wu_user == __wu_actual)
    # Bracket-forgiving fallback: a learner who types a bare "2, 3, 4" for an
    # expected list [2, 3, 4] gets a tuple, which != the list. Accept it when the
    # element sequence matches, so a right value isn't failed on bracket style.
    if not __wu_passed and isinstance(__wu_user, tuple) and isinstance(__wu_actual, list):
        __wu_passed = list(__wu_user) == __wu_actual
except Exception:
    # Bare-token fallback: if the value is a string and the learner typed an
    # unquoted token (e.g. bcd instead of 'bcd'), eval raises NameError. Accept
    # the raw text as the string so a right value isn't failed on quoting.
    __wu_passed = isinstance(__wu_actual, str) and ${JSON.stringify(userAnswer)}.strip() == __wu_actual
__wu_json.dumps({"passed": __wu_passed, "actual": repr(__wu_actual)})
`;
    const out = await py.runPythonAsync(src, { globals: ns });
    const parsed = JSON.parse(typeof out === 'string' ? out : String(out)) as {
      passed: boolean;
      actual: string;
    };
    return { passed: parsed.passed, actual: parsed.actual };
  } catch (err) {
    // The snippet itself failed to parse or run — a content bug, not a wrong
    // answer. Surface it instead of guessing.
    return { passed: false, error: formatError(err) };
  } finally {
    ns.destroy();
  }
}

/**
 * Pyodide surfaces a Python exception as a full traceback whose frames are all
 * internal (`_pyodide/_base.py`, `<exec>`) with misleading line numbers — ugly
 * and unhelpful. Keep just the final `ExceptionType: message` line, which is the
 * useful signal (e.g. `AssertionError: 6` when a test fails).
 */
function cleanTraceback(raw: string): string {
  const lines = raw
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.length > 0);
  if (lines.length === 0) return raw.trim();
  return lines[lines.length - 1];
}

function formatError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return cleanTraceback(raw);
}

// Run a generator (trusted content code defining `make()`) and JSON-round-trip
// the fresh instance it returns.
async function runGenerate(
  py: PyodideAPI,
  ex: Exercise,
): Promise<GeneratedInstance> {
  const ns = freshNamespace(py);
  let stdout = '';
  py.setStdout({
    batched: (s) => {
      stdout += s;
    },
  });
  try {
    await py.runPythonAsync(
      `${ex.generator ?? ''}\nimport json as __wu_json\nprint(__wu_json.dumps(make()))`,
      { globals: ns },
    );
    return JSON.parse(stdout.trim()) as GeneratedInstance;
  } finally {
    py.setStdout({});
    ns.destroy();
  }
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
  async generate(ex: Exercise): Promise<GeneratedInstance> {
    const py = await initPyodide();
    return runGenerate(py, ex);
  },
};

export default pythonRunner;
