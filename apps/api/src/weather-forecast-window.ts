export function selectForecastWindow(
  rows: readonly Record<string, unknown>[],
  kind: "hourly" | "daily",
  now: Date,
): Record<string, unknown>[] {
  const start = now.getTime();
  const end = start + 72 * 3600000;
  const candidates = rows.flatMap(row => {
    if ((row.horizon_kind !== "hourly" && row.horizon_kind !== "daily") ||
        typeof row.valid_from !== "string" || typeof row.valid_to !== "string" ||
        typeof row.fetched_at !== "string") return [];
    const from = Date.parse(row.valid_from);
    const to = Date.parse(row.valid_to);
    const fetchedAt = Date.parse(row.fetched_at);
    if (!Number.isFinite(fetchedAt) || fetchedAt > start ||
        !(to > start && from < end && from < to)) return [];
    return [{ row, from, fetchedAt }];
  });
  const latestFetch = Math.max(...candidates.map(candidate => candidate.fetchedAt));
  return candidates
    .filter(candidate => candidate.fetchedAt === latestFetch && candidate.row.horizon_kind === kind)
    .sort((a, b) => a.from - b.from)
    .slice(0, kind === "daily" ? 3 : 72)
    .map(candidate => candidate.row);
}
