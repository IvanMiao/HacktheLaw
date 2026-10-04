export type RegimeKey = 'caducite' | 'fnr' | 'nullite_forme';

export type Regime = { name: string; when: string; prejudice: string; curable: string; ownMotion: string; interruption: string };

export const REGIMES: Record<RegimeKey, Regime> = {
  caducite: { name: 'Caducité de l’assignation', when: 'Recorded by the judge (art. 857 CPC)', prejudice: '—', curable: 'No — a new writ must be served', ownMotion: 'Yes', interruption: 'Lost (art. 2243 + case law)' },
  fnr: { name: 'Fin de non-recevoir', when: 'At any stage (art. 123 CPC)', prejudice: 'No (art. 124)', curable: 'Yes if cured before ruling (art. 126) — not for conciliation clauses (2014)', ownMotion: 'In some cases (art. 125)', interruption: '—' },
  nullite_forme: { name: 'Nullité de forme', when: 'Before any defence on the merits (arts. 74, 112)', prejudice: 'Yes (art. 114)', curable: 'Yes (art. 115)', ownMotion: 'No', interruption: 'Kept (art. 2241 al. 2)' },
};
