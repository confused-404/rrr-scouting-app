import { describe, expect, it } from 'vitest';
import { scoreTeamsForEquation } from './statisticalRankings';

describe('scoreTeamsForEquation', () => {
  it('ranks only teams with at least one configured numeric metric', () => {
    const rankings = scoreTeamsForEquation({ id: 'eq', label: 'Test', scope: 'current_competition', metricWeights: [{ metricId: 'a', weight: 0.5 }, { metricId: 'b', weight: 0.5 }] }, new Map<string, Record<string, number>>([
      ['3006', { a: 8, b: 4 }],
      ['9999', { a: 9 }],
      ['0000', {}],
    ]));

    expect(rankings).toEqual([
      { team: '3006', score: 6, metricCount: 2 },
      { team: '9999', score: 4.5, metricCount: 1 },
    ]);
  });
});
