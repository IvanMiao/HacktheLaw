export async function requestJson<T>(url: string, options: RequestInit = {}, fetchImpl: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try { response = await fetchImpl(url, {...options, signal:options.signal ?? AbortSignal.timeout(40_000)}); }
  catch { throw new Error('Local voice server unavailable or timed out. Start npm run voice:server; retry or use the original demo controls.'); }
  let data; try { data = await response.json(); } catch { throw new Error('Local voice server unavailable. Start npm run voice:server.'); }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Voice request failed. Retry or type a command.');
  return data as T;
}
export function microphoneError(error: unknown): string {
  const name = (error as {name?:string})?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone permission denied. Allow access on localhost, then retry; or type a command.';
  if (name === 'NotFoundError') return 'No microphone found. Connect one or type a command.';
  return 'Microphone unavailable or unsupported. Use localhost/HTTPS, retry or type a command.';
}
export function createOperationGuard() {
  let generation = 0;
  return { begin:()=>++generation, cancel:()=>{generation++;}, isCurrent:(token:number)=>token===generation };
}
export type Clip = {result: Promise<Blob>; stop:()=>void; cancel:()=>void};
export async function recordClip({ getUserMedia = (constraints:MediaStreamConstraints)=>navigator.mediaDevices.getUserMedia(constraints), Recorder = globalThis.MediaRecorder, maxMs = 15_000 }: {getUserMedia?:(c:MediaStreamConstraints)=>Promise<MediaStream>; Recorder?:typeof MediaRecorder; maxMs?:number} = {}): Promise<Clip> {
  if (!Recorder) throw new Error('Recording unsupported');
  const mimeType = ['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus','audio/webm'].find(type=>Recorder.isTypeSupported(type));
  if (!mimeType) throw new Error('Recording unsupported');
  const stream = await getUserMedia({audio:true});
  let recorder: MediaRecorder;
  try { recorder = new Recorder(stream,{mimeType}); } catch(error) { stream.getTracks().forEach(t=>t.stop()); throw error; }
  const chunks: Blob[] = []; let bytes = 0; let cancelled = false; let tooLarge = false;
  let timer: ReturnType<typeof setTimeout>;
  const stop = () => { if(recorder.state !== 'inactive') recorder.stop(); };
  const cleanup = () => { clearTimeout(timer); stream.getTracks().forEach(t=>t.stop()); };
  const result = new Promise<Blob>((resolve,reject)=>{
    recorder.ondataavailable = event=>{ bytes += event.data.size; if(bytes > 4*1024*1024){ tooLarge=true; stop(); } else if(event.data.size) chunks.push(event.data); };
    recorder.onstop = ()=>{ cleanup(); if(cancelled) reject(new Error('Recording cancelled')); else if(tooLarge) reject(new Error('Recording too large. Use a shorter clip.')); else if(!bytes) reject(new Error('Empty recording. Try again.')); else resolve(new Blob(chunks,{type:recorder.mimeType || mimeType})); };
    recorder.onerror = ()=>{ cleanup(); reject(new Error('Recording failed. Retry or type a command.')); };
    try { recorder.start(250); timer=setTimeout(stop,Math.min(maxMs,15_000)); } catch { cleanup(); reject(new Error('Recording failed. Retry or type a command.')); }
  });
  return {result,stop,cancel:()=>{cancelled=true;stop();}};
}
