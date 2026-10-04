import type { ReactNode, RefObject } from 'react';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Tolerant quote matcher: whitespace, apostrophes and the œ/oe ligature are normalised. */
export function quoteRegex(quote: string) {
  const pattern = escape(quote)
    .replace(/\s+/g, '\\s+')
    .replace(/['’]/g, "['’]")
    .replace(/œ|oe/g, '(?:œ|oe)');
  return new RegExp(pattern, 'i');
}

export function locate(text: string, quote: string): [number, number] | null {
  const m = quoteRegex(quote).exec(text);
  return m ? [m.index, m.index + m[0].length] : null;
}

export function highlight(text: string, quotes: string[], active: string | null, activeRef: RefObject<HTMLElement | null>): ReactNode[] {
  const ranges = quotes
    .map((q) => ({ q, r: locate(text, q) }))
    .filter((x): x is { q: string; r: [number, number] } => x.r !== null)
    .sort((a, b) => a.r[0] - b.r[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(({ q, r: [s, e] }, i) => {
    if (s < pos) return;
    out.push(text.slice(pos, s));
    const isActive = q === active;
    out.push(
      <mark key={i} className={isActive ? 'hl active' : 'hl'} ref={isActive ? (activeRef as RefObject<HTMLElement>) : undefined}>
        {text.slice(s, e)}
      </mark>,
    );
    pos = e;
  });
  out.push(text.slice(pos));
  return out;
}
