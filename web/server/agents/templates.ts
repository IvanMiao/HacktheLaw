import type { Text, QualKind } from '../../src/data/bundle.js';
import { fr } from '../../src/engine/dates.js';

export type QualificationTemplate = {
  task: string;
  question: Text;
  yes: Text;
  no: Text;
  whatIf: Text;
  rule: string;
  field: string;
  fallback: Record<string, unknown>;
};

export const TEMPLATES: Record<QualKind, QualificationTemplate> = {
  conciliation_clause: {
    task: 'Does this clause make a conciliation attempt a mandatory precondition to any court action, precise enough to be enforced (who is seised, how, time limit)? Field is_mandatory_precondition.',
    question: { en: 'Is the clause of {date} a mandatory prior-conciliation clause?', fr: 'La clause du {date} est-elle une clause de conciliation préalable obligatoire ?' },
    yes: { en: 'Mandatory prior-conciliation clause', fr: 'Clause de conciliation préalable obligatoire' },
    no: { en: 'Not a mandatory clause', fr: 'Clause non obligatoire' },
    whatIf: { en: 'The clause is not mandatory', fr: 'La clause n’est pas obligatoire' },
    rule: 'Cass. ch. mixte, 14 Feb 2003',
    field: 'is_mandatory_precondition',
    fallback: { is_mandatory_precondition: true },
  },
  acknowledgment: {
    task: "Is this communication an unequivocal acknowledgment by the debtor of the creditor's right, interrupting limitation under art. 2240 C. civ.? Field is_unequivocal_acknowledgment.",
    question: { en: 'Is the communication of {date} an acknowledgment of debt (art. 2240 C. civ.)?', fr: 'La communication du {date} vaut-elle reconnaissance de dette (art. 2240 C. civ.) ?' },
    yes: { en: 'Acknowledgment of debt — interrupts', fr: 'Reconnaissance de dette — interruptive' },
    no: { en: 'Not an acknowledgment — no effect', fr: 'Pas une reconnaissance — sans effet' },
    whatIf: { en: 'The communication of {date} is an acknowledgment of debt', fr: 'La communication du {date} vaut reconnaissance de dette' },
    rule: 'art. 2240 C. civ.',
    field: 'is_unequivocal_acknowledgment',
    fallback: { is_unequivocal_acknowledgment: false },
  },
  formal_notice: {
    task: 'Does this formal notice interrupt the limitation period? Interruption only results from the acts listed in arts. 2240–2246 C. civ. Field interrupts_limitation.',
    question: { en: 'Does the formal notice of {date} interrupt the limitation period?', fr: 'La mise en demeure du {date} interrompt-elle la prescription ?' },
    yes: { en: 'Interrupts', fr: 'Interruptive' },
    no: { en: 'Does not interrupt', fr: 'Non interruptive' },
    whatIf: { en: 'The formal notice interrupts', fr: 'La mise en demeure est interruptive' },
    rule: 'arts. 2240–2244 C. civ. (exhaustive list)',
    field: 'interrupts_limitation',
    fallback: { interrupts_limitation: false },
  },
  writ_outcome: {
    task: 'What sanction does this decision apply to the writ: caducité, nullité, or something else? Give the legal basis the decision relies on in rule. Field outcome.',
    question: { en: 'What happened to the writ of {writDate}?', fr: 'Qu’est devenue l’assignation du {writDate} ?' },
    yes: { en: 'Lapsed (caducité)', fr: 'Caduque' },
    no: { en: 'Annulled (nullité)', fr: 'Annulée (nullité)' },
    whatIf: { en: 'The writ was annulled, not lapsed', fr: 'L’assignation a été annulée, non caduque' },
    rule: 'art. 857 CPC',
    field: 'outcome',
    fallback: { outcome: 'caducite' },
  },
  conciliation_attempted: {
    task: 'Search the whole file. Is there any evidence that the conciliation required by the clause was attempted before the writ (referral to a conciliator, registered letter, meeting, report)? Field attempt_found (true only if a document records an attempt).',
    question: { en: 'Was conciliation attempted before the writ?', fr: 'Une conciliation a-t-elle été tentée avant l’assignation ?' },
    yes: { en: 'No attempt on file', fr: 'Aucune tentative au dossier' },
    no: { en: 'Conciliation attempted beforehand', fr: 'Conciliation tentée au préalable' },
    whatIf: { en: 'Conciliation was attempted before the writ', fr: 'Une conciliation a été tentée avant l’assignation' },
    rule: 'Required document not found',
    field: 'attempt_found',
    fallback: { attempt_found: false },
  },
};

export function questionFor(kind: QualKind, date: string, writDate = date): Text {
  const value = (text: string) => text.replaceAll('{date}', fr(date)).replaceAll('{writDate}', fr(writDate));
  const question = TEMPLATES[kind].question;
  return typeof question === 'string' ? value(question) : { en: value(question.en), fr: value(question.fr) };
}
