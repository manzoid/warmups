#!/usr/bin/env node
// Headless self-test for src/ui/renderTrace.ts.
//
// renderTrace.ts uses a Vite `?raw` import for the codeviz viewer template,
// which plain node can't resolve. So we transform the TS to CommonJS with
// sucrase (same in-memory transform trick as scripts/validate-content.mjs) and
// feed it a custom `require` that returns the real template file contents for
// the `?raw` import. Then we assert traceToSrcdoc injects a sample trace JSON
// and leaves no unfilled markers behind.
//
// This does NOT run Pyodide (that's browser-only); it only exercises the pure
// string-templating in renderTrace.ts.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { transform } from 'sucrase';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const RENDER_TRACE = join(ROOT, 'src/ui/renderTrace.ts');
const TEMPLATE = join(ROOT, 'src/vendor/codeviz/viewer_template.html');

function loadRenderTrace() {
  const src = readFileSync(RENDER_TRACE, 'utf8');
  const { code } = transform(src, {
    transforms: ['typescript', 'imports'],
    disableESTransforms: true,
  });
  const templateSrc = readFileSync(TEMPLATE, 'utf8');
  const shimRequire = (spec) => {
    if (spec.includes('viewer_template.html')) {
      return { __esModule: true, default: templateSrc };
    }
    throw new Error(`unexpected require in renderTrace.ts: ${spec}`);
  };
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  const fn = new Function('module', 'exports', 'require', code);
  fn(module, module.exports, shimRequire);
  return module.exports;
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const { traceToSrcdoc } = loadRenderTrace();
assert(typeof traceToSrcdoc === 'function', 'traceToSrcdoc is exported as a function');

// A sample OPT-shaped trace. Includes a `</script>` sequence and a `$&` to
// verify both the </ escaping and that `$`-sequences are injected literally.
const sampleTrace = JSON.stringify({
  code: 'x = 1\nprint("</script> $& done")\n',
  trace: [
    { line: 1, event: 'step_line', func_name: '<module>', globals: {}, ordered_globals: [], stack_to_render: [], heap: {}, stdout: '' },
    { line: 2, event: 'step_line', func_name: '<module>', globals: { x: 1 }, ordered_globals: ['x'], stack_to_render: [], heap: {}, stdout: '' },
  ],
});

const html = traceToSrcdoc(sampleTrace, 'Warmup <b>&"\'</b>');

assert(!html.includes('__TRACE_JSON__'), 'no literal __TRACE_JSON__ marker remains');
assert(!html.includes('__TITLE__'), 'no literal __TITLE__ marker remains');

// The injected JSON must be present, with </ escaped to <\/ so no string
// literal in the trace can close the inline <script>.
const injected = sampleTrace.replace(/<\//g, '<\\/');
assert(html.includes(injected), 'escaped trace JSON is present in the output');
assert(!html.includes('</script> $& done'), 'raw </ sequence was escaped, not left intact');

// The `$&` from the trace must survive verbatim (function replacer, not a
// string replacement that would interpret `$&` as the whole match).
assert(html.includes('$& done'), 'literal $-sequence in the trace survived injection');

// Title is HTML-escaped in the <title> element.
assert(
  html.includes('Warmup &lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;'),
  'title is HTML-escaped',
);

// Sanity: the output is still a full HTML document.
assert(/<html[\s>]/i.test(html) && html.includes('const DATA ='), 'output is the full viewer document');

console.log('OK: renderTrace.ts traceToSrcdoc injects trace JSON and title correctly.');
