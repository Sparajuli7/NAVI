/** Format a byte count as gigabytes with one decimal place (e.g. 1234567890 -> "1.2"). */
export function formatGB(bytes: number): string {
  return (bytes / 1e9).toFixed(1);
}
