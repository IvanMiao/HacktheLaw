import type { CaseBundle } from '../data/bundle.js';
import type { ChainResult } from './chains.js';
import { english, type Translator } from '../i18n/translate.js';

export type PartySide = 'claimant' | 'defendant';

export function defaultSide(bundle: CaseBundle): PartySide {
  const side = typeof bundle.profile.side === 'string' ? bundle.profile.side : bundle.profile.side.en;
  return /^(Claimant|Appellant)\b/i.test(side) ? 'claimant' : 'defendant';
}

export function sideLabel(bundle: CaseBundle, side: PartySide, t: Translator = english): string {
  return t(bundle.preset === 'c5' ? side === 'claimant' ? 'Appellant' : 'Respondent' : side === 'claimant' ? 'Claimant' : 'Defendant');
}

// C4's profile reverses the parties identified in its authored writ. Do not infer an advantage from it.
export const rolesNeedReview = (bundle: CaseBundle) => bundle.preset === 'c4';
export const representedParty = (bundle: CaseBundle, side: PartySide, t: Translator = english) =>
  rolesNeedReview(bundle) ? t('Party identity to verify') : bundle.profile[side];

export function perspectiveImpact(bundle: CaseBundle, chain: ChainResult, side: PartySide, t: Translator = english) {
  if (rolesNeedReview(bundle)) return { label: t('Party roles need verification'), action: t('Reconcile the case profile with the parties named in the writ before assigning an impact.') };
  if (chain.status === 'not_applicable') return { label: t('Not assessed'), action: t('Review the missing inputs for this chain.') };
  if (chain.status === 'pending') return { label: t('Needs reassessment'), action: t('Resolve the disputed interpretation before relying on this chain.') };
  if (chain.status === 'fails') return { label: t('Chain not established'), action: t('This chain is not established in the current scenario; review the remaining chains.') };
  const actions: Record<string, [string, string]> = {
    C1: ['Review the limitation timeline and any evidence of interruption.', 'Check the limitation inputs and interruptions before relying on this ground.'],
    C2: ['Locate any evidence of conciliation before filing and review the clause.', 'Check the clause and the record of pre-filing conciliation.'],
    'C3-stay': ['Review the opening judgment and the route for pursuing this claim.', 'Review the opening judgment and the scope of the payment-action stay.'],
    C3: ['Review the claim declaration, creditor list and any relief order.', 'Verify the declaration and any relief order before relying on this consequence.'],
    C5: ['Review the lapse order, surviving appeals and available remedies.', 'Review the lapse order and any surviving appeal before relying on finality.'],
  };
  const action = actions[chain.id];
  if (!action) return { label: t('Impact to review'), action: t('Review which party is affected by this procedural consequence.') };
  return {
    label: t(side === 'claimant'
      ? chain.status === 'contested' ? 'Potential risk — provisional' : 'Potential risk'
      : chain.status === 'contested' ? 'Potential ground — provisional' : 'Potential ground'),
    action: t(action[side === 'claimant' ? 0 : 1]),
  };
}
