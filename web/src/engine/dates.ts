const DAY = 86_400_000;

export const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const toIso = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (iso: string, n: number) => toIso(new Date(toDate(iso).getTime() + n * DAY));

export const addYears = (iso: string, n: number) => {
  const d = toDate(iso);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return toIso(d);
};

export const daysBetween = (from: string, to: string) =>
  Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY);

export const isWeekend = (iso: string) => [0, 6].includes(toDate(iso).getUTCDay());

export const nextWorkingDay = (iso: string) => {
  let d = iso;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
};

export const fr = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export const long = (iso: string, locale: 'en' | 'fr' = 'en') =>
  new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(toDate(iso));

export const weekday = (iso: string) =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][toDate(iso).getUTCDay()];
