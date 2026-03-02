/**
 * 本地规则引擎：对风险进行打分与分级
 * - clamp: 将 probability/impact 限制在 0-1
 * - score = probability * impact
 * - level: 2x2 矩阵 (Low / Medium / High / Critical)
 * - top 5 + summary
 */

export interface RiskInput {
  title: string;
  description: string;
  category: string;
  probability: number;
  impact: number;
}

export interface ScoredRisk extends RiskInput {
  score: number;
  level: "Low" | "Medium" | "High" | "Critical";
}

const MIN = 0;
const MAX = 1;

/** 将数值限制在 [MIN, MAX] */
export function clamp(value: number): number {
  return Math.min(MAX, Math.max(MIN, value));
}

/** 根据概率调整规则微调（可选：长周期、高技术复杂度等可略微提高概率） */
export function adjustProbability(
  raw: number,
  _context?: { duration_weeks?: number; tech_complexity?: string }
): number {
  return clamp(raw);
}

/** 计算 score = probability * impact */
export function computeScore(probability: number, impact: number): number {
  const p = clamp(probability);
  const i = clamp(impact);
  return Math.round(p * i * 100) / 100;
}

/**
 * 2x2 风险矩阵分级
 * - 横轴：probability (低/高 以 0.5 为界)
 * - 纵轴：impact (低/高 以 0.5 为界)
 * - Low: 低概率低影响
 * - Medium: 高概率低影响 或 低概率高影响
 * - High: 高概率高影响 且 score < 0.75
 * - Critical: 高概率高影响 且 score >= 0.75
 */
export function getLevel(probability: number, impact: number): ScoredRisk["level"] {
  const p = clamp(probability);
  const i = clamp(impact);
  const score = computeScore(p, i);
  const highP = p >= 0.5;
  const highI = i >= 0.5;
  if (!highP && !highI) return "Low";
  if (highP && highI) return score >= 0.75 ? "Critical" : "High";
  return "Medium";
}

/** 对一批风险进行打分与分级 */
export function scoreRisks(
  risks: RiskInput[],
  context?: { duration_weeks?: number; tech_complexity?: string }
): ScoredRisk[] {
  return risks.map((r) => {
    const probability = adjustProbability(r.probability, context);
    const impact = clamp(r.impact);
    const score = computeScore(probability, impact);
    const level = getLevel(probability, impact);
    return { ...r, probability, impact, score, level };
  });
}

/** 按 score 降序取 Top 5 */
export function getTop5(risks: ScoredRisk[]): ScoredRisk[] {
  return [...risks].sort((a, b) => b.score - a.score).slice(0, 5);
}

/** 2x2 矩阵：按 (probability 低/高, impact 低/高) 分组 */
export function getMatrixCells(risks: ScoredRisk[]): {
  lowP_lowI: ScoredRisk[];
  highP_lowI: ScoredRisk[];
  lowP_highI: ScoredRisk[];
  highP_highI: ScoredRisk[];
} {
  const lowP_lowI: ScoredRisk[] = [];
  const highP_lowI: ScoredRisk[] = [];
  const lowP_highI: ScoredRisk[] = [];
  const highP_highI: ScoredRisk[] = [];
  for (const r of risks) {
    const highP = r.probability >= 0.5;
    const highI = r.impact >= 0.5;
    if (!highP && !highI) lowP_lowI.push(r);
    else if (highP && !highI) highP_lowI.push(r);
    else if (!highP && highI) lowP_highI.push(r);
    else highP_highI.push(r);
  }
  return { lowP_lowI, highP_lowI, lowP_highI, highP_highI };
}

/** 简要摘要：Top 5 标题 + 各级数量 */
export function getSummary(risks: ScoredRisk[]): {
  top5Titles: string[];
  levelCounts: Record<ScoredRisk["level"], number>;
} {
  const top5 = getTop5(risks);
  const levelCounts: Record<ScoredRisk["level"], number> = {
    Low: 0,
    Medium: 0,
    High: 0,
    Critical: 0,
  };
  for (const r of risks) levelCounts[r.level]++;
  return {
    top5Titles: top5.map((r) => r.title),
    levelCounts,
  };
}
