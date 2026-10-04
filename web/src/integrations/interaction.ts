import type { KeyboardEvent } from 'react';
export async function copyText(text:string,clipboard:Pick<Clipboard,'writeText'>,timeoutMs=2000){
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([clipboard.writeText(text),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Clipboard permission required; use Export result instead.')),timeoutMs);})]);}
  catch{throw Error('Clipboard permission required; use Export result instead.');}
  finally{clearTimeout(timer);}
}
export function dialogKey(event:KeyboardEvent<HTMLElement>,close:()=>void,busy:boolean){
  event.stopPropagation(); // Never let modal keystrokes confirm an underlying legal decision.
  if(event.key==='Escape'){event.preventDefault();if(!busy)close();}
  if(event.key==='Tab'){
    const elements=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),a[href],summary')];
    const first=elements[0];const last=elements.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
}
