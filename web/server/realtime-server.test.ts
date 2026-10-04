import { expect,it,vi } from 'vitest';
import { startRealtimeServer } from './realtime-server';
it('binds native websocket server to loopback and rejects keyless, cross-origin and wrong-path upgrades',()=>{
 let options:any;const upgrade=vi.fn(()=>true);const runtime={serve:(o:any)=>{options=o;return {stop:vi.fn()};}};
 startRealtimeServer(runtime as any,'key1',8788);
 expect(options.hostname).toBe('127.0.0.1');expect(options.port).toBe(8788);expect(options.websocket.maxPayloadLength).toBe(6400);
 const good=new Request('http://localhost:8788/api/realtime',{headers:{Origin:'http://localhost:5173'}});
 expect(options.fetch(good,{upgrade})).toBeUndefined();expect(upgrade).toHaveBeenCalledOnce();
 for(const request of [new Request('http://localhost:8788/api/realtime'),new Request('http://localhost:8788/api/realtime?model=anything',{headers:{Origin:'http://localhost:5173'}}),new Request('http://localhost:8788/api/realtime',{headers:{Origin:'https://attacker.test'}})]) expect(options.fetch(request,{upgrade}).status).toBe(403);
 startRealtimeServer(runtime as any,'',8788);expect(options.fetch(good,{upgrade}).status).toBe(503);
});
