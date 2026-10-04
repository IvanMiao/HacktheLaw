import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createIntegrationHandler } from './api';
import { createServer } from 'node:http';
import { once } from 'node:events';
describe('OpenAPI actual route contract',()=>{
 it('documents all supported public operations with bearer security and normalized case schemas',async()=>{
  const spec=JSON.parse(await readFile(new URL('../../../docs/law-firm-openapi.json',import.meta.url),'utf8'));
  expect(spec.openapi).toBe('3.1.0');expect(Object.keys(spec.paths)).toEqual(['/api/v1/connections','/api/v1/openapi','/api/v1/matters','/api/v1/matters/{matterId}/import','/api/v1/providers/{profileId}/test','/api/v1/cases','/api/v1/cases/{caseId}','/api/v1/cases/{caseId}/analyse','/api/v1/cases/{caseId}/export']);
  expect(spec.components.schemas.Matter.required).toContain('documents');expect(spec.components.schemas.Matter.additionalProperties).toBe(false);expect(spec.security).toEqual([{bearerAuth:[]}]);expect(spec.components.schemas.AnalysisRequest.properties.mode.enum).toEqual(['deterministic','ai-review']);
  const handler=createIntegrationHandler({env:{DOMINO_INTEGRATION_KEY:'token1'}});const server=createServer((req,res)=>void handler(req,res));server.listen(0,'127.0.0.1');await once(server,'listening');
  try{const url=`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1/openapi`;const response=await fetch(url,{headers:{Authorization:'Bearer token1'}});expect(response.status).toBe(200);expect(await response.json()).toEqual(spec);}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
 });
});
