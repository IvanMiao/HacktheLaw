import { createLlmClient } from '../providers.js';
import { IntegrationError, validId } from './contracts.js';
export type FirmProfile = { id:string; label:string; protocol:'mistral-chat'|'openai-compatible-chat'|'openai-responses'; model:string; baseUrl:string; credentialEnv:string; trustedOrigins:string[] };
type Env = Record<string,string|undefined>;
export function readProfiles(env: Env=process.env): FirmProfile[] {
  let input:unknown;
  try { input=env.DOMINO_AI_PROFILES?JSON.parse(env.DOMINO_AI_PROFILES):[{id:'mistral',label:'Mistral API',protocol:'mistral-chat',model:'ministral-8b-latest',baseUrl:'https://api.mistral.ai/v1',credentialEnv:'MISTRAL_API_KEY',trustedOrigins:['https://api.mistral.ai']}]; }
  catch { throw new IntegrationError(503,'Invalid server AI profile configuration.'); }
  if(!Array.isArray(input)||!input.length||input.length>10)throw new IntegrationError(503,'Invalid server AI profile configuration.');
  const profiles=input.map((value:unknown)=>{
    const p=value as FirmProfile;
    try {
      if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['id','label','protocol','model','baseUrl','credentialEnv','trustedOrigins'].includes(k)))throw Error();
      validId(p.id);
      if(typeof p.label!=='string'||p.label.length>120||!p.label.trim()||typeof p.model!=='string'||p.model.length>120||!p.model.trim()||!['mistral-chat','openai-compatible-chat','openai-responses'].includes(p.protocol)||typeof p.credentialEnv!=='string'||!/^[A-Z][A-Z0-9_]{0,80}$/.test(p.credentialEnv))throw Error();
      const url=new URL(p.baseUrl);
      if(url.username||url.password||url.search||url.hash||!Array.isArray(p.trustedOrigins)||!p.trustedOrigins.includes(url.origin)||url.pathname.includes('..')||url.pathname.includes('%'))throw Error();
      if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname)))throw Error();
      return {...p,baseUrl:p.baseUrl.replace(/\/$/,'')};
    }catch{throw new IntegrationError(503,'Invalid or untrusted server AI profile configuration.');}
  });
  if(new Set(profiles.map(p=>p.id)).size!==profiles.length)throw new IntegrationError(503,'Duplicate server AI profile.');
  return profiles;
}
export function publicProfiles(profiles:FirmProfile[],env:Env=process.env){return profiles.map(p=>({id:p.id,label:p.label,protocol:p.protocol,model:p.model,configured:Boolean(env[p.credentialEnv]),capability:'text-json-review'}));}
export function profileClient(profile:FirmProfile,env:Env=process.env,fetcher:typeof fetch=fetch) {
  if(!env[profile.credentialEnv])throw new IntegrationError(503,'Selected text AI API credential is not configured.');
  return createLlmClient(profile.protocol==='openai-responses'?'openai':'mistral',{apiKey:env[profile.credentialEnv],baseUrl:profile.baseUrl,fetcher,maxRequests:1,retryTries:1});
}
