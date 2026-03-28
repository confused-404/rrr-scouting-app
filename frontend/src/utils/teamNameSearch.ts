/**
 * Checks whether a search query matches a team by number or name.
 *
 * Supported patterns:
 *   - Numeric team number substring  ("25"  matches "254")
 *   - Full name substring, case-insensitive  ("red rock" matches "Red Rock Robotics")
 *   - Any single word in the name  ("rock" matches "Red Rock Robotics")
 *   - Abbreviation matching  ("RRR" or "rrr" matches "Red Rock Robotics")
 *   - Flexible spacing  ("red  rock" treated same as "red rock")
 *   - Leading "frc" stripped from query  ("frc254" treated as "254")
 */
export function matchesTeamQuery(
  teamNumber: string,
  nickname: string,
  query: string,
): boolean {
  // Normalise query: strip leading frc, collapse spaces, lowercase
  const qRaw = query.replace(/\s+/g, ' ').trim().toLowerCase();
  const q = /^frc\d/.test(qRaw) ? qRaw.replace(/^frc/, '') : qRaw;
  if (!q) return true;

  const qCompact = q.replace(/\s+/g, '');

  // 1. Team number substring
  const num = teamNumber.toLowerCase().replace(/^frc/i, '');
  if (num.includes(q) || num.includes(qCompact)) return true;

  if (!nickname) return false;

  const name = nickname.toLowerCase();

  // 2. Full name substring ("red rock" → "Red Rock Robotics")
  if (name.includes(q)) return true;

  // 3. Compact name includes compact query (spacing flexible)
  const nameCompact = name.replace(/\s+/g, '');
  if (nameCompact.includes(qCompact)) return true;

  // 4. Abbreviation: first letter of each word ("rrr" → "Red Rock Robotics")
  const words = name.split(/\s+/).filter(Boolean);
  const abbrev = words.map(w => w[0] ?? '').join('');
  if (abbrev === qCompact || abbrev.startsWith(qCompact) || abbrev.includes(qCompact)) return true;

  // 5. Any single word in the name contains the query
  if (words.some(w => w.includes(qCompact))) return true;

  return false;
}
