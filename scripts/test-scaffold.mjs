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
//   - renderTrace.traceToSrcdoc: injects an OPT-format trace JSON into codeviz's
//     offline viewer template and leaves no unfilled markers behind.
//   - walkthroughPrompt.buildWalkthroughPrompt: embeds the exercise prompt and
//     the learner's attempt, and never leaks the canonical answer
//     (ex.expected / ex.solution) into the tutor prompt.
//   - srs.gradeFor: an assisted attempt is a lapse ('again') even when it passed.

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
// 1. renderTrace.traceToSrcdoc
// ---------------------------------------------------------------------------

const { traceToSrcdoc } = loadTs(join(ROOT, 'src/ui/renderTrace.ts'));

// A sample OPT-shaped trace. It contains a `</script>` sequence and a `$&` so we
// also confirm the </ escaping and the literal $-sequence injection.
const sampleTrace = JSON.stringify({
  code: 'x = 1\nprint("</script> $& done")\n',
  trace: [
    { line: 1, event: 'step_line', func_name: '<module>', globals: {}, ordered_globals: [], stack_to_render: [], heap: {}, stdout: '' },
    { line: 2, event: 'step_line', func_name: '<module>', globals: { x: 1 }, ordered_globals: ['x'], stack_to_render: [], heap: {}, stdout: '' },
  ],
});

console.log('traceToSrcdoc:');
const html = traceToSrcdoc(sampleTrace, 'Warmup <b>&"\'</b>');
const injected = sampleTrace.replace(/<\//g, '<\\/');
check(html.includes(injected), 'the (</-escaped) trace JSON is present in the output');
check(!html.includes('__TRACE_JSON__'), 'no leftover __TRACE_JSON__ marker');
check(!html.includes('__TITLE__'), 'no leftover __TITLE__ marker');
check(!html.includes('</script> $& done'), 'raw </ sequence was escaped, not left intact');
check(html.includes('$& done'), 'literal $-sequence in the trace survived injection');
check(html.includes('Warmup &lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;'), 'title is HTML-escaped');
check(/<html[\s>]/i.test(html) && html.includes('const DATA ='), 'output is the full viewer document');

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

// write exercise: the reference solution must NOT appear anywhere in the prompt.
const writeEx = {
  id: 'py.secret',
  track: 'python',
  group: 'Functions',
  concept: 'Return a constant',
  kind: 'write',
  prompt: 'Write a function that returns 42.',
  solution: 'def secret_marker_9f3a(): return 42',
};
const writeOut = buildWalkthroughPrompt(writeEx, 'def f(): pass');
check(writeOut.includes('Write a function that returns 42.'), 'includes the write prompt');
check(writeOut.includes('def f(): pass'), "includes the learner's code attempt");
check(!writeOut.includes('def secret_marker_9f3a(): return 42'), 'never leaks ex.solution into the tutor prompt');
check(!writeOut.includes('secret_marker_9f3a'), 'no fragment of the solution leaks');

// empty attempt: no dangling empty code block.
const emptyOut = buildWalkthroughPrompt(predictEx, '   ');
check(/has not written anything yet/.test(emptyOut), 'handles an empty attempt gracefully');

// ---------------------------------------------------------------------------
// 3. srs.gradeFor — assisted attempts are lapses
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
check(gradeFor({ passed: true, assisted: false }) === 'good', 'unassisted pass → good');
check(gradeFor({ passed: false, assisted: false }) === 'again', 'unassisted fail → again');
check(gradeFor({ passed: true, assisted: true }) === 'again', 'assisted pass → again (still a lapse)');
check(gradeFor({ passed: false, assisted: true }) === 'again', 'assisted fail → again');

// ---------------------------------------------------------------------------

if (failures) {
  console.error(`\n${failures} scaffold test(s) failed.`);
  process.exit(1);
}
console.log('\nOK: scaffold helpers (traceToSrcdoc, buildWalkthroughPrompt, gradeFor) pass.');
