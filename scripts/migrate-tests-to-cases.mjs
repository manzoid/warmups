#!/usr/bin/env node
// Migrate legacy `tests` strings into structured `cases`. Deterministic and
// validator-gated (the reference solution must pass every generated case, so a
// bad conversion fails loudly rather than shipping).
//
//   Python  (via the real ast):
//     - simple: assert CALL == VALUE / assert CALL is None|True|False
//                 -> { call, expect }  (a clean worked example)
//     - complex/stateful (shared setup, compound `and`, in-place mutation):
//                 -> { setup: <cumulative non-assert statements>, call: "None",
//                      check: <the assert condition> }
//   JavaScript (balanced-paren parse of the two throw shapes):
//     - if (JSON.stringify(CALL) !== JSON.stringify(EXPECT)) throw ...
//     - if (!eq(CALL, EXPECT)) throw ...        (JSON.stringify-based eq helper)
//     - if (CALL !== VALUE) throw ...
//                 -> { call, expect }
//
// Anything it can't parse confidently is left on legacy `tests`. Run:
//   node scripts/migrate-tests-to-cases.mjs   (then `npm run validate`)

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- Python via ast ----------------------------------------------------------
const PY_HELPER = `
import sys, json, ast

def simple_case(a):
    t = a.test
    if isinstance(t, ast.Compare) and len(t.ops) == 1:
        op = t.ops[0]; left = ast.unparse(t.left); right = t.comparators[0]
        if isinstance(op, ast.Eq):
            return {"call": left, "expect": ast.unparse(right)}
        if isinstance(op, ast.Is) and isinstance(right, ast.Constant):
            if right.value is None:  return {"call": left, "expect": "None"}
            if right.value is True:  return {"call": left, "expect": "True"}
            if right.value is False: return {"call": left, "expect": "False"}
    return None

def to_cases(src):
    try:
        tree = ast.parse(src)
    except SyntaxError:
        return None
    body = tree.body
    if not body or not any(isinstance(n, ast.Assert) for n in body):
        return None
    has_setup = any(not isinstance(n, ast.Assert) for n in body)
    if not has_setup:
        cases = []
        for n in body:
            if not isinstance(n, ast.Assert):
                return None
            c = simple_case(n)
            cases.append(c if c is not None else {"call": "None", "check": ast.unparse(n.test)})
        return cases or None
    # stateful: cumulative setup statements, condition as a check. But if any
    # assert's condition contains a CALL (e.g. q.dequeue()), it may mutate state
    # that later asserts depend on; splitting into independent cases would lose
    # that ordering, so leave the whole block on legacy tests.
    for n in body:
        if isinstance(n, ast.Assert) and any(isinstance(x, ast.Call) for x in ast.walk(n.test)):
            return None
    cases = []
    setup = []
    for n in body:
        if isinstance(n, ast.Assert):
            cases.append({"setup": "\\n".join(setup), "call": "None", "check": ast.unparse(n.test)})
        else:
            setup.append(ast.unparse(n))
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

// --- JavaScript balanced-paren parsing --------------------------------------
function splitTopLevel(s, op) {
  let depth = 0;
  let str = null;
  for (let i = 0; i <= s.length - op.length; i++) {
    const c = s[i];
    if (str) {
      if (c === str && s[i - 1] !== '\\') str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') str = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && s.startsWith(op, i)) return [s.slice(0, i).trim(), s.slice(i + op.length).trim()];
  }
  return null;
}

function splitTopComma(s) {
  return splitTopLevel(s, ',');
}

// Read a balanced (...) starting at the index of '('; returns [inner, endIndex].
function readParen(s, openIdx) {
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

function unwrapStringify(e) {
  const t = e.trim();
  if (t.startsWith('JSON.stringify(')) {
    const r = readParen(t, t.indexOf('('));
    if (r && r[1] === t.length - 1) return r[0].trim();
  }
  return null;
}

// Parse an if-condition into { call, expect }, or null if we don't recognize it.
function parseCond(cond) {
  const c = cond.trim();
  if (c.startsWith('!eq(')) {
    const r = readParen(c, c.indexOf('('));
    if (!r || r[1] !== c.length - 1) return null;
    const parts = splitTopComma(r[0]);
    return parts ? { call: parts[0], expect: parts[1] } : null;
  }
  const neq = splitTopLevel(c, '!==') || splitTopLevel(c, '!=');
  if (!neq) return null;
  const la = unwrapStringify(neq[0]);
  const rb = unwrapStringify(neq[1]);
  if (la != null && rb != null) return { call: la, expect: rb };
  if (la == null && rb == null) return { call: neq[0], expect: neq[1] };
  return null;
}

// Split a block into top-level statements (by depth-0 `;`).
function splitStatements(s) {
  const out = [];
  let depth = 0;
  let str = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (str) {
      if (c === str && s[i - 1] !== '\\') str = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') str = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ';' && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}

function jsCases(tests) {
  let body = tests;
  // A `const eq = ... JSON.stringify ...;` helper is fine (we treat !eq(a,b) as
  // a deep compare); strip it. ANY other statement means setup/state/custom
  // helpers, so we bail and leave the exercise on legacy tests.
  const eqDef = body.match(/const\s+eq\s*=\s*[^;]*;/);
  if (eqDef && /JSON\.stringify/.test(eqDef[0])) body = body.replace(eqDef[0], '');

  const stmts = splitStatements(body);
  if (stmts.length === 0) return null;
  const cases = [];
  for (const stmt of stmts) {
    if (!/^if[\s(]/.test(stmt)) return null; // not an if(...) throw -> bail
    const p = stmt.indexOf('(');
    if (p < 0) return null;
    const r = readParen(stmt, p);
    if (!r) return null;
    if (!stmt.slice(r[1] + 1).trimStart().startsWith('throw')) return null;
    const parsed = parseCond(r[0]);
    if (!parsed) return null;
    cases.push(parsed);
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
    let cases = null;
    try {
      cases = isPy ? pyResult[ex.id] : jsCases(ex.tests);
    } catch {
      cases = null;
    }
    if (!cases || cases.length === 0) {
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
