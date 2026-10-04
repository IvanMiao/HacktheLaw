import { describe, expect, it, vi } from 'vitest';
import { requestJson, recordClip, microphoneError, createOperationGuard } from './client';
describe('voice transport and microphone recovery', () => {
 it('cancelled or superseded work can never apply a stale command', () => {
  const guard = createOperationGuard(); const first = guard.begin();
  expect(guard.isCurrent(first)).toBe(true); guard.cancel();
  expect(guard.isCurrent(first)).toBe(false);
  const next = guard.begin(); expect(guard.isCurrent(next)).toBe(true);
  guard.begin(); expect(guard.isCurrent(next)).toBe(false);
 });
 it('reports missing API and server failure without dropping typed fallback', async () => {
  await expect(requestJson('/api/status', {}, async () => new Response('<html>not api</html>'))).rejects.toThrow('Local voice server');
  await expect(requestJson('/api/intent', {}, async () => Response.json({error:'Mistral is not configured.'},{status:503}))).rejects.toThrow('not configured');
 });
 it('gives actionable permission and unsupported-browser errors', () => {
  expect(microphoneError({name:'NotAllowedError'})).toContain('permission');
  expect(microphoneError({name:'NotFoundError'})).toContain('microphone');
  expect(microphoneError(new Error('private'))).not.toContain('private');
 });
 it('stops tracks, bounds duration, supports explicit stop and cancellation', async () => {
  vi.useFakeTimers();
  const stopTrack = vi.fn(); const stream = {getTracks:()=>[{stop:stopTrack}]} as unknown as MediaStream;
  class FakeRecorder {
   static isTypeSupported() { return true; } state='inactive'; mimeType='audio/webm';
   ondataavailable: ((e:{data:Blob})=>void) | null = null; onstop: (()=>void) | null = null; onerror: (()=>void) | null = null;
   start() { this.state='recording'; } stop() { this.state='inactive'; this.ondataavailable?.({data:new Blob(['test-only audio'],{type:this.mimeType})}); this.onstop?.(); }
  }
  const getUserMedia = vi.fn(async()=>stream);
  const rec = await recordClip({getUserMedia,Recorder:FakeRecorder as unknown as typeof MediaRecorder,maxMs:30});
  await vi.advanceTimersByTimeAsync(31);
  expect((await rec.result).type).toBe('audio/webm'); expect(stopTrack).toHaveBeenCalled();
  const next = await recordClip({getUserMedia,Recorder:FakeRecorder as unknown as typeof MediaRecorder}); next.stop(); expect((await next.result).size).toBeGreaterThan(0);
  const cancel = await recordClip({getUserMedia,Recorder:FakeRecorder as unknown as typeof MediaRecorder}); cancel.cancel(); await expect(cancel.result).rejects.toThrow('cancelled');
  vi.useRealTimers();
 });
});
