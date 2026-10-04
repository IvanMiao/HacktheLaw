import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createHandler } from './voice-api';
import { getCase } from '../src/data/catalog';
import { buildContext } from '../src/voice/commands';
import { initialState } from '../src/engine/chains';

const servers:ReturnType<typeof createServer>[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));}
});
async function start(fetchImpl:typeof fetch) {
  const server=createServer(createHandler({apiKey:'test-only',fetchImpl}));servers.push(server);
  server.listen(0,'127.0.0.1');await once(server,'listening');
  return `http://127.0.0.1:${(server.address() as {port:number}).port}`;
}

describe('multi-case HTTP boundary — explicitly fake provider only', () => {
  it('includes the same manifest/library source metadata for every server catalog case', () => {
    const library = getCase('c1-c2').docs.filter((doc) => doc.group !== 'case')
      .map(({ id, title, provenance }) => ({ id, title, provenance }));
    const libraryIds = new Set(library.map((doc) => doc.id));
    for (const id of ['c1-c2', 'c3', 'c4', 'c5']) {
      const bundle = getCase(id);
      expect(bundle.docs.filter((doc) => libraryIds.has(doc.id))
        .map(({ id, title, provenance }) => ({ id, title, provenance }))).toEqual(library);
      expect(buildContext(initialState(bundle), bundle).sources).toEqual(bundle.docs.map(({ id, title, provenance }) => ({ id, title, provenance })));
    }
  });

  it.each(['c1-c2','c3','c4','c5'])('sends only selected %s schema and grounds its evidence response', async id => {
    const c=getCase(id);const context=buildContext(initialState(c),c);const target=c.facts[0].doc;
    const intent={action:'show_evidence',target,value:null,sourceIds:[target]};
    const fake=vi.fn<typeof fetch>(async (_url,options) => {
      const payload=JSON.parse(options!.body as string);
      const user=JSON.parse(payload.messages[1].content);
      expect(user.context.caseId).toBe(id);
      const schema=JSON.stringify(payload.response_format.json_schema.schema);
      expect(schema).toContain(target);
      if(id !== 'c1-c2') expect(schema).not.toContain('q-email');
      return Response.json({choices:[{message:{content:JSON.stringify(intent)}}]});
    });
    const url=await start(fake);
    const r=await fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'TEST-ONLY evidence request',context})});
    expect(r.status).toBe(200);expect(await r.json()).toEqual({intent});expect(fake).toHaveBeenCalledTimes(1);
  });
  it('rejects case mismatch before any provider call', async () => {
    const c=getCase('c3');const context=buildContext(initialState(c),c);context.caseId='c4';
    const fake=vi.fn<typeof fetch>();const url=await start(fake);
    const r=await fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'TEST-ONLY forged context',context})});
    expect(r.status).toBe(400);expect(fake).not.toHaveBeenCalled();
  });
  it('rejects provider foreign-case citations without applying anything', async () => {
    const c=getCase('c5');const context=buildContext(initialState(c),c);
    const fake=vi.fn<typeof fetch>(async () => Response.json({choices:[{message:{content:JSON.stringify({action:'show_evidence',target:'c3-email',value:null,sourceIds:['c3-email']})}}]}));
    const url=await start(fake);
    const r=await fetch(url+'/api/intent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'TEST-ONLY foreign evidence',context})});
    expect(r.status).toBe(502);expect(await r.text()).toContain('ungrounded');
  });
});
