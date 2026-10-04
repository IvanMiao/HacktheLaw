import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = resolve(web, '.cache/team-demo');
const stateFile = resolve(directory, 'processes.json');
const binary = resolve(directory, 'bin/cloudflared');
const vite = resolve(web, 'node_modules/vite/bin/vite.js');
const origin = 'http://127.0.0.1:4173';
const action = process.argv[2] ?? 'status';
const readState = () => existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {};
const saveState = (state) => writeFileSync(stateFile, JSON.stringify(state, null, 2), { mode: 0o600 });

function running(pid, executable) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(executable);
  } catch { return false; }
}

function url() {
  const path = resolve(directory, 'tunnel.log');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8').match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/g)?.at(-1) ?? null;
}

function status() {
  const state = readState();
  const tunnelRunning = running(state.tunnelPid, binary);
  console.log(JSON.stringify({
    previewRunning: running(state.previewPid, vite),
    tunnelRunning,
    url: tunnelRunning ? url() : null,
    startedAt: state.startedAt,
    logs: directory,
  }, null, 2));
}

function stop() {
  const state = readState();
  for (const [pid, executable] of [[state.tunnelPid, binary], [state.previewPid, vite]]) {
    if (running(pid, executable)) process.kill(pid, 'SIGTERM');
  }
  saveState({});
  console.log('Team access stopped.');
}

function launch(executable, args, logName, env) {
  const fd = openSync(resolve(directory, logName), 'w', 0o600);
  const child = spawn(executable, args, { cwd: web, detached: true, env, stdio: ['ignore', fd, fd] });
  closeSync(fd);
  child.unref();
  return child.pid;
}

async function start() {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const previous = readState();
  if (running(previous.previewPid, vite) || running(previous.tunnelPid, binary)) {
    status();
    throw new Error('A team service is already running. Stop it before restarting.');
  }
  if (!existsSync(resolve(web, 'dist/index.html'))) throw new Error('Run npm run build first.');
  if (!existsSync(binary)) throw new Error('Install the official cloudflared binary in .cache/team-demo/bin/.');
  const { emails } = JSON.parse(readFileSync(resolve(directory, 'access.json'), 'utf8'));
  if (!Array.isArray(emails) || !emails.length || emails.some((email) => typeof email !== 'string' || !/^[^\s*@,]+@[^\s*@,]+\.[^\s*@,]+$/.test(email))) {
    throw new Error('Configure exact email addresses in .cache/team-demo/access.json.');
  }
  if (!execFileSync(binary, ['tunnel', '--help'], { encoding: 'utf8' }).includes('--allowed-mail')) {
    throw new Error('This cloudflared version cannot enforce the email allowlist.');
  }
  for (const file of [resolve(web, '../.env'), resolve(web, '.env'), resolve(web, '.env.local')]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
  if (!process.env.OPENAI_API_KEY && !process.env.MISTRAL_API_KEY) throw new Error('No server-side AI key configured.');
  try {
    await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
    throw new Error('Port 4173 is already occupied by an unmanaged server.');
  } catch (error) {
    if (error.message.includes('unmanaged')) throw error;
  }
  const state = { startedAt: new Date().toISOString() };
  try {
    state.previewPid = launch(process.execPath, [vite, 'preview', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], 'preview.log', process.env);
    saveState(state);
    let healthy = false;
    for (let i = 0; i < 30; i++) {
      try {
        const response = await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) { healthy = true; break; }
      } catch { /* Wait for Vite's server-side API to start. */ }
      await delay(250);
    }
    if (!healthy) throw new Error('Preview did not start. Check .cache/team-demo/preview.log.');
    const tunnelEnv = { ...process.env };
    delete tunnelEnv.OPENAI_API_KEY;
    delete tunnelEnv.MISTRAL_API_KEY;
    state.tunnelPid = launch(binary, ['tunnel', '--no-autoupdate', '--url', origin, ...emails.flatMap((email) => ['--allowed-mail', email])], 'tunnel.log', tunnelEnv);
    saveState(state);
    let connected = false;
    for (let i = 0; i < 160; i++) {
      if (!running(state.tunnelPid, binary)) break;
      const log = readFileSync(resolve(directory, 'tunnel.log'), 'utf8');
      if (url() && log.includes('Registered tunnel connection')) { connected = true; break; }
      await delay(250);
    }
    if (!connected) throw new Error('Protected tunnel did not connect. Check .cache/team-demo/tunnel.log.');
    console.log(`Protected tunnel ready with ${emails.length} exact email addresses.`);
    status();
  } catch (error) {
    stop();
    throw error;
  }
}

try {
  if (action === 'start') await start();
  else if (action === 'stop') stop();
  else if (action === 'status') status();
  else throw new Error('Use start, status or stop.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
