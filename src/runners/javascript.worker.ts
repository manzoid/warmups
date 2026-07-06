// JavaScript/TypeScript exercise worker.
//
// Runs learner code in an isolated Web Worker so a runaway loop can't hang the
// UI (the main-thread runner terminates this worker on timeout). TypeScript is
// stripped to plain JS with sucrase before execution — no type-checking, just
// like Babel/esbuild's transpile-only mode.
//
// The pure grading logic (transformCode / runExercise) is exported so it can be
// unit-tested headlessly in node; the `self.onmessage` wiring at the bottom only
// activates inside an actual worker.

import { transform } from 'sucrase';
import type { Exercise, RunResult } from '../core/types';
import { firstBanned, bannedMessage } from '../core/banned';

// `new AsyncFunction(...)` lets learner code and tests use top-level `await`.
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as
  new (...args: string[]) => (...args: unknown[]) => Promise<unknown>;

/** Strip TypeScript types, leaving executable JS. Plain JS passes through. */
export function transformCode(code: string): string {
  return transform(code, {
    transforms: ['typescript'],
    // Keep it forgiving: don't choke on a stray `export`/`import` in a snippet.
    disableESTransforms: true,
  }).code;
}

/** Readable, JSON-ish rendering of a snippet's resulting value. */
export function stringifyValue(value: unknown, seen = new WeakSet<object>()): string {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'bigint':
      return `${value}n`;
    case 'function':
      return `[Function${value.name ? `: ${value.name}` : ''}]`;
    case 'undefined':
      return 'undefined';
    case 'number':
    case 'boolean':
    case 'symbol':
      return String(value);
  }
  if (value === null) return 'null';
  if (typeof value === 'object') {
    const obj = value as object;
    if (seen.has(obj)) return '[Circular]';
    seen.add(obj);
    try {
      if (Array.isArray(value)) {
        return `[${value.map((v) => stringifyValue(v, seen)).join(', ')}]`;
      }
      if (value instanceof Map) {
        const entries = [...value.entries()].map(
          ([k, v]) => `${stringifyValue(k, seen)} => ${stringifyValue(v, seen)}`,
        );
        return `Map(${value.size}) {${entries.length ? ` ${entries.join(', ')} ` : ''}}`;
      }
      if (value instanceof Set) {
        const items = [...value.values()].map((v) => stringifyValue(v, seen));
        return `Set(${value.size}) {${items.length ? ` ${items.join(', ')} ` : ''}}`;
      }
      const entries = Object.entries(obj).map(
        ([k, v]) => `${k}: ${stringifyValue(v, seen)}`,
      );
      return `{${entries.length ? ` ${entries.join(', ')} ` : ''}}`;
    } finally {
      seen.delete(obj);
    }
  }
  return String(value);
}

function formatLogArg(a: unknown): string {
  return typeof a === 'string' ? a : stringifyValue(a);
}

/** Structural equality for value-based `predict` grading (primitives, arrays, plain objects, Map, Set). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, (b as unknown[])[i]));
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map) || !(b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set) || !(b instanceof Set) || a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqual(ao[k], bo[k]));
}

/**
 * Grade one exercise against the learner's input.
 *  - 'write':  run userCode + ex.tests; pass = nothing thrown. console.* captured.
 *  - 'predict': eval ex.snippet (ground truth) and the typed answer (userCode),
 *               then deep-compare the VALUES. Never a string compare.
 */
export async function runExercise(ex: Exercise, userCode: string): Promise<RunResult> {
  if (ex.kind === 'predict') {
    // Grade by VALUE, never by string: eval the snippet (ground truth) and the
    // learner's answer, then deep-compare — so `{a: 1}` == `{ a: 1 }` and
    // Map/Set entry order never matters, while strings that legitimately
    // contain spaces still compare correctly.
    let actualValue: unknown;
    try {
      actualValue = (0, eval)(transformCode(ex.snippet ?? ''));
    } catch (err) {
      // The snippet itself failed to run — a content bug, not a wrong answer.
      return {
        passed: false,
        error: `snippet failed to evaluate: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    let passed = false;
    try {
      const userValue = (0, eval)('(' + userCode + ')');
      passed = deepEqual(userValue, actualValue);
    } catch {
      // Bare-token fallback: when the value is a string and the learner typed an
      // unquoted token (e.g. `bcd` instead of `'bcd'`), the eval throws a
      // ReferenceError. Accept the raw text as the string so a correct value is
      // never marked wrong on a quoting technicality.
      passed = typeof actualValue === 'string' && userCode.trim() === actualValue;
    }
    return { passed, actual: stringifyValue(actualValue) };
  }

  // kind === 'write'
  const banned = firstBanned(userCode, ex.banned);
  if (banned) return { passed: false, error: bannedMessage(banned) };
  const logs: string[] = [];
  const sandboxConsole = {
    log: (...a: unknown[]) => logs.push(a.map(formatLogArg).join(' ')),
    info: (...a: unknown[]) => logs.push(a.map(formatLogArg).join(' ')),
    warn: (...a: unknown[]) => logs.push(a.map(formatLogArg).join(' ')),
    error: (...a: unknown[]) => logs.push(a.map(formatLogArg).join(' ')),
    debug: (...a: unknown[]) => logs.push(a.map(formatLogArg).join(' ')),
  };
  const collectedOutput = () => (logs.length ? logs.join('\n') : undefined);

  try {
    const source = `${userCode}\n;\n${ex.tests ?? ''}`;
    const js = transformCode(source);
    // `console` is passed as a parameter so learner/test output is captured
    // instead of leaking to the real console.
    const fn = new AsyncFunction('console', js);
    await fn(sandboxConsole);
    return { passed: true, actual: collectedOutput() };
  } catch (err) {
    const message =
      err instanceof Error ? err.message || err.toString() : String(err);
    return { passed: false, error: message, actual: collectedOutput() };
  }
}

// ---------------------------------------------------------------------------
// Worker wiring. Only runs inside a real DedicatedWorker; skipped under node so
// the module can be imported for headless tests.
declare const self: DedicatedWorkerGlobalScope;

if (
  typeof self !== 'undefined' &&
  typeof (self as unknown as { postMessage?: unknown }).postMessage === 'function' &&
  typeof (globalThis as { window?: unknown }).window === 'undefined'
) {
  self.onmessage = async (e: MessageEvent<{ userCode: string; ex: Exercise }>) => {
    const { userCode, ex } = e.data;
    let result: RunResult;
    try {
      result = await runExercise(ex, userCode);
    } catch (err) {
      result = {
        passed: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    self.postMessage(result);
  };
}
