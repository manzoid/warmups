#!/usr/bin/env node
// Validate EVERY exercise in content/** by actually executing it.
//
//  - 'write'  : run `solution` + `tests` (python3 for python, node for
//               javascript, sucrase-transforming any TS) and assert it does
//               not throw / exits 0.
//  - 'predict': execute `snippet`, evaluate `expected` as an expression in the
//               same language, and assert the two VALUES are equal — the same
//               way the runners grade a learner's answer. Never a string
//               compare: this guarantees a learner who types `expected`
//               verbatim passes.
//
// Also checks structural invariants: unique ids and resolvable prereqs.
//
// Exits nonzero on the first category of failure, printing every offending
// exercise. Run via `npm run validate`.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual, inspect } from 'node:util';
import { transform } from 'sucrase';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'content');

// --- discover content files -------------------------------------------------

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

// Whitespace-normalize; used only for the textual hint-leak checks below,
// never for grading.
function normalize(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// --- per-track validators ---------------------------------------------------

async function validateJs(ex) {
  if (ex.kind === 'predict') {
    const js = transform(ex.snippet ?? '', {
      transforms: ['typescript'],
      disableESTransforms: true,
    }).code;
    // Indirect eval yields the completion value of the last expression.
    const value = (0, eval)(js);
    let want;
    try {
      want = (0, eval)(`(${ex.expected ?? ''})`);
    } catch (e) {
      return `"expected" is not an evaluable JS expression: ${e.message}`;
    }
    if (!isDeepStrictEqual(value, want)) {
      return `predict mismatch: expected ${JSON.stringify(
        ex.expected,
      )}, snippet evaluates to ${inspect(value)}`;
    }
    return null;
  }
  // write with structured cases: the reference solution must pass every case.
  if (Array.isArray(ex.cases) && ex.cases.length) {
    const tx = (s) =>
      transform(s ?? '', { transforms: ['typescript'], disableESTransforms: true }).code;
    for (const c of ex.cases) {
      const fn = new AsyncFunction(`${tx(ex.solution)}\n${c.setup ?? ''}\nreturn (${c.call});`);
      const actual = await fn();
      let ok;
      if (c.expect !== undefined) {
        const want = (0, eval)('(' + tx(c.expect) + ')');
        ok = isDeepStrictEqual(actual, want);
      } else {
        ok = Boolean(new Function('_', `return (${tx(c.check)});`)(actual));
      }
      if (!ok) {
        return `case failed: ${c.call} -> ${inspect(actual)}${
          c.expect !== undefined ? ` (expected ${c.expect})` : ''
        }`;
      }
    }
    return null;
  }

  // write
  const source = `${ex.solution ?? ''}\n;\n${ex.tests ?? ''}`;
  const js = transform(source, {
    transforms: ['typescript'],
    disableESTransforms: true,
  }).code;
  const fn = new AsyncFunction('console', js);
  await fn(console);
  return null;
}

function validatePy(ex) {
  if (ex.kind === 'predict') {
    // Mirrors the Pyodide runner's grading: exec the snippet's statements,
    // eval its trailing expression as ground truth, eval `expected` in a
    // clean namespace, compare the values with `==`.
    const driver = `
import os, ast, json, sys
src = os.environ['WU_SNIPPET']
expected_src = os.environ['WU_EXPECTED']
tree = ast.parse(src)
last = tree.body[-1] if tree.body else None
if not isinstance(last, ast.Expr):
    sys.stdout.write(json.dumps({"err": "predict snippet has no final expression to evaluate"}))
    sys.exit(0)
ns = {}
exec(compile(ast.Module(body=tree.body[:-1], type_ignores=[]), '<snippet>', 'exec'), ns)
val = eval(compile(ast.Expression(last.value), '<snippet>', 'eval'), ns)
try:
    want = eval(expected_src, {})
except Exception as e:
    sys.stdout.write(json.dumps({"err": '"expected" is not an evaluable Python expression: ' + repr(e)}))
    sys.exit(0)
if val == want:
    sys.stdout.write(json.dumps({"err": None}))
else:
    sys.stdout.write(json.dumps({"err": "predict mismatch: expected " + expected_src + ", snippet evaluates to " + repr(val)}))
`;
    const out = execFileSync('python3', ['-c', driver], {
      env: {
        ...process.env,
        WU_SNIPPET: ex.snippet ?? '',
        WU_EXPECTED: ex.expected ?? '',
      },
      encoding: 'utf8',
    });
    return JSON.parse(out).err;
  }
  // write with structured cases: the reference solution must pass every case.
  if (Array.isArray(ex.cases) && ex.cases.length) {
    const driver = `
import os, json
sol = os.environ['WU_SOL']
cases = json.loads(os.environ['WU_CASES'])
def eq(a, b):
    if isinstance(a, (list, tuple)) and isinstance(b, (list, tuple)):
        return len(a) == len(b) and all(eq(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        return set(a.keys()) == set(b.keys()) and all(eq(a[k], b[k]) for k in a)
    return a == b
code = compile(sol, '<sol>', 'exec')
err = None
for c in cases:
    ns = {}
    exec(code, ns)
    if c.get('setup'):
        exec(c['setup'], ns)
    actual = eval(c['call'], ns)
    if c.get('expect') is not None:
        ok = eq(actual, eval(c['expect'], ns))
    else:
        ns['_'] = actual
        ok = bool(eval(c['check'], ns))
    if not ok:
        err = 'case failed: ' + c['call'] + ' -> ' + repr(actual) + ((' (expected ' + c['expect'] + ')') if c.get('expect') else '')
        break
print(json.dumps({'err': err}))
`;
    const out = execFileSync('python3', ['-c', driver], {
      env: { ...process.env, WU_SOL: ex.solution ?? '', WU_CASES: JSON.stringify(ex.cases) },
      encoding: 'utf8',
    });
    return JSON.parse(out).err;
  }

  // write: solution + tests must run without raising (exit 0).
  const program = `${ex.solution ?? ''}\n\n${ex.tests ?? ''}\n`;
  execFileSync('python3', ['-c', program], { stdio: 'pipe' });
  return null;
}

// --- fluency generators -----------------------------------------------------
// A generator exercise has no static snippet/expected/tests; its `make()`
// produces a fresh instance each call. Validate by generating several instances
// and running each one through the normal per-track validator, so a generator
// that can emit an ungradable instance fails loudly.

const GEN_SAMPLES = 8;

function genJsInstances(ex, k) {
  const js = transform(`${ex.generator}\nreturn make();`, {
    transforms: ['typescript'],
    disableESTransforms: true,
  }).code;
  const fn = new Function(js);
  return Array.from({ length: k }, () => fn());
}

function genPyInstances(ex, k) {
  const driver = `
import os, json
${ex.generator}
print(json.dumps([make() for _ in range(int(os.environ['WU_K']))]))
`;
  const out = execFileSync('python3', ['-c', driver], {
    env: { ...process.env, WU_K: String(k) },
    encoding: 'utf8',
  });
  return JSON.parse(out);
}

async function validateGenerator(ex) {
  const instances =
    ex.track === 'python'
      ? genPyInstances(ex, GEN_SAMPLES)
      : genJsInstances(ex, GEN_SAMPLES);
  for (let i = 0; i < instances.length; i++) {
    const inst = instances[i];
    // Build the concrete exercise the runner would see for this instance.
    const trial = { ...ex, ...inst, generator: undefined };
    // A write instance's own solution must not trip its per-instance ban list.
    if (trial.kind === 'write' && Array.isArray(trial.banned)) {
      const sol = typeof trial.solution === 'string' ? trial.solution : '';
      for (const b of trial.banned) {
        if (b && sol.includes(b)) {
          return `instance ${i} solution contains its own banned token "${b}"`;
        }
      }
    }
    const err =
      ex.track === 'python' ? validatePy(trial) : await validateJs(trial);
    if (err) return `instance ${i}: ${err}`;
  }
  return null;
}

// --- main -------------------------------------------------------------------

async function main() {
  const files = walk(CONTENT_DIR).sort();
  const all = [];
  for (const file of files) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      console.error(`FAIL parse ${relative(ROOT, file)}: ${e.message}`);
      process.exit(1);
    }
    if (!Array.isArray(parsed)) {
      console.error(`FAIL ${relative(ROOT, file)}: expected a JSON array`);
      process.exit(1);
    }
    for (const ex of parsed) all.push({ ex, file });
  }

  const failures = [];

  // Structural: unique ids + resolvable prereqs.
  const ids = new Set();
  for (const { ex, file } of all) {
    if (ids.has(ex.id))
      failures.push(`${ex.id} (${relative(ROOT, file)}): duplicate id`);
    ids.add(ex.id);
  }
  for (const { ex, file } of all) {
    for (const p of ex.prereqs ?? []) {
      if (!ids.has(p))
        failures.push(
          `${ex.id} (${relative(ROOT, file)}): prereq "${p}" does not exist`,
        );
    }
  }

  // Structural: hint rungs (cue/syntax), if present, must be non-empty and
  // must not leak the answer. For predict, neither may equal `expected`; for
  // write, neither may contain `solution` as a substring.
  for (const { ex, file } of all) {
    const where = `${ex.id} (${relative(ROOT, file)})`;
    for (const rung of ['cue', 'syntax']) {
      const hint = ex[rung];
      if (hint === undefined) continue;
      if (typeof hint !== 'string' || hint.trim() === '') {
        failures.push(`${where}: ${rung} must be a non-empty string`);
        continue;
      }
      if (ex.kind === 'predict' && normalize(hint) === normalize(ex.expected ?? '')) {
        failures.push(`${where}: ${rung} leaks the answer (equals "expected")`);
      }
      if (
        ex.kind === 'write' &&
        typeof ex.solution === 'string' &&
        ex.solution.length > 0 &&
        hint.includes(ex.solution)
      ) {
        failures.push(`${where}: ${rung} leaks the answer (contains "solution")`);
      }
    }
  }

  // Structural: a write's own reference solution must not trip its 'banned'
  // list (else the exercise is unsolvable as authored / the enforcement is wrong).
  for (const { ex, file } of all) {
    if (ex.kind !== 'write' || !Array.isArray(ex.banned)) continue;
    const sol = typeof ex.solution === 'string' ? ex.solution : '';
    for (const b of ex.banned) {
      if (b && sol.includes(b)) {
        failures.push(
          `${ex.id} (${relative(ROOT, file)}): reference solution contains its own banned token "${b}"`,
        );
      }
    }
  }

  // Execution.
  for (const { ex, file } of all) {
    const where = `${ex.id} (${relative(ROOT, file)})`;
    try {
      let err = null;
      if (ex.generator !== undefined) err = await validateGenerator(ex);
      else if (ex.track === 'python') err = validatePy(ex);
      else if (ex.track === 'javascript') err = await validateJs(ex);
      else err = `unknown track "${ex.track}"`;
      if (err) failures.push(`${where}: ${err}`);
    } catch (e) {
      const msg =
        e.stderr && e.stderr.length
          ? String(e.stderr).trim().split('\n').slice(-3).join(' | ')
          : e.message;
      failures.push(`${where}: ${msg}`);
    }
  }

  const byTrack = {};
  for (const { ex } of all) byTrack[ex.track] = (byTrack[ex.track] ?? 0) + 1;

  if (failures.length) {
    console.error(`\n${failures.length} content failure(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    `OK: ${all.length} exercises validated (` +
      Object.entries(byTrack)
        .map(([t, n]) => `${t}: ${n}`)
        .join(', ') +
      `).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
