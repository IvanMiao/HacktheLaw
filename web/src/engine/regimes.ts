export type RegimeKey = 'caducite' | 'fnr' | 'nullite_forme' | 'insolvency_stay' | 'forclusion_insolvency' | 'jurisdiction_objection' | 'appeal_lapse';

export type Regime = { name: string; when: string; prejudice: string; curable: string; ownMotion: string; interruption: string };

export const REGIMES: Record<RegimeKey, Regime> = {
  insolvency_stay: {name:'Stay on individual payment actions',when:'From opening judgment',prejudice:'—',curable:'Declaration or relief does not lift the payment-action stay',ownMotion:'Public-order rule — lawyer review',interruption:'Collective route, not ordinary payment litigation'},
  forclusion_insolvency: {name:'Forclusion — claim declaration',when:'Ordinary declaration within two months of BODACC',prejudice:'—',curable:'Potential judicial relief on timely application and statutory proof; not automatic',ownMotion:'Judicial relief requires creditor application',interruption:'Not debt extinction; inopposability under statutory plan conditions'},
  jurisdiction_objection: {name:'Territorial jurisdiction objection',when:'Simultaneously and before any merits defence or fin de non-recevoir',prejudice:'No prejudice requirement; timing and CPC 75 designation matter',curable:'Late sequencing is not cured by later submissions',ownMotion:'CPC 77 limited; consumer clause review is separate',interruption:'Timing bar does not validate the clause'},
  appeal_lapse: {name:'Caducité — notice of appeal',when:'Ordinary appellant submissions within three months, CPC 641/642 adjustment',prejudice:'—',curable:'Potential qualifying force majeure before order; existing order cannot be withdrawn',ownMotion:'Conseiller de la mise en état',interruption:'Appeal instance ends; finality requires checking all surviving appeals and remedies'},
  caducite: { name: 'Caducité de l’assignation', when: 'Recorded by the judge (art. 857 CPC)', prejudice: '—', curable: 'No — a new writ must be served', ownMotion: 'Yes', interruption: 'Lost (art. 2243 + case law)' },
  fnr: { name: 'Fin de non-recevoir', when: 'At any stage (art. 123 CPC)', prejudice: 'No (art. 124)', curable: 'Yes if cured before ruling (art. 126) — not for conciliation clauses (2014)', ownMotion: 'In some cases (art. 125)', interruption: '—' },
  nullite_forme: { name: 'Nullité de forme', when: 'Before any defence on the merits (arts. 74, 112)', prejudice: 'Yes (art. 114)', curable: 'Yes (art. 115)', ownMotion: 'No', interruption: 'Kept (art. 2241 al. 2)' },
};
