import { createServer } from 'node:http';
import { createHandler } from './api.ts';
const port = Number(process.env.VOICE_PORT ?? 8787);
const server = createServer(createHandler());
server.requestTimeout = 40_000;
server.headersTimeout = 10_000;
server.listen(port, '127.0.0.1', () => console.log(`Domino voice API: http://127.0.0.1:${port} (key ${process.env.MISTRAL_API_KEY ? 'configured' : 'missing'})`));
