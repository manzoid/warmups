#!/usr/bin/env node
// Prove the VENDORED Python tracer works — the same pg_logger.py that Pyodide
// runs in the browser (src/runners/pytrace.ts drives it identically).
//
// We run it through python3 here (offline, no npm deps, no Pyodide): put
// src/vendor/codeviz on sys.path, drive pg_logger exactly like
// codeviz/backends/python_backend.py does
//     exec_script_str_local(code, None, False, False, finalizer)
// with a finalizer that captures {"code": input_code, "trace": output_trace},
// json.dumps the result, and assert we get back a well-formed, non-empty
// OPT-format trace for a sample snippet.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VENDOR_DIR = join(ROOT, 'src/vendor/codeviz');

let failures = 0;
function check(cond, msg) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures += 1;
    console.error(`  FAIL ${msg}`);
  }
}

// Sanity: the vendored files exist and are the ones we expect to ship.
for (const f of ['pg_logger.py', 'pg_encoder.py']) {
  const exists = (() => {
    try {
      readFileSync(join(VENDOR_DIR, f));
      return true;
    } catch {
      return false;
    }
  })();
  check(exists, `vendored ${f} is present`);
}

// The driver mirrors src/runners/pytrace.ts. `WU_SNIPPET` carries the learner
// code so no quoting/escaping is needed on the shell side.
const driver = `
import os, sys, json
sys.path.insert(0, ${JSON.stringify(VENDOR_DIR)})
import pg_logger
captured = {}
def finalizer(input_code, output_trace):
    captured['data'] = {"code": input_code, "trace": output_trace}
    return ""
code = os.environ['WU_SNIPPET']
pg_logger.exec_script_str_local(code, None, False, False, finalizer)
sys.stdout.write(json.dumps(captured['data']))
`;

const snippet = 'total = 0\nfor i in range(3):\n    total += i\nprint(total)\n';

let out;
try {
  out = execFileSync('python3', ['-c', driver], {
    env: { ...process.env, WU_SNIPPET: snippet },
    encoding: 'utf8',
  });
} catch (e) {
  const detail = e.stderr && e.stderr.length ? String(e.stderr).trim() : e.message;
  console.error(`FAIL: vendored tracer raised under python3:\n${detail}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(out);
} catch (e) {
  console.error(`FAIL: tracer output was not valid JSON: ${e.message}`);
  process.exit(1);
}

console.log('vendored pg_logger trace:');
check(data.code === snippet, 'echoes the input code verbatim');
check(Array.isArray(data.trace) && data.trace.length > 0, 'produces a non-empty trace');

const step = data.trace[0];
check(step && typeof step.line === 'number', 'each step carries a line number');
check(step && typeof step.event === 'string', 'each step carries an event');
for (const key of ['globals', 'ordered_globals', 'stack_to_render', 'heap']) {
  check(step && key in step, `step has OPT field "${key}"`);
}

// The loop mutates `total`, so a later step must show it in globals.
const sawTotal = data.trace.some(
  (s) => s.globals && Object.prototype.hasOwnProperty.call(s.globals, 'total'),
);
check(sawTotal, 'a variable assigned by the snippet appears in the trace globals');

// The final snapshot should carry the printed output.
const sawStdout = data.trace.some((s) => typeof s.stdout === 'string' && s.stdout.includes('3'));
check(sawStdout, "the snippet's stdout is captured in the trace");

if (failures) {
  console.error(`\n${failures} pytrace test(s) failed.`);
  process.exit(1);
}
console.log('\nOK: vendored pg_logger.py traces a snippet under python3.');
