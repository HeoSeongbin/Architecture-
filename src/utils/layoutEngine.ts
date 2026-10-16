import type { ELK, ElkNode } from 'elkjs/lib/elk-api';
import workerUrl from 'elkjs/lib/elk-worker.min.js?url';

export class LayoutCancelledError extends Error {
  constructor() {
    super('정렬을 취소했습니다.');
    this.name = 'LayoutCancelledError';
  }
}
let enginePromise: Promise<ELK> | undefined;
let worker: Worker | undefined;
let generation = 0;
const pending = new Set<(error: Error) => void>();
function reset(error: Error) {
  generation++;
  worker?.terminate();
  worker = undefined;
  enginePromise = undefined;
  for (const reject of pending) reject(error);
  pending.clear();
}
async function getEngine() {
  if (!enginePromise) {
    const version = generation;
    const promise = (async () => {
      if (typeof Worker === 'undefined') {
        const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
        if (version !== generation) throw new LayoutCancelledError();
        return new ELK();
      }
      const { default: ELK } = await import('elkjs/lib/elk-api.js');
      if (version !== generation) throw new LayoutCancelledError();
      const ownedWorker = new Worker(workerUrl);
      worker = ownedWorker;
      ownedWorker.addEventListener('error', () => {
        if (worker === ownedWorker) reset(new Error('정렬 Worker를 실행하지 못했습니다.'));
      });
      ownedWorker.addEventListener('messageerror', () => {
        if (worker === ownedWorker) reset(new Error('정렬 Worker 응답을 읽지 못했습니다.'));
      });
      return new ELK({ workerFactory: () => ownedWorker });
    })();
    enginePromise = promise;
    promise.catch(() => {
      if (enginePromise === promise) enginePromise = undefined;
    });
  }
  return enginePromise;
}
export const layoutEngine = {
  cancel: () => reset(new LayoutCancelledError()),
  async layout(graph: ElkNode): Promise<ElkNode> {
    const version = generation;
    const engine = await getEngine();
    if (version !== generation) throw new LayoutCancelledError();
    let rejectFailure: (error: Error) => void = () => {};
    const failure = new Promise<never>((_resolve, reject) => {
      rejectFailure = reject;
      pending.add(reject);
    });
    const timeout = setTimeout(() => reset(new Error('정렬 제한 시간(30초)을 초과했습니다.')), 30000);
    try {
      return await Promise.race([engine.layout(graph), failure]);
    } finally {
      clearTimeout(timeout);
      pending.delete(rejectFailure);
    }
  },
};
