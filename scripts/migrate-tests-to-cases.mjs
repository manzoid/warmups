#!/usr/bin/env node
// One-shot migrator: convert legacy `tests` strings into structured `cases`
// where the shape is unambiguous, so the runner can report the failing case and
// drive the visualizer with it. Conservative by design: anything it can't parse
// with confidence (shared setup, compound asserts, non-standard helpers) is left
// on legacy `tests`, which still works. The content validator is the safety net
// (the reference solution must pass every generated case), so a bad conversion
// fails loudly rather than shipping.
//
// Handles:
//   Python:  a tests block that is ONLY `assert CALL == VALUE[, msg]` and
//            `assert CALL is None[, msg]` lines (no setup/compound). Parsed with
//            the real Python `ast`, so nested commas/brackets are safe.
//   JS:      a tests block that is an optional `const eq = ...;` helper line
//            followed only by `eq(CALL, EXPECT);` lines. Balanced-paren parsed.
//
// Run: node scripts/migrate-tests-to-cases.mjs   (then `npm run validate`)

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- Python: parse a tests block into cases via ast, or null if not clean -----
const PY_HELPER = `
import sys, json, ast
def to_cases(src):
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return None
    cases = []
    for node in tree.body:
        if not isinstance(node, ast.Assert):
            return None            # a setup statement -> not clean
        t = node.test
        if not isinstance(t, ast.Compare) or len(t.ops) != 1:
            return None            # compound / not a single comparison
        op = t.ops[0]
        left = ast.unparse(t.left)
        if isinstance(op, ast.Eq):
            cases.append({"call": left, "expect": ast.unparse(t.comparators[0])})
        elif isinstance(op, ast.Is) and isinstance(t.comparators[0], ast.Constant) and t.comparators[0].value is None:
            cases.append({"call": left, "expect": "None"})
        else:
            return None
    return cases or None
data = json.load(sys.stdin)
print(json.dumps({k: to_cases(v) for k, v in data.items()}))
`;

function pythonCases(byId) {
  if (Object.keys(byId).length === 0) return {};
  const out = execFileSync('python3', ['-c', PY_HELPER], {
    input: JSON.stringify(byId),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
}

// --- JS: balanced-paren parse of an eq(...)-only tests block ------------------
function splitTopComma(s) {
  let depth = 0;
  let str = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (str) {
      if (c === str && s[i - 1] !== '\\') str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') str = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) return [s.slice(0, i).trim(), s.slice(i + 1).trim()];
  }
  return null;
}

// Read the balanced argument list starting right after `eq(`; returns [inner, endIndex].
function readCall(s, openIdx) {
  let depth = 0;
  let str = null;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (str) {
      if (c === str && s[i - 1] !== '\\') str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') str = c;
    else if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return [s.slice(openIdx + 1, i), i];
    }
  }
  return null;
}

function jsCases(tests) {
  // Strip a leading `const eq = ... ;` helper line if present.
  let body = tests;
  const eqDef = body.match(/const\s+eq\s*=\s*\([^)]*\)\s*=>\s*\{[^]*?\};/);
  if (eqDef) body = body.slice(0, eqDef.index) + body.slice(eqDef.index + eqDef[0].length);
  body = body.trim();
  if (!body) return null;

  const cases = [];
  let i = 0;
  while (i < body.length) {
    // skip whitespace and semicolons
    while (i < body.length && /[\s;]/.test(body[i])) i++;
    if (i >= body.length) break;
    if (!body.startsWith('eq(', i)) return null; // some other statement -> not clean
    const read = readCall(body, i + 2);
    if (!read) return null;
    const [inner, end] = read;
    const parts = splitTopComma(inner);
    if (!parts) return null;
    cases.push({ call: parts[0], expect: parts[1] });
    i = end + 1;
  }
  return cases.length ? cases : null;
}

// --- walk + apply ------------------------------------------------------------
function contentFiles() {
  const out = [];
  for (const track of ['python', 'javascript']) {
    const dir = join(ROOT, 'content', track);
    for (const f of readdirSync(dir)) if (f.endsWith('.json')) out.push(join(dir, f));
  }
  return out;
}

let migrated = 0;
let skipped = 0;

for (const file of contentFiles()) {
  const arr = JSON.parse(readFileSync(file, 'utf8'));
  const isPy = file.includes('/python/');

  // Gather this file's convertible python tests for a single batch call.
  const pyBatch = {};
  if (isPy) {
    for (const ex of arr) {
      if (ex.kind === 'write' && ex.tests && !ex.cases && !ex.generator) pyBatch[ex.id] = ex.tests;
    }
  }
  const pyResult = isPy ? pythonCases(pyBatch) : {};

  let changed = false;
  for (const ex of arr) {
    if (ex.kind !== 'write' || !ex.tests || ex.cases || ex.generator) continue;
    const cases = isPy ? pyResult[ex.id] : jsCases(ex.tests);
    if (!cases) {
      skipped++;
      continue;
    }
    delete ex.tests;
    ex.cases = cases;
    changed = true;
    migrated++;
  }
  if (changed) writeFileSync(file, JSON.stringify(arr, null, 2) + '\n');
}

console.log(`migrated ${migrated} write exercises to cases; left ${skipped} on legacy tests.`);
