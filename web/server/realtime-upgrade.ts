import { REALTIME_MODEL } from './realtime-bridge.js';

export async function fetchRealtimeUpgrade(apiKey: string, fetchImpl: typeof fetch = fetch) {
  const controller = new AbortController();
  // Limit the HTTP upgrade only. Aborting its signal after a successful upgrade
  // also tears down the live WebSocket in Cloudflare Workers.
  const timeout = setTimeout(() => controller.abort(new DOMException('Realtime upgrade timed out', 'TimeoutError')), 10_000);
  try {
    return await fetchImpl(`https://api.mistral.ai/v1/audio/transcriptions/realtime?model=${REALTIME_MODEL}`, {
      headers: { Upgrade: 'websocket', Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
