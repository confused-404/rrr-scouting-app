import type { FormField } from '@/components/FormConfiguration';

interface MatchFieldMap {
  autoGamePiecesId?: string;
  teleopGamePiecesId?: string;
  defenseId?: string;
  reliabilityId?: string;
  climbingId?: string;
  autoMobilityId?: string;
}

export const mapMatchFieldIds = (fields: FormField[] = []): MatchFieldMap => {
  const map: MatchFieldMap = {};

  const findByIdOrLabel = (candidates: string[], labelKeywords: string[]) => {
    for (const id of candidates) {
      const found = fields.find(f => f.id === id);
      if (found) return found.id;
    }
    const foundByLabel = fields.find(f => {
      const l = (f.label || '').toLowerCase();
      return labelKeywords.some(k => l.includes(k));
    });
    return foundByLabel?.id;
  };

  map.autoGamePiecesId = findByIdOrLabel(['autoGamePieces', 'auto_points', 'auto'], ['auto', 'autonomous', 'game pieces']);
  map.teleopGamePiecesId = findByIdOrLabel(['teleopGamePieces', 'teleop_points', 'teleop'], ['teleop', 'tele-op', 'tele op', 'game pieces']);
  map.defenseId = findByIdOrLabel(['defense', 'defenseRating', 'defense_rating'], ['defense']);
  map.reliabilityId = findByIdOrLabel(['reliability', 'reliabilityRating', 'reliability_rating'], ['reliability']);
  map.climbingId = findByIdOrLabel(['climbing', 'climb', 'climbAttempt'], ['climb', 'climbing']);
  map.autoMobilityId = findByIdOrLabel(['autoMobility', 'mobility', 'auto_mobility'], ['mobility', 'auto mobility']);

  return map;
};

// Safely retrieve a (possibly dynamic) field value from a saved scouting entry
export const getFieldValue = (entry: any, fieldId?: string) => {
  if (!fieldId) return undefined;
  if (!entry) return undefined;
  // dynamic typed entries store custom fields under `fields` key
  if (entry.fields && Object.prototype.hasOwnProperty.call(entry.fields, fieldId)) {
    return entry.fields[fieldId];
  }
  // fallback to top-level key
  if (Object.prototype.hasOwnProperty.call(entry, fieldId)) return entry[fieldId];
  return undefined;
};

export const toNumber = (v: any): number => {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^0-9.+-eE]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

// Compute a lightweight match score using common fields. Returns auto/teleop/total.
export const computeMatchScore = (entry: any, matchFields: FormField[] = []) => {
  const ids = mapMatchFieldIds(matchFields);

  const auto = toNumber(getFieldValue(entry, ids.autoGamePiecesId) ?? entry.autoGamePieces) || 0;
  const teleop = toNumber(getFieldValue(entry, ids.teleopGamePiecesId) ?? entry.teleopGamePieces) || 0;

  const total = auto + teleop;

  return { autoPoints: auto, teleopPoints: teleop, total };
};

export default {
  mapMatchFieldIds,
  getFieldValue,
  toNumber,
  computeMatchScore,
};
