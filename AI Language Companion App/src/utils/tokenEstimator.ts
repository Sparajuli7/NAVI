const DENSE_SCRIPT_RANGE = /[\u0900-\u097F\u0600-\u06FF\u0E00-\u0E7F\u0400-\u04FF\uAC00-\uD7AF\u3040-\u30FF\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u4E00-\u9FFF\u3400-\u4DBF\u0590-\u05FF\u1E00-\u1EFF]/gu;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  const denseMatches = text.match(DENSE_SCRIPT_RANGE) ?? [];
  const denseChars = denseMatches.length;
  const otherChars = text.length - denseChars;
  return Math.ceil(denseChars / 1.5 + otherChars / 3.5);
}
