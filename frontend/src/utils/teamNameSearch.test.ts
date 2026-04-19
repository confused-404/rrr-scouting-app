import { describe, expect, it } from 'vitest';
import { matchesTeamQuery } from './teamNameSearch';

describe('matchesTeamQuery', () => {
  it('matches by numeric team substring', () => {
    expect(matchesTeamQuery('254', 'The Cheesy Poofs', '25')).toBe(true);
  });

  it('matches by normalized frc prefix', () => {
    expect(matchesTeamQuery('254', 'The Cheesy Poofs', 'frc254')).toBe(true);
  });

  it('matches by full nickname substring with flexible case', () => {
    expect(matchesTeamQuery('271', 'Red Rock Robotics', 'red rock')).toBe(true);
  });

  it('matches by abbreviation', () => {
    expect(matchesTeamQuery('271', 'Red Rock Robotics', 'rrr')).toBe(true);
  });

  it('returns false when neither number nor nickname match', () => {
    expect(matchesTeamQuery('271', 'Red Rock Robotics', 'cheesy')).toBe(false);
  });
});
