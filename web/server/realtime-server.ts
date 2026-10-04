import { EventEmitter } from 'node:events';
import { allowedRealtimeOrigin, bridgeRealtime, REALTIME_MODEL } from './realtime-bridge.ts';
// Bun is already installed on the development host. Use its native RFC6455
// implementation rather than hand-rolling WebSocket frames or adding packages.
type NativeSocket={readyState:number;data:{adapter?:BrowserSocket};getBufferedAmount:()=>number;send:(data:string)=>number;close:(code?:number)=>void;terminate:()=>void};
type NativeServer={upgrade:(req:Request,options:{data:object})=>boolean;pendingWebSockets:number;stop:(closeActive?:boolean)=>void};
export type RealtimeRuntime={serve:(options:{hostname:string;port:number;fetch:(request:Request,server:NativeServer)=>Response|undefined;websocket:{maxPayloadLength:number;idleTimeout:number;sendPings:boolean;open:(socket:NativeSocket)=>void;message:(socket:NativeSocket,data:string|Buffer)=>void;close:(socket:NativeSocket,code:number)=>void}})=>NativeServer};
class BrowserSocket extends EventEmitter {
 raw:NativeSocket;
 constructor(raw:NativeSocket){super();this.raw=raw;}
 get readyState(){return this.raw.readyState;}get bufferedAmount(){return this.raw.getBufferedAmount();}
 send(data:string){this.raw.send(data);}close(code?:number){this.raw.close(code);}terminate(){this.raw.terminate();}
}
class UpstreamSocket extends EventEmitter {
 raw:WebSocket;
 constructor(key:string){
  super();
  const NativeWebSocket=globalThis.WebSocket as unknown as new(url:string,options:{headers:Record<string,string>})=>WebSocket;
  this.raw=new NativeWebSocket(`wss://api.mistral.ai/v1/audio/transcriptions/realtime?model=${REALTIME_MODEL}`,{headers:{Authorization:`Bearer ${key}`}});
  this.raw.onmessage=e=>{this.emit('message',Buffer.from(typeof e.data==='string'?e.data:new Uint8Array(e.data)));};
  this.raw.onerror=()=>{this.emit('error',Error('Provider websocket unavailable'));};this.raw.onclose=e=>{this.emit('close',e.code);};
 }
 get readyState(){return this.raw.readyState;}get bufferedAmount(){return this.raw.bufferedAmount;}
 send(data:string){this.raw.send(data);}close(){this.raw.close();}terminate(){this.raw.close();}
}
export function startRealtimeServer(runtime:RealtimeRuntime,key:string,port=8788){
 return runtime.serve({hostname:'127.0.0.1',port,
  fetch(request,server){
   const url=new URL(request.url);
   if(url.pathname!=='/api/realtime'||url.search||!allowedRealtimeOrigin(request.headers.get('origin')??undefined))return new Response('Origin or route not allowed.',{status:403});
   if(!key)return new Response('Mistral not configured.',{status:503});
   if(server.pendingWebSockets>=2)return new Response('Realtime session limit reached.',{status:429});
   if(server.upgrade(request,{data:{}}))return;
   return new Response('WebSocket upgrade required.',{status:400});
  },websocket:{maxPayloadLength:6400,idleTimeout:30,sendPings:true,
   open(socket){const adapter=new BrowserSocket(socket);socket.data.adapter=adapter;try{bridgeRealtime(adapter,new UpstreamSocket(key));}catch{socket.close(1011);}},
   message(socket,data){socket.data.adapter?.emit('message',typeof data==='string'?Buffer.from(data):data,typeof data!=='string');},
   close(socket,code){socket.data.adapter?.emit('close',code);},
  }});
}
