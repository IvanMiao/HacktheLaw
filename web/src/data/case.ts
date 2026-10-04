export type Anchor = { doc: string; quote: string };

export type Fact = {
  id: string;
  date: string;
  doc: string;
  kind: string;
  summary: string;
  anchors: Anchor[];
  qualification?: string;
};

export type Qualification = {
  id: string;
  factId: string;
  question: string;
  /** Proposed answer (AI or rule). */
  proposed: boolean;
  yes: string;
  no: string;
  source: 'rule' | 'ai_inferred';
  confidence: 'high' | 'medium' | 'low';
  rule: string;
  reasoning: string;
  whatIfLabel: string;
};

export const CASE = {
  title: 'Atelier Lumière v. Bâtiself',
  court: 'Tribunal de commerce de Bordeaux',
  side: 'Defendant (Bâtiself SARL)',
  amount: '18 400 €',
  relationship: 'Between merchants — 5-year limitation (art. L110-4 C. com.)',
  asOf: '2026-10-04',
  nextHearing: '2026-10-20',
  invoiceDue: '2021-03-15',
  writ1: { served: '2026-01-12', hearing: '2026-02-20', placed: '2026-02-16', orderDate: '2026-02-20' },
  writ2: { served: '2026-04-08', hearing: '2026-10-20' },
};

export const FACTS: Fact[] = [
  { id: 'f1', date: '2020-11-05', doc: 'contract', kind: 'Contract', summary: 'Supply contract — art. 14 prior-conciliation clause',
    anchors: [{ doc: 'contract', quote: 'sera soumis, préalablement à toute action judiciaire, à une tentative de conciliation' }], qualification: 'q-clause' },
  { id: 'f2', date: '2021-03-15', doc: 'invoice', kind: 'Invoice', summary: 'Invoice F-2021-034 (18 400 €) falls due — limitation starts',
    anchors: [{ doc: 'invoice', quote: "Date d'échéance : 15/03/2021" }] },
  { id: 'f3', date: '2022-06-02', doc: 'email', kind: 'Email', summary: 'Debtor: “we will review your invoice and come back to you”',
    anchors: [{ doc: 'email', quote: 'Nous allons étudier votre facture et revenons vers vous.' }], qualification: 'q-email' },
  { id: 'f4', date: '2023-02-10', doc: 'notice', kind: 'Formal notice', summary: 'Mise en demeure by registered letter',
    anchors: [{ doc: 'notice', quote: 'Nous vous mettons en demeure de nous régler cette somme' }], qualification: 'q-notice' },
  { id: 'f5', date: '2026-01-12', doc: 'writ1', kind: 'Writ', summary: 'Writ #1 served — hearing set for 20/02/2026',
    anchors: [{ doc: 'writ1', quote: "L'an deux mille vingt-six et le douze janvier" }, { doc: 'writ1', quote: "l'audience du vendredi 20 février 2026" }] },
  { id: 'f6', date: '2026-02-16', doc: 'registry', kind: 'Registry', summary: 'Copy of writ #1 placed with the registry',
    anchors: [{ doc: 'registry', quote: "Copie de l'assignation remise au greffe le 16 février 2026" }] },
  { id: 'f7', date: '2026-02-20', doc: 'order', kind: 'Court order', summary: 'Order recording the caducité of writ #1',
    anchors: [{ doc: 'order', quote: "Constatons la caducité de l'assignation." }], qualification: 'q-writ1' },
  { id: 'f8', date: '2026-04-08', doc: 'writ2', kind: 'Writ', summary: 'Writ #2 served — hearing set for 20/10/2026',
    anchors: [{ doc: 'writ2', quote: "L'an deux mille vingt-six et le huit avril" }, { doc: 'writ2', quote: "l'audience du mardi 20 octobre 2026" }] },
  { id: 'f9', date: '2026-04-08', doc: 'pieces', kind: 'Exhibits', summary: 'List of exhibits — no conciliation record among 6 pieces',
    anchors: [{ doc: 'pieces', quote: 'BORDEREAU DES PIÈCES COMMUNIQUÉES' }], qualification: 'q-concil' },
];

export const QUALIFICATIONS: Qualification[] = [
  { id: 'q-clause', factId: 'f1', question: 'Does art. 14 impose a mandatory conciliation before any court action?',
    proposed: true, yes: 'Mandatory prior-conciliation clause', no: 'Not a mandatory clause',
    source: 'ai_inferred', confidence: 'high', rule: 'Cass. ch. mixte, 14 Feb 2003',
    reasoning: '“préalablement à toute action judiciaire” makes conciliation a precondition; the clause sets who appoints the conciliator and a one-month period, so it is precise enough to be enforced.',
    whatIfLabel: 'Art. 14 is not a mandatory clause' },
  { id: 'q-email', factId: 'f3', question: 'Is the email of 02/06/2022 an acknowledgment of debt (art. 2240 C. civ.)?',
    proposed: false, yes: 'Acknowledgment of debt — interrupts', no: 'Not an acknowledgment — no effect',
    source: 'ai_inferred', confidence: 'medium', rule: 'art. 2240 C. civ.',
    reasoning: 'The debtor only undertakes to “review” the invoice and mentions reservations on the works. There is no unequivocal recognition of the claimant’s right. The claimant is likely to argue the opposite.',
    whatIfLabel: 'The 2022 email is an acknowledgment of debt' },
  { id: 'q-notice', factId: 'f4', question: 'Does the mise en demeure of 10/02/2023 interrupt the limitation period?',
    proposed: false, yes: 'Interrupts', no: 'Does not interrupt',
    source: 'rule', confidence: 'high', rule: 'arts. 2240–2244 C. civ. (exhaustive list)',
    reasoning: 'An ordinary formal notice, even by registered letter, is not among the interrupting acts.',
    whatIfLabel: 'The formal notice interrupts' },
  { id: 'q-writ1', factId: 'f7', question: 'What happened to writ #1?',
    proposed: true, yes: 'Lapsed (caducité)', no: 'Annulled (nullité)',
    source: 'rule', confidence: 'high', rule: 'art. 857 CPC',
    reasoning: 'The order of 20/02/2026 expressly records the caducité of the writ, on the basis of art. 857 CPC.',
    whatIfLabel: 'Writ #1 was annulled, not lapsed' },
  { id: 'q-concil', factId: 'f9', question: 'Was the required prior conciliation omitted?',
    proposed: true, yes: 'Prior conciliation omitted', no: 'Conciliation attempted beforehand',
    source: 'ai_inferred', confidence: 'low', rule: 'Requires evidence beyond the exhibit list',
    reasoning: 'The exhibit list contains no conciliation record. This alone cannot establish that conciliation did not occur; obtain the referral history before supporting this assessment.',
    whatIfLabel: 'Conciliation was attempted before the writ' },
];

export const qualById = (id: string) => {
  const q = QUALIFICATIONS.find((x) => x.id === id);
  if (!q) throw new Error(`Unknown qualification ${id}`);
  return q;
};
