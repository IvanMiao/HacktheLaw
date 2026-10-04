-- Synthetic law-firm bridge fixture. No client data.
CREATE TABLE matters (id TEXT PRIMARY KEY, title TEXT NOT NULL, synthetic INTEGER NOT NULL CHECK (synthetic = 1), annotations_json TEXT NOT NULL);
CREATE TABLE documents (matter_id TEXT NOT NULL REFERENCES matters(id), id TEXT NOT NULL, title TEXT NOT NULL, short TEXT NOT NULL, date TEXT, doc_type TEXT, text TEXT NOT NULL, PRIMARY KEY (matter_id, id));
