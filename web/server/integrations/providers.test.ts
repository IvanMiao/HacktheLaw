import { describe, expect, it, vi } from 'vitest';
import { createLlmClient } from '../providers';
import { readProfiles, profileClient, publicProfiles } from './providers';

describe('firm provider selection (fake transport contract)',()=>{
 it('routes selected chat profile model/base/key through existing adapter without changing environment',async()=>{
  const env={FIRM_KEY:'key1',DOMINO_AI_PROFILES:JSON.stringify([{id:'firm-ai',label:'Firm private API',protocol:'openai-compatible-chat',model:'firm-model',baseUrl:'http://127.0.0.1:9911/v1',credentialEnv:'FIRM_KEY',trustedOrigins:['http://127.0.0.1:9911']}])};
  const profiles=readProfiles(env);const fetcher=vi.fn(async(_url:RequestInfo|URL,_options?:RequestInit)=>Response.json({choices:[{message:{content:'{"ok":true}'}}]}));
  const client=profileClient(profiles[0],env,fetcher);await client.json({model:profiles[0].model,system:'test',messages:[],name:'probe',schema:{type:'object'}});
  expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:9911/v1/chat/completions');
  const opts=fetcher.mock.calls[0][1]!;expect(JSON.parse(String(opts.body)).model).toBe('firm-model');expect(opts.redirect).toBe('error');expect(opts.headers).toMatchObject({Authorization:'Bearer key1'});
  expect(JSON.stringify(publicProfiles(profiles,env))).not.toContain('key1');expect(JSON.stringify(publicProfiles(profiles,env))).not.toContain('FIRM_KEY');
 });
 it('rejects untrusted origins, credentials in URL and unsupported profiles',()=>{
  for(const baseUrl of ['https://evil.example/v1','http://user:pass@127.0.0.1:9911/v1','file:///private'])expect(()=>readProfiles({DOMINO_AI_PROFILES:JSON.stringify([{id:'firm',label:'Firm',protocol:'openai-compatible-chat',model:'x',baseUrl,credentialEnv:'FIRM_KEY',trustedOrigins:['http://127.0.0.1:9911']}])})).toThrow();
 });
 it('bounds profile requests to one and does not retry provider errors',async()=>{
  const fetcher=vi.fn(async()=>Response.json({private:'key1'}, {status:500}));
  const client=createLlmClient('mistral',{apiKey:'key1',baseUrl:'http://127.0.0.1:9911/v1',fetcher,maxRequests:1,retryTries:1});
  await expect(client.json({model:'x',system:'test',messages:[],name:'probe',schema:{}})).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(client.json({model:'x',system:'test',messages:[],name:'probe',schema:{}})).rejects.toThrow('budget');expect(fetcher).toHaveBeenCalledTimes(1);
 });
});
