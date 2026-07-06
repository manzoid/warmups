// JavaScript/TypeScript runner.
//
// Delegates execution to a Web Worker (see javascript.worker.ts) so learner code
// runs off the main thread and a runaway loop can be killed by terminating the
// worker. A fresh worker is spawned per run, which makes the timeout a clean
// hard stop and guarantees no state leaks between exercises.

import { transform } from 'sucrase';
import type { Exercise, GeneratedInstance, RunResult, Runner } from '../core/types';

/** Hard limit on how long a single run may take before the worker is killed. */
const TIMEOUT_MS = 3000;

function spawnWorker(): Worker {
  return new Worker(new URL('./javascript.worker.ts', import.meta.url), {
    type: 'module',
  });
}

export const javascriptRunner: Runner = {
  track: 'javascript',
  run(userCode: string, ex: Exercise): Promise<RunResult> {
    return new Promise<RunResult>((resolve) => {
      const worker = spawnWorker();
      let settled = false;

      const finish = (result: RunResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate();
        resolve(result);
      };

      const timer = setTimeout(
        () => finish({ passed: false, error: 'timed out' }),
        TIMEOUT_MS,
      );

      worker.onmessage = (e: MessageEvent<RunResult>) => finish(e.data);
      worker.onerror = (e: ErrorEvent) =>
        finish({ passed: false, error: e.message || 'worker error' });
      worker.onmessageerror = () =>
        finish({ passed: false, error: 'worker message error' });

      worker.postMessage({ userCode, ex });
    });
  },
  async generate(ex: Exercise): Promise<GeneratedInstance> {
    // Generator source is trusted content (authored, not learner input), so it
    // runs on the main thread — no worker round-trip needed.
    const src = transform(`${ex.generator ?? ''}\nreturn make();`, {
      transforms: ['typescript'],
      disableESTransforms: true,
    }).code;
    const fn = new Function(src);
    return fn() as GeneratedInstance;
  },
};

export default javascriptRunner;
