import React from 'react';

const ARABIC_VARIANTS_MAP: Record<string, string> = {
  'ا': '[اأإآٱٳ]',
  'أ': '[اأإآٱٳ]',
  'إ': '[اأإآٱٳ]',
  'آ': '[اأإآٱٳ]',
  'ه': '[هة]',
  'ة': '[هة]',
  'ي': '[يىیئ]',
  'ى': '[يىیئ]',
  'ی': '[يىیئ]',
  'ئ': '[يىیئ]',
  'ك': '[كگکڪ]',
  'گ': '[كگکڪ]',
  'ک': '[كگکڪ]',
  'ڪ': '[كگکڪ]',
  'و': '[وؤ]',
  'ؤ': '[وؤ]',
};

function buildArabicVariantRegex(query: string): RegExp | null {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const patterns = tokens.map((token) =>
    Array.from(token)
      .map((ch) => {
        const lower = ch.toLowerCase();
        if (ARABIC_VARIANTS_MAP[lower]) {
          return `${ARABIC_VARIANTS_MAP[lower]}[\u064B-\u065F\u0670ـ]*`;
        }
        const escaped = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return `${escaped}[\u064B-\u065F\u0670ـ]*`;
      })
      .join('')
  );

  try {
    return new RegExp(`(${patterns.join('|')})`, 'gi');
  } catch {
    return null;
  }
}

export function highlightArabicText(text: string, query: string): React.ReactNode {
  if (!text || !query.trim()) return text;
  const regex = buildArabicVariantRegex(query);
  if (!regex) return text;

  const parts = text.split(regex);
  return parts.map((part, idx) =>
    regex.test(part) ? (
      <mark
        key={idx}
        className="bg-[#C9956C]/30 text-[#C9956C] dark:text-[#f2c49b] font-semibold px-0.5 rounded-sm"
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={idx}>{part}</React.Fragment>
    )
  );
}

export function formatUtcToLocal(isoString?: string): string {
  if (!isoString) return '—';
  const normalized = isoString.endsWith('Z') || isoString.includes('+') ? isoString : `${isoString}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}
