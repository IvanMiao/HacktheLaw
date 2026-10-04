declare module '#domino-data' {
  export const library: import('../src/data/documents.js').Doc[];
  export const sampleDocs: import('./ingest.js').IngestedDoc[];
}
