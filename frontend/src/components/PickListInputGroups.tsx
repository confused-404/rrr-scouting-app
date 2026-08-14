import { GripVertical, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GameConfiguration, PickListInputGroup } from '../types/game-profile.types';

const defaultGroup = (metric: GameConfiguration['metrics'][number]) => metric.source === 'tba' ? 'tba' : metric.source === 'statbotics' ? 'statbotics' : metric.format === 'number' || metric.format === 'percentage' ? 'quantitative' : 'qualitative';
const groupLabels: Record<string, string> = { quantitative: 'Quantitative Scouting', qualitative: 'Qualitative Scouting', tba: 'TBA Data', statbotics: 'Statbotics Data' };
const copyGroups = (groups: PickListInputGroup[]) => groups.map((group) => ({ ...group, metricIds: [...group.metricIds] }));

export const PickListInputGroups: React.FC<{ configuration: GameConfiguration; onChange: (configuration: GameConfiguration) => void; editable: boolean }> = ({ configuration, onChange, editable }) => {
  const [drag, setDrag] = useState<{ type: 'group' | 'metric'; id: string } | null>(null);
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const selectedMetrics = useMemo(() => configuration.metrics.filter((metric) => metric.destinations.includes('automatic_pick_list')), [configuration.metrics]);
  const groups = useMemo(() => {
    const selected = new Map(selectedMetrics.map((metric) => [metric.id, metric]));
    const used = new Set<string>();
    const next = copyGroups(configuration.pickListGroups || []).map((group) => ({ ...group, metricIds: group.metricIds.filter((id) => selected.has(id) && !used.has(id) && Boolean(used.add(id))) }));
    selectedMetrics.filter((metric) => !used.has(metric.id)).forEach((metric) => {
      const id = defaultGroup(metric);
      const group = next.find((item) => item.id === id);
      if (group) group.metricIds.push(metric.id);
      else next.push({ id, label: groupLabels[id], metricIds: [metric.id] });
    });
    return next.filter((group) => group.metricIds.length || groupLabels[group.id]);
  }, [configuration.pickListGroups, selectedMetrics]);
  const save = (next: PickListInputGroup[]) => onChange({ ...configuration, pickListGroups: next });
  const moveGroup = (targetId: string) => {
    if (drag?.type !== 'group' || drag.id === targetId) return;
    const next = copyGroups(groups); const from = next.findIndex((group) => group.id === drag.id); const to = next.findIndex((group) => group.id === targetId);
    if (from < 0 || to < 0) return; const [group] = next.splice(from, 1); next.splice(to, 0, group); save(next);
  };
  const moveMetric = (targetGroupId: string, targetMetricId?: string) => {
    if (drag?.type !== 'metric') return;
    const next = copyGroups(groups); const source = next.find((group) => group.metricIds.includes(drag.id)); const target = next.find((group) => group.id === targetGroupId);
    if (!source || !target) return; source.metricIds = source.metricIds.filter((id) => id !== drag.id);
    const index = targetMetricId ? target.metricIds.indexOf(targetMetricId) : target.metricIds.length;
    target.metricIds.splice(index < 0 ? target.metricIds.length : index, 0, drag.id); save(next);
  };
  const addGroup = () => {
    const label = newGroupLabel.trim(); if (!label) return;
    save([...groups, { id: `group-${crypto.randomUUID?.().slice(0, 8) || Date.now().toString(36)}`, label, metricIds: [] }]); setNewGroupLabel('');
  };

  return <section className="rounded-lg border border-gray-200 p-4"><h4 className="font-bold text-gray-900">Automatic Pick-list Inputs</h4><p className="mt-1 text-sm text-gray-500">Drag groups and metrics into the order the automatic pick-list should use. Select metrics in the catalog first.</p><div className="mt-4 space-y-3">{groups.some((group) => group.metricIds.length) ? groups.map((group) => <div key={group.id} draggable={editable} onDragStart={(event) => { setDrag({ type: 'group', id: group.id }); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => editable && event.preventDefault()} onDrop={() => { moveGroup(group.id); if (drag?.type === 'metric') moveMetric(group.id); setDrag(null); }} onDragEnd={() => setDrag(null)} className={`rounded-lg border p-3 ${drag?.type === 'group' && drag.id === group.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-gray-50'} ${editable ? 'cursor-grab' : ''}`}><div className="flex items-center gap-2 font-semibold text-gray-800"><GripVertical size={16} className="text-gray-400" />{group.label}</div><div className="mt-2 space-y-1">{group.metricIds.map((metricId) => { const metric = selectedMetrics.find((item) => item.id === metricId); return metric && <div key={metric.id} draggable={editable} onDragStart={(event) => { event.stopPropagation(); setDrag({ type: 'metric', id: metric.id }); event.dataTransfer.effectAllowed = 'move'; }} onDragOver={(event) => editable && event.preventDefault()} onDrop={(event) => { event.stopPropagation(); moveMetric(group.id, metric.id); setDrag(null); }} onDragEnd={() => setDrag(null)} className={`flex items-center gap-2 rounded bg-white px-3 py-2 text-sm shadow-sm ${drag?.type === 'metric' && drag.id === metric.id ? 'opacity-50' : ''}`}><GripVertical size={15} className="text-gray-400" />{metric.label}</div>; })}</div></div>) : <p className="text-sm text-gray-500">No automatic pick-list metrics selected yet.</p>}</div>{editable && <div className="mt-3 flex gap-2"><input value={newGroupLabel} onChange={(event) => setNewGroupLabel(event.target.value)} placeholder="New group name" className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm" /><button type="button" onClick={addGroup} className="inline-flex items-center gap-1 rounded bg-gray-900 px-3 py-2 text-sm font-semibold text-white"><Plus size={15} /> Add group</button></div>}</section>;
};
