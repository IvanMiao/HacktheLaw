import { expect, it } from 'vitest';
import { createCaseSession } from './caseSession';

it('invalidates commands on every switch, including return to the same case', () => {
  const session = createCaseSession('c3'); const token = session.identity();
  expect(() => session.assert(token)).not.toThrow();
  session.select('c4');
  expect(() => session.assert(token)).toThrow('Stale case');
  session.select('c3');
  expect(() => session.assert(token)).toThrow('Stale case');
  expect(() => session.assert(session.identity())).not.toThrow();
});
