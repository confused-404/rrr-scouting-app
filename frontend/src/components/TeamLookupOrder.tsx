import { GripVertical } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GameConfiguration } from '../types/game-profile.types';

const formId = (sourceKey: string) => sourceKey.match(/^form-(.+)-field-\d+$/)?.[1] || null;

export const TeamLookupOrder: React.FC<{ configuration: GameConfiguration; onChange: (configuration: GameConfiguration) => void; editable: boolean }> = ({ configuration, onChange, editable }) => {
  const [dragged, setDragged] = useState<string | null>(null);
  const sections = useMemo(() => {
    const forms = new Map<string, string>();
    const other = configuration.metrics.filter((metric) => metric.destinations.includes('team_lookup')).flatMap((metric) => {
      const id = formId(metric.sourceKey);
      if (id) { if (!forms.has(id)) forms.set(id, metric.label.split(':')[0] || 'Scouting Form'); return []; }
      return [{ id: `metric-${metric.id}`, kind: 'metric' as const, metricId: metric.id, label: metric.label }];
    });
    const available = [...[...forms].map(([id, label]) => ({ id: `form-${id}`, kind: 'form' as const, label })), ...other];
    const byId = new Map(available.map((item) => [item.id, item]));
    const saved = configuration.teamLookupSections.map((item) => byId.get(item.id)).filter((item): item is typeof available[number] => Boolean(item));
    return [...saved, ...available.filter((item) => !configuration.teamLookupSections.some((savedSection) => savedSection.id === item.id))];
  }, [configuration]);
  const saveOrder = (next: typeof sections) => onChange({ ...configuration, teamLookupSections: next.map((section) => section.kind === 'metric' ? { id: section.id, kind: section.kind, metricId: section.metricId } : { id: section.id, kind: section.kind }) });
  const move = (target: string) => { if (!dragged || dragged === target) return; const next = [...sections]; const from = next.findIndex((item) => item.id === dragged); const to = next.findIndex((item) => item.id === target); next.splice(to, 0, next.splice(from, 1)[0]); saveOrder(next); };
  return <section className="rounded-lg border border-gray-200 p-4"><h4 className="font-bold text-gray-900">Team Lookup Order</h4><p className="mt-1 text-sm text-gray-500">Drag whole form sections or other legacy sections. Questions remain in their form’s original order.</p><div className="mt-3 space-y-2">{sections.map((section) => <div key={section.id} draggable={editable} onDragStart={() => setDragged(section.id)} onDragOver={(event) => editable && event.preventDefault()} onDrop={() => { move(section.id); setDragged(null); }} onDragEnd={() => setDragged(null)} className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${editable ? 'cursor-grab' : ''} ${dragged === section.id ? 'bg-blue-50' : 'bg-white'}`}><GripVertical size={16} className="text-gray-400" /><span>{section.label}</span><span className="ml-auto text-xs text-gray-500">{section.kind === 'form' ? 'Form section' : 'Legacy section'}</span></div>)}</div></section>;
};
