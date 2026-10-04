import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = resolve(web, '../data');
const load = async (file) => JSON.parse(await readFile(resolve(data, file), 'utf8'));
const library = await Promise.all((await load('library.json')).map(async ({ file, pdf: _pdf, ...doc }) => ({
  ...doc, text: await readFile(resolve(data, file), 'utf8'),
})));
const types = { contract: 'contract', invoice: 'invoice', email: 'correspondence', notice: 'formal_notice', writ1: 'writ', registry: 'registry_record', order: 'court_order', writ2: 'writ', pieces: 'exhibits_list' };
const sampleDocs = await Promise.all((await load('sample-case/manifest.json')).map(async ({ file, ...doc }) => ({
  ...doc, group: 'case', format: 'text', docType: types[doc.id] ?? 'other',
  text: (await readFile(resolve(data, file), 'utf8')).replace(/\n$/, ''),
})));

await build({
  entryPoints: [resolve(web, 'server/worker.ts')], outfile: resolve(web, 'dist/_worker.js'),
  bundle: true, platform: 'node', format: 'esm', target: 'es2022', minify: true,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire('/bundle/worker.js');" },
  external: ['node:*'],
  plugins: [{ name: 'embedded-case-documents', setup(bundler) {
    bundler.onResolve({ filter: /^#domino-data$/ }, () => ({ path: 'documents', namespace: 'domino' }));
    bundler.onLoad({ filter: /.*/, namespace: 'domino' }, () => ({
      contents: `export const library=${JSON.stringify(library)};export const sampleDocs=${JSON.stringify(sampleDocs)};`, loader: 'js',
    }));
  } }],
});
await writeFile(resolve(web, 'dist/_routes.json'), JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] }));
console.log('Cloudflare Worker built: dist/_worker.js');
