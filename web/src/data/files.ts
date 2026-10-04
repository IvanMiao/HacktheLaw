const texts = import.meta.glob('../../../data/**/*.{md,txt}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const pdfs = import.meta.glob('../../../data/caselaw/*.pdf', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

function find(files: Record<string, string>, file: string) {
  const path = Object.keys(files).find((key) => key.endsWith(`/data/${file}`));
  if (!path) throw new Error(`Missing data file ${file}`);
  return files[path];
}

export const textFile = (file: string) => find(texts, file);
export const pdfFile = (file: string) => find(pdfs, file);
