import { describe, expect, it } from "vitest";
import {
  buildImpactCsv,
  buildPolicyBrief,
  impactFilename,
} from "@/lib/impactExport";
import type { ImpactMetrics, ProvinceMetric } from "@/hooks/useImpactMetrics";

const metrics: ImpactMetrics = {
  casesResolved: 8812,
  survivorsSupported: 11247,
  avgResponseMinutes: 14,
  resourcesConnected: 6439,
  provincesActive: 9,
  countriesActive: 3,
};

const provinces: ProvinceMetric[] = [
  { province: "Gauteng", cases: 3241, coverage: 94 },
  { province: "Limpopo", cases: 742, coverage: 64 },
];

const generatedAt = new Date("2026-06-14T10:00:00.000Z");

describe("buildImpactCsv", () => {
  it("emits a header, metric rows, and per-province rows", () => {
    const csv = buildImpactCsv(metrics, provinces, generatedAt);
    const lines = csv.split("\r\n");

    expect(lines[0]).toBe("AEGIS-AI Impact Report");
    expect(csv).toContain("Generated,2026-06-14T10:00:00.000Z");
    expect(csv).toContain("Section,Metric,Value");
    expect(csv).toContain("Outcomes,Cases resolved,8812");
    expect(csv).toContain("Provincial coverage,Gauteng — cases,3241");
    expect(csv).toContain("Provincial coverage,Limpopo — coverage %,64");
  });

  it("escapes fields containing commas", () => {
    const csv = buildImpactCsv(metrics, [
      { province: "Region, North", cases: 10, coverage: 50 },
    ]);
    expect(csv).toContain('"Region, North — cases"');
  });
});

describe("buildPolicyBrief", () => {
  it("includes outcomes and flags coverage gaps below 70%", () => {
    const brief = buildPolicyBrief(metrics, provinces, generatedAt);
    expect(brief).toContain("Generated: 2026-06-14");
    expect(brief).toContain("Cases resolved: 8,812");
    expect(brief).toContain("COVERAGE GAPS (below 70%)");
    expect(brief).toContain("Limpopo: 64%");
    expect(brief).not.toContain("Gauteng: 94%\n- Gauteng"); // gap section lists only <70
  });

  it("states when there are no coverage gaps", () => {
    const brief = buildPolicyBrief(
      metrics,
      [{ province: "Gauteng", cases: 3241, coverage: 94 }],
      generatedAt,
    );
    expect(brief).toContain("None — all reported provinces");
  });
});

describe("impactFilename", () => {
  it("stamps the date and extension", () => {
    expect(impactFilename("csv", generatedAt)).toBe(
      "aegis-impact-2026-06-14.csv",
    );
  });
});
