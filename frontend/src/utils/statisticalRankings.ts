import type { AnalysisEquation } from '../types/game-profile.types';

export type StatisticalRanking = {
  team: string;
  score: number;
  metricCount: number;
};

export const scoreTeamsForEquation = (
  equation: AnalysisEquation,
  valuesByTeam: Map<string, Record<string, number>>,
): StatisticalRanking[] => Array.from(valuesByTeam.entries())
  .map(([team, values]) => {
    let score = 0;
    let metricCount = 0;
    for (const weight of equation.metricWeights) {
      const value = values[weight.metricId];
      if (!Number.isFinite(value)) continue;
      score += value * weight.weight;
      metricCount += 1;
    }
    return { team, score, metricCount };
  })
  .filter((row) => row.metricCount > 0)
  .sort((left, right) => right.score - left.score || left.team.localeCompare(right.team));
