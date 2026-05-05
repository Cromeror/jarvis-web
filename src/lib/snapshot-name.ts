/**
 * Utility for formatting snapshot timestamps for display in the UI.
 * Design §History strategy.
 */

/**
 * Formats a snapshot name like "20260504-143500" into a human-readable string.
 * Output: "2026-05-04 14:35:00"
 */
export function formatSnapshotTimestamp(name: string): string {
  const m = name.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!m) return name;
  const [, year, month, day, hour, min, sec] = m;
  return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
}
