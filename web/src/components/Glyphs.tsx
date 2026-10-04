const PIP_LAYOUT: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function Pips({ n }: { n: number }) {
  const on = PIP_LAYOUT[Math.min(Math.max(n, 1), 6)];
  return (
    <span className="pips" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => <i key={i} className={on.includes(i) ? 'on' : ''} />)}
    </span>
  );
}

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size * 0.6} height={size} viewBox="0 0 14 24" aria-hidden className="logo">
      <rect x=".75" y=".75" width="12.5" height="22.5" rx="2.5" fill="#fff" stroke="currentColor" strokeWidth="1.5" />
      <line x1="2.5" y1="12" x2="11.5" y2="12" stroke="currentColor" strokeWidth="1" />
      <circle cx="7" cy="6.2" r="1.3" fill="currentColor" />
      <circle cx="4.6" cy="15.6" r="1.3" fill="currentColor" />
      <circle cx="9.4" cy="20" r="1.3" fill="currentColor" />
    </svg>
  );
}
