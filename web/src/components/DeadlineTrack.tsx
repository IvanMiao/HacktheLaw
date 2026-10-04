import { useLocale } from '../i18n/useLocale';
import { useBundle } from '../data/useBundle';
import { addDays, fr, toDate } from '../engine/dates';
import { deriveCase } from '../engine/chains';
import type { LimitationResult } from '../engine/limitation';

const W = 720, PAD = 24, BAR_Y = 70;

export function DeadlineTrack({ lim }: { lim: LimitationResult | null }) {
  const { t } = useLocale();
  const { bundle, factOf } = useBundle();
  if (!lim) return null;
  const derived = deriveCase(bundle);
  const start = derived.limitationStart?.date;
  if (!start) return null;
  const lastWrit = derived.lastWrit;
  const served = lastWrit && (lastWrit.attrs.servedAt ?? lastWrit.date);
  const latest = [lim.expiry, served, bundle.profile.asOf].filter((date): date is string => !!date).sort().at(-1)!;
  const to = addDays(latest, 150);
  const t0 = toDate(`${start.slice(0, 4)}-01-01`).getTime(), t1 = toDate(to).getTime();
  const x = (iso: string) => PAD + ((toDate(iso).getTime() - t0) / (t1 - t0)) * (W - 2 * PAD);
  const restarts = lim.steps.filter((step) => step.effect === 'restart' && step.periodStart).map((step) => step.periodStart!);
  const bounds = [start, ...restarts, lim.expiry];
  const events = lim.steps.filter((step) => step.factId);
  const years = Array.from({ length: toDate(to).getUTCFullYear() - toDate(start).getUTCFullYear() + 1 }, (_, i) => `${toDate(start).getUTCFullYear() + i}-01-01`);
  const barred = !!served && lim.expiry < served;

  return (
    <svg className="track" viewBox={`0 0 ${W} 150`} role="img" aria-label={t('Limitation period ending {date}', { date: fr(lim.expiry) })}>
      {years.map((year) => (
        <g key={year}>
          <line x1={x(year)} x2={x(year)} y1={BAR_Y - 6} y2={BAR_Y + 14} className="tick" />
          <text x={x(year) + 3} y={BAR_Y + 26} className="axis">{year.slice(0, 4)}</text>
        </g>
      ))}
      {bounds.slice(0, -1).map((bound, i) => (
        <rect key={`${bound}-${i}`} x={x(bound)} y={BAR_Y} width={Math.max(2, x(bounds[i + 1]) - x(bound))} height={8} rx={2}
          className={i === bounds.length - 2 ? 'bar' : 'bar old'} />
      ))}
      {events.map((event, i) => {
        const fact = factOf(event.factId!);
        const cx = x(event.date);
        const ly = 26 + (i % 2) * 16;
        return (
          <g key={event.factId} className={`ev ev-${event.effect}`}>
            <line x1={cx} x2={cx} y1={ly + 4} y2={BAR_Y - 2} className="stem" />
            <circle cx={cx} cy={BAR_Y + 4} r={5} />
            {event.effect === 'void' && <line x1={cx - 7} y1={BAR_Y + 11} x2={cx + 7} y2={BAR_Y - 3} className="strike" />}
            <text x={cx} y={ly} textAnchor="middle" className="evlabel">{t(fact.kind)}</text>
          </g>
        );
      })}
      <g className="expiry">
        <line x1={x(lim.expiry)} x2={x(lim.expiry)} y1={BAR_Y - 10} y2={BAR_Y + 40} />
        <text x={x(lim.expiry) - 4} y={BAR_Y + 52} textAnchor="end">{t('Expiry')} {fr(lim.expiry)}</text>
      </g>
      {served && <g className={barred ? 'writ2 late' : 'writ2'}>
        <line x1={x(served)} x2={x(served)} y1={BAR_Y - 10} y2={BAR_Y + 64} />
        <text x={x(served) + 4} y={BAR_Y + 66}>{t('Writ #{number}', { number: derived.writs.length })} {fr(served)}</text>
      </g>}
      <g className="asof">
        <line x1={x(bundle.profile.asOf)} x2={x(bundle.profile.asOf)} y1={8} y2={BAR_Y + 14} />
        <text x={x(bundle.profile.asOf) - 4} y={14} textAnchor="end">{t('As of')} {fr(bundle.profile.asOf)}</text>
      </g>
    </svg>
  );
}
