const CJK_RANGE = /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u4E00-\u9FFF\u3400-\u4DBF]/g;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const cjkMatches = text.match(CJK_RANGE) ?? [];
  const cjkChars = cjkMatches.length;
  const otherChars = text.length - cjkChars;
  return Math.ceil(cjkChars / 1.5 + otherChars / 3.5);
}
