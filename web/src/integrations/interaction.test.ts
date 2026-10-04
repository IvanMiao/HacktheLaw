import { describe, expect, it, vi } from 'vitest';
import { copyText, dialogKey } from './interaction';
describe('safe Connections interactions',()=>{
 it('copies actual response text with a bounded clipboard wait',async()=>{const write=vi.fn(async()=>{});await copyText('export', {writeText:write},10);expect(write).toHaveBeenCalledWith('export');await expect(copyText('export',{writeText:()=>new Promise<void>(()=>{})},5)).rejects.toThrow('Clipboard');});
 it('redacts clipboard denial into an actionable fallback',async()=>{await expect(copyText('export',{writeText:async()=>{throw Error('private clipboard denial');}})).rejects.toThrow('Clipboard permission required');});
 it('isolates underlying legal shortcuts and closes only on Escape when idle',()=>{const close=vi.fn();const stop=vi.fn();const prevent=vi.fn();dialogKey({key:'c',stopPropagation:stop,preventDefault:prevent} as never,close,false);expect(stop).toHaveBeenCalled();expect(close).not.toHaveBeenCalled();dialogKey({key:'Escape',stopPropagation:stop,preventDefault:prevent} as never,close,false);expect(close).toHaveBeenCalledOnce();dialogKey({key:'Escape',stopPropagation:stop,preventDefault:prevent} as never,close,true);expect(close).toHaveBeenCalledOnce();});
});
