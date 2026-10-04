import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CaseBundle } from '../src/data/bundle';
import { runCase } from '../server/pipeline';
import { profileSide } from '../server/agents/extract';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const evalDir = resolve(ROOT, 'web/.cache/eval');
const evalFiles = (await readdir(evalDir).catch(() => []))
  .filter((file) => file.startsWith('openai-') && file.endsWith('.json'));
const latestEval = (await Promise.all(evalFiles.map(async (file) => ({
  path: resolve(evalDir, file),
  modified: (await stat(resolve(evalDir, file))).mtimeMs,
})))).sort((a, b) => b.modified - a.modified)[0];
let bundle: CaseBundle;
if (latestEval) {
  const result = JSON.parse(await readFile(latestEval.path, 'utf8')) as { bundle: CaseBundle };
  bundle = result.bundle;
} else {
  bundle = await runCase({ sample: true }, () => undefined);
}
if (typeof bundle.profile.side === 'string') {
  bundle.profile.side = profileSide(bundle.profile.side, bundle.profile.claimant, bundle.profile.defendant);
}
bundle.origin = 'ai';
const output = resolve(ROOT, 'data/sample-case/ai-bundle.json');
await writeFile(output, JSON.stringify(bundle, null, 2), 'utf8');
console.log(`Recorded sample bundle: ${output}`);
