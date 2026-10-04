import { addDays, isWeekend, toDate, toIso } from './dates.ts';

/** National metropolitan France calendar. Local holidays and court closure orders require review. */
export function franceHolidays(year: number): string[] {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  const easter = toIso(new Date(Date.UTC(year, month - 1, day)));
  return [...['01-01','05-01','05-08','07-14','08-15','11-01','11-11','12-25'].map(x => `${year}-${x}`),
    ...[1,39,50].map(offset => addDays(easter, offset))].sort();
}

/** CPC 641 month computation and mandatory CPC 642 adjustment, not the limitation toggle. */
export function proceduralDeadline(start: string, months: number): {raw: string; adjusted: string} {
  const date = toDate(start);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), last));
  const raw = toIso(target); let adjusted = raw;
  while (isWeekend(adjusted) || franceHolidays(toDate(adjusted).getUTCFullYear()).includes(adjusted)) adjusted = addDays(adjusted, 1);
  return {raw, adjusted};
}
