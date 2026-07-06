#!/usr/bin/env node
// Offline, dependency-free tests for the Stage-2/3 scaffolding helpers.
//
// These modules are TypeScript with Vite-flavored imports (`?raw`), which plain
// node can't resolve. So we transform each module to CommonJS with sucrase (the
// same in-memory trick as scripts/validate-content.mjs) and feed it a custom
// `require` that: (a) returns the real asset file contents for any `?raw`
// import, and (b) resolves relative sibling TS imports by recursively loading
// them the same way. No bundler, no test runner, no network.
//
// Covered here:
//   - codevizApi.traceRequest: builds the POST /trace request (url + body) with
//     the right language extension per track.
//   - walkthroughPrompt.buildWalkthroughPrompt: embeds the exercise prompt and
//     the learner's attempt, and never leaks the canonical answer
//     (ex.expected / ex.solution) into the tutor prompt.
//   - srs.gradeFor: the deepest hint-ladder rung reached maps to a three-grade
//     FSRS signal (good / hard / again).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { transform } from 'sucrase';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- minimal TS module loader ----------------------------------------------

// Load a `.ts` module by absolute path, transforming it to CommonJS and giving
// it a `require` that handles `?raw` asset imports and relative TS siblings.
// Cache by resolved path so a diamond import graph loads each module once.
const moduleCache = new Map();

function loadTs(absPathNoExt) {
  const absPath = absPathNoExt.endsWith('.ts') ? absPathNoExt : `${absPathNoExt}.ts`;
  if (moduleCache.has(absPath)) return moduleCache.get(absPath);

  const src = readFileSync(absPath, 'utf8');
  const { code } = transform(src, {
    transforms: ['typescript', 'imports'],
    disableESTransforms: true,
  });

  const here = dirname(absPath);
  const shimRequire = (spec) => {
    // Vite `?raw` import → return the raw file contents as the default export.
    if (spec.endsWith('?raw')) {
      const rel = spec.slice(0, -'?raw'.length);
      const assetPath = resolve(here, rel);
      return { __esModule: true, default: readFileSync(assetPath, 'utf8') };
    }
    // Relative sibling import → recursively load as TS.
    if (spec.startsWith('.')) {
      return loadTs(resolve(here, spec));
    }
    // Type-only imports (e.g. '../core/types') are erased by sucrase; anything
    // else that survives is unexpected in these leaf modules.
    throw new Error(`unexpected require in ${absPath}: ${spec}`);
  };

  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'require', code);
  fn(module, module.exports, shimRequire);
  moduleCache.set(absPath, module.exports);
  return module.exports;
}

// --- assertion helpers ------------------------------------------------------

let failures = 0;
function check(cond, msg) {
  if (cond) {
    console.log(`  ok  ${msg}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// 1. codevizApi.traceRequest — the request sent to a local `codeviz api`
// ---------------------------------------------------------------------------

const { traceRequest, CODEVIZ_API_BASE } = loadTs(join(ROOT, 'src/ui/codevizApi.ts'));

console.log('traceRequest:');
const pyReq = traceRequest('xs = [1, 2]\n', 'python');
check(pyReq.url === `${CODEVIZ_API_BASE}/trace`, 'posts to <base>/trace');
check(JSON.parse(pyReq.body).lang === '.py', 'python → lang .py');
check(JSON.parse(pyReq.body).code === 'xs = [1, 2]\n', 'carries the code verbatim');
const jsReq = traceRequest('const xs = [1, 2];\n', 'javascript');
check(JSON.parse(jsReq.body).lang === '.js', 'javascript → lang .js');

// ---------------------------------------------------------------------------
// 2. walkthroughPrompt.buildWalkthroughPrompt
// ---------------------------------------------------------------------------

const { buildWalkthroughPrompt } = loadTs(join(ROOT, 'src/ui/walkthroughPrompt.ts'));

console.log('buildWalkthroughPrompt:');

// predict exercise: has an expected answer that must NOT leak.
const predictEx = {
  id: 'py.x',
  track: 'python',
  group: 'Dicts & counting',
  concept: 'Counter for frequencies',
  kind: 'predict',
  prompt: 'What does this evaluate to?',
  snippet: 'sum([1, 2, 3])',
  expected: '6',
};
const predictOut = buildWalkthroughPrompt(predictEx, '5');
check(predictOut.includes('What does this evaluate to?'), 'includes the exercise prompt');
check(predictOut.includes('Counter for frequencies') && predictOut.includes('Dicts & counting'), 'includes the concept and group');
check(predictOut.includes('5'), "includes the learner's attempt");
check(predictOut.includes('sum([1, 2, 3])'), 'includes the snippet the learner reasons about');
// The expected answer '6' is too short to test for absence reliably (it could
// occur incidentally); the write case below carries the real no-leak check.
check(/socratic/i.test(predictOut) && /do not reveal/i.test(predictOut), 'states the Socratic no-reveal rules');

// write exercise: the reference solution must NOT appear anywhere in the prompt,
// but the tests/spec and starter (which are the contract, not the answer) MUST.
const writeEx = {
  id: 'py.secret',
  track: 'python',
  group: 'Functions',
  concept: 'Return a constant',
  kind: 'write',
  prompt: 'Write a function that returns 42.',
  starter: 'def returns_42():\n    # your code here\n    pass',
  solution: 'def secret_marker_9f3a(): return 42',
  tests: 'assert returns_42() == 42, "spec_marker_7b2c"',
};
const writeOut = buildWalkthroughPrompt(writeEx, 'def f(): pass');
check(writeOut.includes('Write a function that returns 42.'), 'includes the write prompt');
check(writeOut.includes('def f(): pass'), "includes the learner's code attempt");
check(!writeOut.includes('def secret_marker_9f3a(): return 42'), 'never leaks ex.solution into the tutor prompt');
check(!writeOut.includes('secret_marker_9f3a'), 'no fragment of the solution leaks');
// The tests/spec ARE the contract (edge cases the prose leaves implicit) and must
// reach the tutor; they never contain ex.solution, so including them can't leak.
check(writeOut.includes('spec_marker_7b2c'), 'includes ex.tests (the spec) for a write exercise');
check(/spec|must satisfy|requirements/i.test(writeOut), 'labels the tests as the spec/requirements');
check(writeOut.includes('def returns_42():'), 'includes ex.starter (the required signature) for a write exercise');

// empty attempt: no dangling empty code block.
const emptyOut = buildWalkthroughPrompt(predictEx, '   ');
check(/has not written anything yet/.test(emptyOut), 'handles an empty attempt gracefully');

// ---------------------------------------------------------------------------
// 3. srs.gradeFor — ladder depth → three-grade FSRS signal
// ---------------------------------------------------------------------------
//
// srs.ts imports 'ts-fsrs' (a real npm dep, resolvable by plain node), so load
// it with a require that also handles bare package specifiers.

function loadTsWithNodeRequire(absPath) {
  const src = readFileSync(absPath, 'utf8');
  const { code } = transform(src, {
    transforms: ['typescript', 'imports'],
    disableESTransforms: true,
  });
  const module = { exports: {} };
  const fn = new Function('module', 'exports', 'require', code);
  fn(module, module.exports, nodeRequire);
  return module.exports;
}

const { createRequire } = await import('node:module');
const nodeRequire = createRequire(import.meta.url);

const { gradeFor } = loadTsWithNodeRequire(join(ROOT, 'src/core/srs.ts'));

console.log('gradeFor:');
// passed, no hint (rung 0) → good.
check(gradeFor({ passed: true, deepestRung: 0 }) === 'good', 'pass, rung 0 (attempt) → good');
// passed, cue/syntax (rungs 1-2) → hard: a nudge, repeats sooner but not a lapse.
check(gradeFor({ passed: true, deepestRung: 1 }) === 'hard', 'pass, rung 1 (cue) → hard');
check(gradeFor({ passed: true, deepestRung: 2 }) === 'hard', 'pass, rung 2 (syntax) → hard');
// passed, visualize/walkthrough/reveal (rungs 3-5) → again: a lapse.
check(gradeFor({ passed: true, deepestRung: 3 }) === 'again', 'pass, rung 3 (visualize) → again (lapse)');
check(gradeFor({ passed: true, deepestRung: 4 }) === 'again', 'pass, rung 4 (walkthrough) → again (lapse)');
check(gradeFor({ passed: true, deepestRung: 5 }) === 'again', 'pass, rung 5 (reveal) → again (lapse)');
// any fail → again regardless of rung.
check(gradeFor({ passed: false, deepestRung: 0 }) === 'again', 'fail, rung 0 → again');
check(gradeFor({ passed: false, deepestRung: 2 }) === 'again', 'fail, rung 2 → again');

// ---------------------------------------------------------------------------
// 4. banned.firstBanned — word-boundary ban matching
// ---------------------------------------------------------------------------

const { firstBanned } = loadTs(join(ROOT, 'src/core/banned.ts'));

console.log('firstBanned:');
check(firstBanned('return sum(a)', ['sum(']) === 'sum(', '"sum(" catches a bare sum( call');
check(firstBanned('def my_sum(a):\n    t=0', ['sum(']) === null, 'word-boundary: "sum(" does not trip on my_sum(');
check(firstBanned('x = a.sum(b)', ['sum(']) === null, 'word-boundary: "sum(" does not trip on a.sum(');
check(firstBanned('print(x)', ['int(']) === null, 'word-boundary: "int(" does not trip on print(');
check(firstBanned('x = int(y)', ['int(']) === 'int(', '"int(" catches a real int( call');
check(firstBanned('return s[::-1]', ['[::-1]']) === '[::-1]', 'symbol pattern [::-1] matched literally');
check(firstBanned('return sum(a)', [' sum(']) === ' sum(', 'legacy " sum(" pattern still works');
check(firstBanned('for x in a:\n    t += x', ['sum(', '.reduce']) === null, 'clean hand-written code is not flagged');

// ---------------------------------------------------------------------------

if (failures) {
  console.error(`\n${failures} scaffold test(s) failed.`);
  process.exit(1);
}
console.log('\nOK: scaffold helpers (traceRequest, buildWalkthroughPrompt, gradeFor, firstBanned) pass.');
