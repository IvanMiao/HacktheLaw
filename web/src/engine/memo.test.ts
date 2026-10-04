import { describe, expect, it } from 'vitest';
import { analyse, initialState, type AnalysisState } from './chains';
import { buildMemo, toMd } from './memo';

const supportAll = (): AnalysisState => {
  const state = initialState();
  return { ...state, decisions: Object.fromEntries(Object.keys(state.decisions).map((id) => [id, 'supported'])) };
};
const memo = (state: AnalysisState) => toMd(buildMemo(analyse(state), state));

describe('review-aware defence memo', () => {
  it('does not present unreviewed chains as supported grounds or recommend serving them', () => {
    const text = memo(initialState());
    expect(text).toContain('No supported ground in the current analysis.');
    expect(text).not.toContain('### Supported ground');
    expect(text).not.toContain('Prepare draft submissions only for the supported grounds');
    expect(text).not.toContain('Serve written submissions raising');
    expect(text).not.toContain('ground C2 is established');
    expect(text).toContain('A missing document does not establish that no conciliation occurred.');
  });

  it('excludes an unsupported qualification without treating its opposite as adopted', () => {
    const state = supportAll();
    state.decisions['q-clause'] = 'unsupported';
    const text = memo(state);
    expect(text).toContain('Excluded from supported grounds — C2:');
    expect(text).toContain('its opposite has not been adopted');
    expect(text).not.toContain('### Supported ground — C2:');
    expect(text).toContain('### Supported ground — C1:');
    expect(text).toContain('Proposed reading: Mandatory prior-conciliation clause. Review: Unsupported.');
    expect(text).not.toContain('independent of the other ground');
  });

  it('keeps insufficient evidence pending and includes the requested follow-up in the export', () => {
    const state = supportAll();
    state.decisions['q-email'] = 'insufficient';
    state.reviews['q-email'] = { note: 'Need the complete email thread.', nextStep: 'Request the original reply from the client.' };
    const text = memo(state);
    expect(text).toContain('Pending review — C1:');
    expect(text).not.toContain('### Supported ground — C1:');
    expect(text).toContain('Review: Insufficient.');
    expect(text).toContain('Review note: Need the complete email thread.');
    expect(text).toContain('Next action: Request the original reply from the client.');
  });

  it('exports supported review notes and follow-up alongside the question', () => {
    const state = supportAll();
    state.reviews['q-email'] = { note: 'Reviewed the entire email thread.', nextStep: 'Attach the thread to the draft response.' };
    const text = memo(state);
    expect(text).toContain('### Is the email of 02/06/2022 an acknowledgment of debt');
    expect(text).toContain('Review: Supported.');
    expect(text).toContain('Review note: Reviewed the entire email thread.');
    expect(text).toContain('Next action: Attach the thread to the draft response.');
    expect(text).toContain('### Supported ground — C1:');
  });

  it('labels counterfactual results and keeps saved review notes separate from scenario adoption', () => {
    const state = supportAll();
    state.whatIf = { 'q-email': true };
    state.reviews['q-email'] = { note: 'The saved review supports no acknowledgment.', nextStep: 'Discuss the competing reading.' };
    const before = structuredClone(state);
    const text = memo(state);
    expect(text).toContain('Hypothetical preview — not an adopted lawyer position.');
    expect(text).toContain('Saved reviews and next steps below are unchanged by this scenario.');
    expect(text).toContain('Scenario assumption — Is the email');
    expect(text).toContain('Acknowledgment of debt — interrupts.');
    expect(text).toContain('### Scenario result — C2:');
    expect(text).not.toContain('### Supported ground');
    expect(text).not.toContain('Prepare draft submissions only for the supported grounds');
    expect(text).toContain('Proposed reading: Not an acknowledgment — no effect. Review: Supported.');
    expect(text).toContain('Review note: The saved review supports no acknowledgment.');
    expect(state).toEqual(before);
  });
});
