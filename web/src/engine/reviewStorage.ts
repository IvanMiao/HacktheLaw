import type { CaseBundle } from '../data/bundle';
import { initialState, type AnalysisState, type Decision } from './chains';

export const reviewStorageKey = (bundle: CaseBundle) => `domino:case-review:v1:${encodeURIComponent(bundle.id)}`;
const revision = (bundle: CaseBundle) => JSON.stringify([bundle.id, bundle.generatedAt, bundle.profile, bundle.facts, bundle.qualifications]);

/** Reviews belong to this version of this case; scenarios and date flags are not saved. */
export function serializeReviews(bundle: CaseBundle, state: AnalysisState): string {
  return JSON.stringify({ version: 1, revision: revision(bundle), decisions: state.decisions, interpretations: state.interpretations, reviews: state.reviews });
}

export function restoreReviews(bundle: CaseBundle, saved: string | null): AnalysisState {
  const state = initialState(bundle);
  if (!saved) return state;
  try {
    const data = JSON.parse(saved);
    if (data?.version !== 1 || data.revision !== revision(bundle)) return state;
    for (const { id } of bundle.qualifications) {
      const decision = data.decisions?.[id] as Decision;
      if (['proposed', 'confirmed', 'rejected', 'pending'].includes(decision)) state.decisions[id] = decision;
      if (typeof data.interpretations?.[id] === 'boolean') state.interpretations[id] = data.interpretations[id];
      const review = data.reviews?.[id];
      if (typeof review?.note === 'string' && typeof review?.nextStep === 'string') {
        state.reviews[id] = { note: review.note.slice(0, 5000), nextStep: review.nextStep.slice(0, 5000) };
      }
    }
  } catch { /* Invalid local data must not prevent loading a case. */ }
  return state;
}
