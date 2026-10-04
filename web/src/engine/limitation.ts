import { addYears, fr, isWeekend, nextWorkingDay, weekday } from './dates';

export type LimitationEvent = {
  factId: string;
  date: string;
  kind: 'acknowledgment' | 'writ' | 'formal_notice';
  label: string;
  /** Whether the event interrupts the period, after qualification. */
  interrupts: boolean;
  /** For a writ: the date the proceedings ended (a new period starts then). */
  endDate?: string;
  noEffectReason?: string;
  rule: string;
};

export type LimitationStep = { factId?: string; date: string; text: string; rule: string; effect: 'start' | 'restart' | 'none' | 'void' | 'expiry' };

export type LimitationResult = { expiry: string; periodStart: string; steps: LimitationStep[] };

export type LimitationInput = { start: string; years: number; regimeRule: string; events: LimitationEvent[]; art642: boolean };

export function computeLimitation({ start, years, regimeRule, events, art642 }: LimitationInput): LimitationResult {
  const steps: LimitationStep[] = [
    { date: start, text: `Period starts (${years} years)`, rule: regimeRule, effect: 'start' },
  ];
  let periodStart = start;
  let expiry = addYears(start, years);

  for (const e of [...events].sort((a, b) => a.date.localeCompare(b.date))) {
    if (e.date > expiry) continue;
    if (e.interrupts) {
      periodStart = e.endDate ?? e.date;
      expiry = addYears(periodStart, years);
      steps.push({ factId: e.factId, date: e.date, text: `${e.label} interrupts — new period from ${fr(periodStart)}`, rule: e.rule, effect: 'restart' });
    } else {
      steps.push({
        factId: e.factId, date: e.date, rule: e.rule,
        text: `${e.label} — ${e.noEffectReason ?? 'no effect'}`,
        effect: e.kind === 'writ' ? 'void' : 'none',
      });
    }
  }

  if (art642 && isWeekend(expiry)) {
    const shifted = nextWorkingDay(expiry);
    steps.push({ date: expiry, text: `Last day is a ${weekday(expiry)} → extended to ${fr(shifted)}`, rule: 'art. 642 CPC (flag)', effect: 'expiry' });
    expiry = shifted;
  } else {
    steps.push({ date: expiry, text: `Period expires at the end of ${fr(expiry)}`, rule: 'art. 2229 C. civ.', effect: 'expiry' });
  }
  return { expiry, periodStart, steps };
}
