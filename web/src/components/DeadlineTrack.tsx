import { useLocale } from '../i18n/useLocale';
import { useCase } from '../data/CaseContext';
import type { CASE as ORIGINAL_META } from '../data/case';
import { addDays, fr, toDate } from '../engine/dates';
import type { LimitationResult } from '../engine/limitation';

const W = 720, PAD = 24, BAR_Y = 70;

export function DeadlineTrack({ lim }: { lim: LimitationResult }) {
  const { t } = useLocale();
  const dataset = useCase();
  const CASE = dataset.meta as typeof ORIGINAL_META;
  const from = '2021-01-01';
  const latest = [lim.expiry, CASE.writ2.served, CASE.asOf].sort().at(-1)!;
  const to = addDays(latest, 150);
  const t0 = toDate(from).getTime(), t1 = toDate(to).getTime();
  const x = (iso: string) => PAD + ((toDate(iso).getTime() - t0) / (t1 - t0)) * (W - 2 * PAD);
  const restarts = lim.steps.filter((s) => s.effect === 'restart' && s.periodStart).map((s) => s.periodStart!);
  const bounds = [CASE.invoiceDue, ...restarts, lim.expiry];
  const events = lim.steps.filter((s) => s.factId);
  const years = Array.from({ length: toDate(to).getUTCFullYear() - 2020 }, (_, i) => `${2021 + i}-01-01`);
  const barred = lim.expiry < CASE.writ2.served;

  return (
    <svg className="track" viewBox={`0 0 ${W} 150`} role="img" aria-label={t('Limitation period ending {date}', { date: fr(lim.expiry) })}>
      {years.map((y) => (
        <g key={y}>
          <line x1={x(y)} x2={x(y)} y1={BAR_Y - 6} y2={BAR_Y + 14} className="tick" />
          <text x={x(y) + 3} y={BAR_Y + 26} className="axis">{y.slice(0, 4)}</text>
        </g>
      ))}
      {bounds.slice(0, -1).map((b, i) => (
        <rect key={b} x={x(b)} y={BAR_Y} width={Math.max(2, x(i === bounds.length - 2 ? lim.expiry : bounds[i + 1]) - x(b))} height={8} rx={2}
          className={i === bounds.length - 2 ? 'bar' : 'bar old'} />
      ))}
      {events.map((e, i) => {
        const cx = x(e.date);
        const ly = 26 + (i % 2) * 16;
        return (
          <g key={e.factId} className={`ev ev-${e.effect}`}>
            <line x1={cx} x2={cx} y1={ly + 4} y2={BAR_Y - 2} className="stem" />
            <circle cx={cx} cy={BAR_Y + 4} r={5} />
            {e.effect === 'void' && <line x1={cx - 7} y1={BAR_Y + 11} x2={cx + 7} y2={BAR_Y - 3} className="strike" />}
            <text x={cx} y={ly} textAnchor="middle" className="evlabel">{t(e.factId === 'f3' ? 'Email' : e.factId === 'f4' ? 'Formal notice' : 'Writ #1')}</text>
          </g>
        );
      })}
      <g className="expiry">
        <line x1={x(lim.expiry)} x2={x(lim.expiry)} y1={BAR_Y - 10} y2={BAR_Y + 40} />
        <text x={x(lim.expiry) - 4} y={BAR_Y + 52} textAnchor="end">{t('Expiry')} {fr(lim.expiry)}</text>
      </g>
      <g className={barred ? 'writ2 late' : 'writ2'}>
        <line x1={x(CASE.writ2.served)} x2={x(CASE.writ2.served)} y1={BAR_Y - 10} y2={BAR_Y + 64} />
        <text x={x(CASE.writ2.served) + 4} y={BAR_Y + 66}>{t('Writ #2')} {fr(CASE.writ2.served)}</text>
      </g>
      <g className="asof">
        <line x1={x(CASE.asOf)} x2={x(CASE.asOf)} y1={8} y2={BAR_Y + 14} />
        <text x={x(CASE.asOf) - 4} y={14} textAnchor="end">{t('As of')} {fr(CASE.asOf)}</text>
      </g>
    </svg>
  );
}
