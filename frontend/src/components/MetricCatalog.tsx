import { useEffect } from 'react';
import type { ConfigMetric, ConfigRole, GameConfiguration, MetricSource } from '../types/game-profile.types';

export type CatalogMetric = Omit<ConfigMetric, 'visibility' | 'destinations'>;
const destinations = ['team_lookup', 'analytics'] as const;
const roles: ConfigRole[] = ['scout', 'driveTeam', 'admin'];
const sourceLabel: Record<MetricSource, string> = { scout: 'Scout data', tba: 'TBA', statbotics: 'Statbotics', admin: 'Team observations' };
const toggle = <T extends string,>(items: T[], item: T) => items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
const defaults = (definition: CatalogMetric): ConfigMetric => ({ ...definition, visibility: roles, destinations: ['team_lookup'] });

export const METRIC_CATALOG: CatalogMetric[] = [
  ['tba-rank', 'TBA event rank', 'tba', 'ranking', 'latest', 'number'], ['tba-opr', 'TBA OPR', 'tba', 'opr', 'latest', 'number'], ['tba-dpr', 'TBA DPR', 'tba', 'dpr', 'latest', 'number'], ['tba-ccwm', 'TBA CCWM', 'tba', 'ccwm', 'latest', 'number'],
  ['statbotics-epa', 'Statbotics total EPA', 'statbotics', 'epa.total', 'average', 'number'], ['statbotics-auto', 'Statbotics auto EPA', 'statbotics', 'epa.auto', 'average', 'number'], ['statbotics-teleop', 'Statbotics teleop EPA', 'statbotics', 'epa.teleop', 'average', 'number'], ['statbotics-endgame', 'Statbotics endgame EPA', 'statbotics', 'epa.endgame', 'average', 'number'], ['statbotics-teleop-match', 'Statbotics teleop EPA per match', 'statbotics', 'epa.teleop_per_match', 'average', 'number'],
  ['superscout-rating', 'Superscouter rating', 'admin', 'superscout_rating', 'latest', 'number'], ['superscout-notes', 'Superscouter comments', 'admin', 'superscout_notes', 'latest', 'text'], ['drive-strategy', 'Drive-team strategy notes', 'admin', 'drive_team_strategy', 'latest', 'text'], ['pit-location', 'Pit location', 'admin', 'pit_location', 'latest', 'text'], ['robot-reliability', 'Robot breakdown timeline / reliability', 'admin', 'robot_reliability', 'latest', 'text'],
].map(([id, label, source, sourceKey, aggregation, format]) => ({ id, label, source: source as MetricSource, sourceKey, aggregation: aggregation as ConfigMetric['aggregation'], scope: 'current_competition', format: format as ConfigMetric['format'] }));

export const MetricCatalog: React.FC<{ configuration: GameConfiguration; onChange: (configuration: GameConfiguration) => void; editable: boolean; scoutMetrics?: CatalogMetric[] }> = ({ configuration, onChange, editable, scoutMetrics = [] }) => {
  const update = (definition: CatalogMetric, change: Partial<ConfigMetric>) => {
    const metric = { ...defaults(definition), ...configuration.metrics.find((entry) => entry.id === definition.id), ...change };
    const metrics = [...configuration.metrics.filter((entry) => entry.id !== definition.id), metric];
    onChange({ ...configuration, metrics });
  };
  const catalog = [...scoutMetrics, ...METRIC_CATALOG];

  useEffect(() => {
    if (!editable) return;
    // An existing profile may intentionally omit a metric. Reopening Configure
    // must never silently re-enable it just because the catalog remounted.
    if (configuration.metrics.length > 0) return;
    const metrics = catalog.map(defaults);
    if (!metrics.length) return;
    onChange({ ...configuration, metrics });
  }, [catalog, configuration, editable, onChange]);

  return <section className="rounded-lg border border-gray-200 p-4"><h4 className="font-bold text-gray-900">Metric Catalog</h4><p className="mt-1 text-sm text-gray-500">All supported metrics start in Team Lookup. Turn off Team Lookup or a role to hide that metric in preview.</p><div className="mt-4 space-y-2">{catalog.map((definition) => { const metric = { ...defaults(definition), ...configuration.metrics.find((entry) => entry.id === definition.id) }; const allowed = definition.format === 'image' ? ['team_lookup'] as const : destinations; return <div key={definition.id} className="rounded-md bg-gray-50 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><span><strong>{definition.label}</strong><span className="ml-2 text-xs text-gray-500">{sourceLabel[definition.source]}{definition.format === 'image' ? ' · display only' : ''}</span></span></div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs"><span className="font-semibold text-gray-600">Visible to:</span>{roles.map((role) => <label key={role}><input type="checkbox" checked={metric.visibility.includes(role)} disabled={!editable} onChange={() => update(definition, { visibility: toggle(metric.visibility, role) })} /> <span className="ml-1">{role === 'driveTeam' ? 'Drive Team' : role}</span></label>)}<span className="ml-2 font-semibold text-gray-600">Use in:</span>{allowed.map((destination) => <label key={destination}><input type="checkbox" checked={metric.destinations.includes(destination)} disabled={!editable} onChange={() => update(definition, { destinations: toggle(metric.destinations, destination) })} /> <span className="ml-1">{destination.replaceAll('_', ' ')}</span></label>)}</div></div>; })}</div></section>;
};
