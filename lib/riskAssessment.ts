import { Asset, AssetRiskAssessment, RiskFactor, RiskFactorKind, RiskLevel } from "@/types";

export const LEVEL_ORDER: Record<RiskLevel, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };

export function maxLevel(levels: RiskLevel[]): RiskLevel {
  return levels.reduce((worst, level) => (LEVEL_ORDER[level] > LEVEL_ORDER[worst] ? level : worst), "Low" as RiskLevel);
}

export function factorsForAsset(riskFactors: RiskFactor[], asset: Asset, kind: RiskFactorKind): RiskFactor[] {
  return riskFactors.filter((f) => f.kind === kind && f.categories.includes(asset.category));
}

export function assessmentStatus(
  assessments: AssetRiskAssessment[] | { assetId: string; riskFactorId: string; status: AssetRiskAssessment["status"] }[],
  assetId: string,
  riskFactorId: string
): AssetRiskAssessment["status"] {
  const match = assessments.find((a) => a.assetId === assetId && a.riskFactorId === riskFactorId);
  return match?.status ?? "Not Met";
}

export interface AssetRiskSummary {
  /** How many risk factors of this kind apply to the asset's category. Always > 0 — a summary is only returned when something is configured. */
  applicableCount: number;
  /** Count of applicable factors not currently "Met". */
  openCount: number;
  /** True only if every Critical-severity applicable factor is "Met". Vacuously true when there are no Critical factors. */
  isWellManaged: boolean;
  /** Worst outstanding levels, driven by ALL open factors regardless of severity — null when nothing is outstanding. */
  worstSeverity: RiskLevel | null;
  worstLikelihood: RiskLevel | null;
  worstImpact: RiskLevel | null;
  worstFactorName: string | null;
}

/**
 * Summarizes one asset's exposure for one risk-factor kind.
 * Returns null when nothing of this kind is mapped to the asset's category — that's
 * "not configured", distinct from "well managed", and must not be treated as compliant.
 */
export function summarizeAssetRisk(
  asset: Asset,
  riskFactors: RiskFactor[],
  assessments: { assetId: string; riskFactorId: string; status: AssetRiskAssessment["status"] }[],
  kind: RiskFactorKind
): AssetRiskSummary | null {
  const applicable = factorsForAsset(riskFactors, asset, kind);
  if (applicable.length === 0) return null;

  const statusOf = (f: RiskFactor) => assessmentStatus(assessments, asset.id, f.id);
  const outstanding = applicable.filter((f) => statusOf(f) !== "Met");
  const criticalFactors = applicable.filter((f) => f.severity === "Critical");
  const isWellManaged = criticalFactors.every((f) => statusOf(f) === "Met");

  if (outstanding.length === 0) {
    return {
      applicableCount: applicable.length, openCount: 0, isWellManaged,
      worstSeverity: null, worstLikelihood: null, worstImpact: null, worstFactorName: null,
    };
  }

  const worstFactor = outstanding.reduce((worst, f) =>
    LEVEL_ORDER[f.severity] > LEVEL_ORDER[worst.severity] ? f : worst
  );

  return {
    applicableCount: applicable.length,
    openCount: outstanding.length,
    isWellManaged,
    worstSeverity: maxLevel(outstanding.map((f) => f.severity)),
    worstLikelihood: maxLevel(outstanding.map((f) => f.likelihood)),
    worstImpact: maxLevel(outstanding.map((f) => f.impact)),
    worstFactorName: worstFactor.name,
  };
}
