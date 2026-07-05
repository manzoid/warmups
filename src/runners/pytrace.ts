// Python live-trace plumbing.
//
// Runs learner Python code through the vendored Online Python Tutor tracer
// (pg_logger, driven exactly as codeviz's python_backend does) inside the same
// Pyodide runtime the grading runner uses, and returns an OPT-format trace as a
// JSON string. The trace is rendered offline by ui/renderTrace.ts.

import { initPyodide, type PyodideAPI } from './python';
// Vendored codeviz tracer sources, imported as raw strings (Vite `?raw`).
// pg_logger imports pg_encoder, so both must be present on sys.path.
import pgLoggerSrc from '../vendor/codeviz/pg_logger.py?raw';
import pgEncoderSrc from '../vendor/codeviz/pg_encoder.py?raw';

// Directory inside the Pyodide (Emscripten) virtual FS where we drop the tracer
// modules. Kept off the default cwd to avoid colliding with learner code.
const VENDOR_DIR = '/warmups_vendor';

// Guard so the FS writes + sys.path wiring happen exactly once per Pyodide
// singleton (the instance persists across calls, so its FS does too).
let tracerReady: Promise<void> | null = null;

function ensureTracer(py: PyodideAPI): Promise<void> {
  if (tracerReady) return tracerReady;
  tracerReady = (async () => {
    py.FS.mkdirTree(VENDOR_DIR);
    // Encoder first — pg_logger imports it at module load.
    py.FS.writeFile(`${VENDOR_DIR}/pg_encoder.py`, pgEncoderSrc, { encoding: 'utf8' });
    py.FS.writeFile(`${VENDOR_DIR}/pg_logger.py`, pgLoggerSrc, { encoding: 'utf8' });
    // Put the vendor dir on sys.path and warm the import so the first real
    // trace call doesn't pay the import cost.
    py.runPython(
      `import sys\n` +
        `if ${JSON.stringify(VENDOR_DIR)} not in sys.path:\n` +
        `    sys.path.insert(0, ${JSON.stringify(VENDOR_DIR)})\n` +
        `import pg_logger\n`,
    );
  })();
  return tracerReady;
}

/**
 * Trace `userCode` and return an OPT-format trace as a JSON string, of shape
 * `{"code": <src>, "trace": [ {line, event, func_name, globals, ...}, ... ]}`.
 * Suitable for feeding straight into `traceToSrcdoc`.
 *
 * Throws with the underlying error text if the tracer machinery itself fails.
 * (Errors in the *learner's* code are captured inside the trace, not thrown.)
 */
export async function tracePython(userCode: string): Promise<string> {
  const py = await initPyodide();
  await ensureTracer(py);

  // Drive pg_logger exactly like codeviz/backends/python_backend.py:
  //   exec_script_str_local(code, None, False, False, finalizer)
  // and json.dumps the captured {code, trace} dict as the final expression so
  // it comes back to JS as a string. stdout/stderr are redirected inside Python
  // so learner prints (and pg_logger's internal traceback noise) never leak to
  // the page's console.
  const driver =
    `import json as __wu_json, io as __wu_io, contextlib as __wu_ctx\n` +
    `import pg_logger as __wu_pg\n` +
    `__wu_code = ${JSON.stringify(userCode)}\n` +
    `__wu_captured = {}\n` +
    `def __wu_finalizer(input_code, output_trace):\n` +
    `    __wu_captured['data'] = {"code": input_code, "trace": output_trace}\n` +
    `    return ""\n` +
    `with __wu_ctx.redirect_stdout(__wu_io.StringIO()), __wu_ctx.redirect_stderr(__wu_io.StringIO()):\n` +
    `    __wu_pg.exec_script_str_local(__wu_code, None, False, False, __wu_finalizer)\n` +
    `__wu_json.dumps(__wu_captured['data'])\n`;

  try {
    const out = await py.runPythonAsync(driver);
    return typeof out === 'string' ? out : String(out);
  } catch (err) {
    throw new Error(`Python trace failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export default tracePython;
