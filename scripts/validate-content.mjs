#!/usr/bin/env node
// Validate EVERY exercise in content/** by actually executing it.
//
//  - 'write'  : run `solution` + `tests` (python3 for python, node for
//               javascript, sucrase-transforming any TS) and assert it does
//               not throw / exits 0.
//  - 'predict': evaluate `snippet` and assert its stringified value equals
//               `expected` (whitespace-normalized).
//
// Also checks structural invariants: unique ids and resolvable prereqs.
//
// Exits nonzero on the first category of failure, printing every offending
// exercise. Run via `npm run validate`.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
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

// --- value stringification for 'predict' ------------------------------------

// Whitespace-normalize: collapse internal whitespace runs to a single space and
// trim. Matches the runners' grading normalization.
function normalize(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

// Render a JS value the way the content `expected` strings are written:
// a top-level string is emitted raw (no quotes); everything else uses a
// JSON-ish form with ", " / ": " separators.
function fmt(value) {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'bigint':
      return `${value}n`;
    case 'number':
    case 'boolean':
    case 'symbol':
      return String(value);
    case 'undefined':
      return 'undefined';
  }
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(fmt).join(', ')}]`;
  if (value instanceof Map)
    return `Map(${value.size}) {${[...value.entries()]
      .map(([k, v]) => `${fmt(k)} => ${fmt(v)}`)
      .join(', ')}}`;
  if (value instanceof Set)
    return `Set(${value.size}) {${[...value.values()].map(fmt).join(', ')}}`;
  if (typeof value === 'object')
    return `{${Object.entries(value)
      .map(([k, v]) => `${k}: ${fmt(v)}`)
      .join(', ')}}`;
  return String(value);
}

function stringifyTopLevel(value) {
  // Learners type strings without surrounding quotes, so render a top-level
  // string raw; nested values keep their quoted/structured form.
  return typeof value === 'string' ? value : fmt(value);
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
    const got = normalize(stringifyTopLevel(value));
    const want = normalize(ex.expected ?? '');
    if (got !== want) {
      return `predict mismatch: expected ${JSON.stringify(
        want,
      )}, got ${JSON.stringify(got)}`;
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
    const driver = `
import os, ast, sys
src = os.environ['WU_SNIPPET']
tree = ast.parse(src)
ns = {}
last = tree.body[-1] if tree.body else None
if isinstance(last, ast.Expr):
    body = ast.Module(body=tree.body[:-1], type_ignores=[])
    exec(compile(body, '<snippet>', 'exec'), ns)
    val = eval(compile(ast.Expression(last.value), '<snippet>', 'eval'), ns)
    sys.stdout.write(repr(val))
else:
    exec(compile(tree, '<snippet>', 'exec'), ns)
    sys.stdout.write('__WU_NO_EXPR__')
`;
    const out = execFileSync('python3', ['-c', driver], {
      env: { ...process.env, WU_SNIPPET: ex.snippet ?? '' },
      encoding: 'utf8',
    });
    if (out === '__WU_NO_EXPR__') {
      return `predict snippet has no final expression to evaluate`;
    }
    const got = normalize(out);
    const want = normalize(ex.expected ?? '');
    if (got !== want) {
      return `predict mismatch: expected ${JSON.stringify(
        want,
      )}, got ${JSON.stringify(got)}`;
    }
    return null;
  }
  // write: solution + tests must run without raising (exit 0).
  const program = `${ex.solution ?? ''}\n\n${ex.tests ?? ''}\n`;
  execFileSync('python3', ['-c', program], { stdio: 'pipe' });
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

  // Execution.
  for (const { ex, file } of all) {
    const where = `${ex.id} (${relative(ROOT, file)})`;
    try {
      let err = null;
      if (ex.track === 'python') err = validatePy(ex);
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
