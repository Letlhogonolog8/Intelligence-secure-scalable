/**
 * Production safety for the portal sample data.
 *
 * Every portal ships with `MOCK_*` sample constants so the layout stays
 * populated without a backend. In production that is dangerous for the seams
 * that are wired to live queries: an empty result, an RLS block, or an outage
 * would otherwise render *plausible fabricated data* (e.g. a fake "24,589
 * users") in a panel the user trusts as real-time.
 *
 * `ALLOW_MOCK` gates that fallback. In development — or in a deliberate offline
 * demo via `VITE_ALLOW_MOCK_DATA=true` — the sample data is shown. In a normal
 * production build the live value is used as-is, so an empty query surfaces as
 * an empty state or the `NO_DATA` placeholder instead of an invented number.
 */
export const ALLOW_MOCK: boolean =
  import.meta.env.DEV || import.meta.env.VITE_ALLOW_MOCK_DATA === "true";

/** Placeholder shown for a KPI/metric that has no live value in production. */
export const NO_DATA = "—";

/**
 * List seam: live rows when present; otherwise the mock sample in dev, or an
 * empty array in production (renders the panel's empty state).
 */
export function mockList<T>(live: T[] | undefined, mock: T[]): T[] {
  if (live && live.length) return live;
  return ALLOW_MOCK ? mock : (live ?? []);
}

/**
 * Scalar seam for KPI values: the live value when present; otherwise the mock
 * sample in dev, or `NO_DATA` in production.
 */
export function mockValue(
  live: string | null | undefined,
  mock: string,
): string {
  if (live != null && live !== "") return live;
  return ALLOW_MOCK ? mock : NO_DATA;
}

/**
 * Wrap a `MOCK_*` *list* constant at its definition so it resolves to the
 * sample rows in dev and an empty array in production. Every seam that falls
 * back to that constant then renders an empty state in prod with no per-seam
 * change. Use only for pure row/series data — never for KPI label/icon
 * structures (those must keep their shape; gate their values with `mockValue`).
 */
export function sample<T>(rows: T[]): T[] {
  return ALLOW_MOCK ? rows : [];
}
