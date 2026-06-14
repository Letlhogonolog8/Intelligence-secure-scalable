import type { ImpactMetrics, ProvinceMetric } from "@/hooks/useImpactMetrics";

/**
 * Exportable policy/government impact reporting.
 *
 * Turns the live, anonymised impact metrics into artifacts a policymaker can
 * take away — a spreadsheet-friendly CSV and a plain-text policy brief. Only
 * aggregate, non-identifying figures are included (POPIA-aligned); there is no
 * survivor-level data anywhere in these outputs.
 */

/** RFC-4180 field escaping: quote when the value contains a comma, quote, or newline. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells: Array<string | number>): string {
  return cells.map(csvField).join(",");
}

export function buildImpactCsv(
  metrics: ImpactMetrics,
  provinces: ProvinceMetric[],
  generatedAt: Date = new Date(),
): string {
  const lines: string[] = [];
  lines.push(csvRow(["AEGIS-AI Impact Report"]));
  lines.push(csvRow(["Generated", generatedAt.toISOString()]));
  lines.push(
    csvRow(["Note", "Anonymised aggregate data only. POPIA compliant."]),
  );
  lines.push("");
  lines.push(csvRow(["Section", "Metric", "Value"]));

  lines.push(csvRow(["Outcomes", "Cases resolved", metrics.casesResolved]));
  lines.push(
    csvRow(["Outcomes", "Survivors supported", metrics.survivorsSupported]),
  );
  lines.push(
    csvRow([
      "Outcomes",
      "Average response time (minutes)",
      metrics.avgResponseMinutes,
    ]),
  );
  lines.push(
    csvRow(["Outcomes", "Resources connected", metrics.resourcesConnected]),
  );
  lines.push(csvRow(["Coverage", "Provinces active", metrics.provincesActive]));
  lines.push(csvRow(["Coverage", "Countries active", metrics.countriesActive]));

  for (const p of provinces) {
    lines.push(
      csvRow(["Provincial coverage", `${p.province} — cases`, p.cases]),
    );
    lines.push(
      csvRow(["Provincial coverage", `${p.province} — coverage %`, p.coverage]),
    );
  }

  return lines.join("\r\n");
}

export function buildPolicyBrief(
  metrics: ImpactMetrics,
  provinces: ProvinceMetric[],
  generatedAt: Date = new Date(),
): string {
  const date = generatedAt.toISOString().slice(0, 10);
  const gaps = provinces.filter((p) => p.coverage < 70);

  const lines: string[] = [
    `AEGIS-AI — GBV Response Impact Brief`,
    `Generated: ${date}`,
    ``,
    `Anonymised aggregate figures (POPIA compliant). No personally identifying`,
    `information is included in this report.`,
    ``,
    `OUTCOMES`,
    `- Cases resolved: ${metrics.casesResolved.toLocaleString()}`,
    `- Survivors supported: ${metrics.survivorsSupported.toLocaleString()}`,
    `- Average response time: ${metrics.avgResponseMinutes} minutes`,
    `- Resources connected: ${metrics.resourcesConnected.toLocaleString()}`,
    `- Provinces active: ${metrics.provincesActive} / 9`,
    `- Countries active: ${metrics.countriesActive}`,
    ``,
    `PROVINCIAL COVERAGE`,
    ...provinces.map(
      (p) =>
        `- ${p.province}: ${p.cases.toLocaleString()} cases, ${p.coverage}% coverage`,
    ),
    ``,
    `COVERAGE GAPS (below 70%)`,
    gaps.length > 0
      ? gaps.map((p) => `- ${p.province}: ${p.coverage}%`).join("\n")
      : `- None — all reported provinces at or above 70% coverage.`,
  ];

  return lines.join("\n");
}

/** Trigger a client-side download of a text artifact. No-op outside the browser. */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8",
): void {
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return;
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Convenience: filename stamped with the date, e.g. aegis-impact-2026-06-14.csv */
export function impactFilename(
  ext: string,
  generatedAt: Date = new Date(),
): string {
  return `aegis-impact-${generatedAt.toISOString().slice(0, 10)}.${ext}`;
}
