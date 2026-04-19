/** Convert a 2-letter ISO country code to its flag emoji. */
export function countryFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => 0x1F1E5 + c.charCodeAt(0)),
  );
}
