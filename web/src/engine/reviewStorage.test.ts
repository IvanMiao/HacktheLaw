import { describe, expect, it } from 'vitest';
import { initialState } from './chains';
import { restoreReviews, serializeReviews } from './reviewStorage';

describe('saved case review', () => {
  it('restores notes, next steps and status without adopting a hypothetical interpretation', () => {
    const state = initialState();
    state.decisions['q-email'] = 'unsupported';
    state.reviews['q-email'] = { note: 'Read the full thread.', nextStep: 'Obtain the attachment.' };
    state.whatIf['q-email'] = true;
    const restored = restoreReviews(serializeReviews(state));
    expect(restored.decisions['q-email']).toBe('unsupported');
    expect(restored.reviews['q-email']).toEqual(state.reviews['q-email']);
    expect(restored.whatIf).toEqual({});
  });

  it('ignores corrupt storage, unknown statuses and earlier approval formats', () => {
    for (const saved of ['{broken', 'null', '{"version":0}', '{"version":1,"decisions":{"q-email":"confirmed"},"reviews":{"q-email":{"note":3}}}']) {
      expect(restoreReviews(saved)).toEqual(initialState());
    }
  });
});
