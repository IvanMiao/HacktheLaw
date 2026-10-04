type Normalized = { text: string; starts: number[]; ends: number[] };

const spaces = /[\u00a0\u2007\u2009\u202f]/g;
const quotes: Record<string, string> = { '’': "'", '‘': "'", 'ʼ': "'", '“': '"', '”': '"', '«': '"', '»': '"' };

function normalizeMapped(value: string): Normalized {
  const chars: string[] = [];
  const starts: number[] = [];
  const ends: number[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  for (const { segment, index } of segmenter.segment(value)) {
    const normalized = segment.normalize('NFKC').replace(/[’‘ʼ“”«»]/g, (character) => quotes[character]).replace(spaces, ' ').toLowerCase();
    for (const character of normalized) {
      if (/\s/u.test(character)) {
        if (chars.at(-1) === ' ') {
          ends[ends.length - 1] = index + segment.length;
          continue;
        }
        chars.push(' ');
      } else {
        chars.push(character);
      }
      const width = character.length;
      for (let i = 0; i < width; i++) {
        starts.push(index);
        ends.push(index + segment.length);
      }
    }
  }
  return { text: chars.join(''), starts, ends };
}

export function normalise(value: string): string {
  return normalizeMapped(value).text;
}

function spanFor(haystack: Normalized, start: number, length: number): { start: number; end: number } | null {
  if (length <= 0 || haystack.starts[start] === undefined) return null;
  const end = start + length - 1;
  return { start: haystack.starts[start], end: haystack.ends[end] };
}

function trimPunctuation(value: string) {
  return value.replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, '');
}

function trimmedBounds(value: string) {
  const start = value.search(/[^\s\p{P}\p{S}]/u);
  if (start < 0) return null;
  let end = value.length;
  while (end > start && /[\s\p{P}\p{S}]/u.test(value[end - 1])) end--;
  return { start, end, text: value.slice(start, end) };
}

function expandPunctuation(haystack: Normalized, start: number, length: number, prefix: string, suffix: string) {
  let left = start;
  let right = start + length - 1;
  const leading = prefix.replace(/\s/gu, '');
  for (let i = leading.length - 1, cursor = left - 1; i >= 0; i--) {
    while (cursor >= 0 && /\s/u.test(haystack.text[cursor])) cursor--;
    if (cursor < 0 || haystack.text[cursor] !== leading[i]) break;
    left = cursor--;
  }
  const trailing = suffix.replace(/\s/gu, '');
  for (let i = 0, cursor = right + 1; i < trailing.length; i++) {
    while (cursor < haystack.text.length && /\s/u.test(haystack.text[cursor])) cursor++;
    if (cursor >= haystack.text.length || haystack.text[cursor] !== trailing[i]) break;
    right = cursor++;
  }
  return { start: haystack.starts[left], end: haystack.ends[right] };
}

function ellipsisParts(value: string) {
  return value.split(/…|\.{3}/u).map(trimPunctuation).filter(Boolean);
}

export function locate(docText: string, quote: string): { start: number; end: number } | null {
  const normalizedDoc = normalizeMapped(docText);
  const normalizedQuote = normalise(quote).trim();
  if (normalizedQuote.length < 12) return null;

  const exact = docText.indexOf(quote);
  if (exact !== -1) return { start: exact, end: exact + quote.length };

  const normalizedIndex = normalizedDoc.text.indexOf(normalizedQuote);
  if (normalizedIndex !== -1) return spanFor(normalizedDoc, normalizedIndex, normalizedQuote.length);

  if (!/…|\.{3}/u.test(normalizedQuote)) {
    const bounds = trimmedBounds(normalizedQuote);
    if (!bounds) return null;
    const index = normalizedDoc.text.indexOf(bounds.text);
    if (index === -1) return null;
    return expandPunctuation(normalizedDoc, index, bounds.text.length,
      normalizedQuote.slice(0, bounds.start), normalizedQuote.slice(bounds.end));
  }

  const parts = ellipsisParts(normalizedQuote);
  if (!parts.length) return null;
  let cursor = 0;
  let first: { start: number; end: number } | null = null;
  for (const part of parts) {
    const index = normalizedDoc.text.indexOf(part, cursor);
    if (index === -1) return null;
    if (!first) first = spanFor(normalizedDoc, index, part.length);
    cursor = index + part.length;
  }
  return first;
}
