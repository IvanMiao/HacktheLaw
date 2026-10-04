import { afterEach, expect, it, vi } from 'vitest';
import { fetchRealtimeUpgrade } from './realtime-upgrade';

afterEach(() => vi.useRealTimers());

it('keeps the upgraded socket alive past ten seconds and leaves no upgrade timer', async () => {
  vi.useFakeTimers();
  let signal!: AbortSignal;
  const disconnected = vi.fn();
  const response = {} as Response;
  const fetchImpl = vi.fn(async (_url, options) => {
    signal = options!.signal as AbortSignal;
    signal.addEventListener('abort', disconnected);
    return response;
  }) as unknown as typeof fetch;
  expect(await fetchRealtimeUpgrade('test-key', fetchImpl)).toBe(response);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(signal.aborted).toBe(false);
  expect(disconnected).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('still aborts an upgrade that has not completed within ten seconds', async () => {
  vi.useFakeTimers();
  let signal!: AbortSignal;
  const fetchImpl = vi.fn((_url, options) => new Promise<Response>((_resolve, reject) => {
    signal = options!.signal as AbortSignal;
    signal.addEventListener('abort', () => reject(signal.reason));
  })) as unknown as typeof fetch;
  const pending = fetchRealtimeUpgrade('test-key', fetchImpl);
  const assertion = expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
  await vi.advanceTimersByTimeAsync(9_999);
  expect(signal.aborted).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  await assertion;
  expect(vi.getTimerCount()).toBe(0);
});

it('clears the timeout when the upgrade request fails', async () => {
  vi.useFakeTimers();
  const fetchImpl = vi.fn(async () => { throw new Error('Connection failed'); }) as unknown as typeof fetch;
  await expect(fetchRealtimeUpgrade('test-key', fetchImpl)).rejects.toThrow('Connection failed');
  expect(vi.getTimerCount()).toBe(0);
});
