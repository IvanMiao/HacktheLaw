import type { CaseId } from './catalog';
export type CaseIdentity = {caseId:CaseId; generation:number};

/** Synchronous generation boundary: stale A→B→A callbacks cannot regain validity. */
export function createCaseSession(initial: CaseId) {
  let current:CaseIdentity = {caseId:initial,generation:0};
  return {
    identity: (): CaseIdentity => ({...current}),
    select: (caseId:CaseId) => { current = {caseId,generation:current.generation + 1}; },
    assert: (expected:CaseIdentity) => {
      if (expected.caseId !== current.caseId || expected.generation !== current.generation) throw new Error('Stale case command. No changes made.');
    },
  };
}
export type CaseSession = ReturnType<typeof createCaseSession>;
