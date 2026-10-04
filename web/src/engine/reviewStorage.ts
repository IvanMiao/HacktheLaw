import { QUALIFICATIONS } from '../data/case';
import { initialState, type AnalysisState, type Decision } from './chains';

export const REVIEW_STORAGE_KEY = 'domino:atelier-lumiere-batiself:review:v1';
const DECISIONS: Decision[] = ['unreviewed', 'supported', 'unsupported', 'insufficient'];

/** Persist reviews only. Hypothetical scenarios never become adopted facts. */
export function serializeReviews(state: AnalysisState): string {
  return JSON.stringify({ version: 1, decisions: state.decisions, reviews: state.reviews });
}

export function restoreReviews(saved: string | null): AnalysisState {
  const state = initialState();
  if (!saved) return state;
  try {
    const data = JSON.parse(saved);
    if (!data || data.version !== 1) return state;
    for (const { id } of QUALIFICATIONS) {
      const decision = data.decisions?.[id];
      if (DECISIONS.includes(decision)) state.decisions[id] = decision;
      const review = data.reviews?.[id];
      if (review && typeof review.note === 'string' && typeof review.nextStep === 'string') {
        state.reviews[id] = { note: review.note.slice(0, 5000), nextStep: review.nextStep.slice(0, 5000) };
      }
    }
  } catch { /* A corrupt or outdated saved review must not prevent opening the case. */ }
  return state;
}
