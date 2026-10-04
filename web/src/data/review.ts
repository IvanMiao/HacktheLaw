import type { Decision } from '../engine/chains';

export const REVIEW_LABELS: Record<Decision, string> = {
  unreviewed: 'Not reviewed', supported: 'Supported', unsupported: 'Unsupported', insufficient: 'Insufficient',
};
