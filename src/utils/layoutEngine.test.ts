import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ElkNode } from 'elkjs/lib/elk-api';
class FakeWorker {
  static instances: FakeWorker[] = [];
  posts: Array<{ id: number; cmd: string; graph?: ElkNode }> = [];
  handlers = new Map<string, () => void>();
  onmessage?: (event: { data: { id: number; data: unknown } }) => void;
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  addEventListener(type: string, callback: () => void) {
    this.handlers.set(type, callback);
  }
  postMessage(message: { id: number; cmd: string; graph?: ElkNode }) {
    this.posts.push(message);
    if (message.cmd === 'register') queueMicrotask(() => this.onmessage?.({ data: { id: message.id, data: {} } }));
  }
  finish() {
    const message = this.posts.find((item) => item.cmd === 'layout')!;
    this.onmessage?.({ data: { id: message.id, data: message.graph } });
  }
}
let current: typeof import('./layoutEngine');
beforeEach(async () => {
  vi.resetModules();
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
  current = await import('./layoutEngine');
});
afterEach(() => {
  current.layoutEngine.cancel();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const ready = (count = 1) =>
  vi.waitFor(() => {
    expect(FakeWorker.instances).toHaveLength(count);
    expect(FakeWorker.instances[count - 1]?.posts.some((message) => message.cmd === 'layout')).toBe(true);
  });
it('loads one real Worker API lazily, reuses it and returns graph results', async () => {
  expect(FakeWorker.instances).toHaveLength(0);
  const graph = { id: 'root', children: [{ id: 'node', width: 208, height: 112 }] };
  const result = current.layoutEngine.layout(graph);
  await ready();
  FakeWorker.instances[0].finish();
  expect(await result).toEqual(graph);
  const second = current.layoutEngine.layout(graph);
  await vi.waitFor(() => expect(FakeWorker.instances[0].posts.filter((message) => message.cmd === 'layout')).toHaveLength(2));
  const message = FakeWorker.instances[0].posts.at(-1)!;
  FakeWorker.instances[0].onmessage?.({ data: { id: message.id, data: graph } });
  await second;
  expect(FakeWorker.instances).toHaveLength(1);
});
it.each(['error', 'messageerror'])('rejects %s, terminates the failed worker and allows retry', async (type) => {
  const promise = current.layoutEngine.layout({ id: 'root' });
  const rejected = expect(promise).rejects.toThrow('Worker');
  await ready();
  FakeWorker.instances[0].handlers.get(type)!();
  await rejected;
  expect(FakeWorker.instances[0].terminate).toHaveBeenCalled();
  const retry = current.layoutEngine.layout({ id: 'retry' });
  await ready(2);
  FakeWorker.instances[1].finish();
  expect(await retry).toEqual({ id: 'retry' });
});
it('cancels an in-flight job without applying fallback and restarts cleanly', async () => {
  const promise = current.layoutEngine.layout({ id: 'root' });
  const rejected = expect(promise).rejects.toBeInstanceOf(current.LayoutCancelledError);
  await ready();
  current.layoutEngine.cancel();
  await rejected;
  expect(FakeWorker.instances[0].terminate).toHaveBeenCalled();
  const retry = current.layoutEngine.layout({ id: 'retry' });
  await ready(2);
  FakeWorker.instances[1].finish();
  await expect(retry).resolves.toEqual({ id: 'retry' });
});
it('cancels initialization and limits stalled worker jobs to 30 seconds', async () => {
  const initializing = current.layoutEngine.layout({ id: 'root' });
  current.layoutEngine.cancel();
  await expect(initializing).rejects.toBeInstanceOf(current.LayoutCancelledError);
  vi.useFakeTimers();
  const stalled = current.layoutEngine.layout({ id: 'stalled' });
  const rejected = expect(stalled).rejects.toThrow('30초');
  await ready();
  await vi.advanceTimersByTimeAsync(30000);
  await rejected;
  expect(FakeWorker.instances.at(-1)!.terminate).toHaveBeenCalled();
});
