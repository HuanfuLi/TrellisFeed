const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

const LATEX_INLINE_MAP: Record<string, string> = {
  '\\alpha': 'alpha',
  '\\beta': 'beta',
  '\\gamma': 'gamma',
  '\\delta': 'delta',
  '\\epsilon': 'epsilon',
  '\\theta': 'theta',
  '\\lambda': 'lambda',
  '\\mu': 'μ',
  '\\pi': 'π',
  '\\sigma': 'σ',
  '\\phi': 'φ',
  '\\omega': 'ω',
  '\\times': '×',
  '\\cdot': '·',
  '\\pm': '±',
  '\\neq': '≠',
  '\\leq': '≤',
  '\\geq': '≥',
  '\\approx': '≈',
  '\\infty': '∞',
  '\\rightarrow': '→',
  '\\leftarrow': '←',
};

function decodeNumericEntity(entityBody: string): string | null {
  const isHex = entityBody[1]?.toLowerCase() === 'x';
  const digits = isHex ? entityBody.slice(2) : entityBody.slice(1);
  const codePoint = Number.parseInt(digits, isHex ? 16 : 10);
  if (!Number.isFinite(codePoint)) return null;
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return null;
  }
}

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entityBody: string) => {
    if (entityBody.startsWith('#')) {
      return decodeNumericEntity(entityBody) ?? match;
    }
    return NAMED_ENTITIES[entityBody] ?? match;
  });
}

function normalizeLatexCommands(text: string): string {
  let normalized = text;
  for (const [latex, replacement] of Object.entries(LATEX_INLINE_MAP)) {
    normalized = normalized.replaceAll(latex, replacement);
  }
  return normalized
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePlainText(text: string): string {
  const decoded = decodeHtmlEntities(text);
  return decoded
    .replace(/\$([^$]+)\$/g, (_match, inner: string) => normalizeLatexCommands(inner))
    .replace(/\\\((.+?)\\\)/g, (_match, inner: string) => normalizeLatexCommands(inner))
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeMarkdownText(text: string): string {
  return decodeHtmlEntities(text);
}
