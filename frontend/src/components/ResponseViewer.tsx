import React, { useEffect, useMemo, useState } from 'react';
import type { Competition } from '../types/competition.types';
import type { Submission, Form } from '../types/form.types';
import { formApi } from '../services/api';
import { Filter, X, Download} from 'lucide-react';
import { isPictureFieldValue, submissionValueToText } from '../utils/formValues';

type FilterOp = 'contains' | 'equals' | 'gt' | 'lt';
const teamFieldRegex = /team|team number|team #/i;

const resolveTeamFieldId = (form: Form): number | null => {
  if (
    Number.isInteger(form.teamNumberFieldId)
    && form.fields.some((field) => field.id === form.teamNumberFieldId)
  ) {
    return form.teamNumberFieldId as number;
  }

  const fallbackField = form.fields.find((field) => teamFieldRegex.test(field.label));
  return fallbackField?.id ?? null;
};

// Helper for filtering
const toNumber = (v: any) => (v === '' || v === null || v === undefined) ? null : Number(v);

export const ResponseViewer: React.FC<{ selectedCompetition?: Competition | null }> = ({ selectedCompetition }) => {
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Filter State
  const [filterFieldId, setFilterFieldId] = useState<number | null>(null);
  const [filterOp, setFilterOp] = useState<FilterOp>('contains');
  const [filterValue, setFilterValue] = useState<string>('');

  useEffect(() => {
    if (selectedCompetition) {
      formApi.getFormsByCompetition(selectedCompetition.id).then(data => {
        setForms(data);
        setSelectedForm(data.length > 0 ? data[0] : null);
      });
    }
  }, [selectedCompetition?.id]);

  useEffect(() => {
    if (selectedForm) {
      setLoading(true);
      formApi.getSubmissions(selectedForm.id)
        .then(subs => {
          setSubmissions(subs);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      
      if (selectedForm.fields.length > 0) setFilterFieldId(selectedForm.fields[0].id);
    }
  }, [selectedForm?.id]);

  const handleExportCSV = async () => {
    if (!selectedForm || submissions.length === 0) return;
    setIsExporting(true);

    const teamFieldId = resolveTeamFieldId(selectedForm);
    if (teamFieldId === null) {
      alert('No team field found in form. Cannot export analyzed data.');
      setIsExporting(false);
      return;
    }

    // Group submissions by team
    const teamGroups: Record<string, Submission[]> = {};
    submissions.forEach(sub => {
      const teamValue = String(sub.data?.[teamFieldId] ?? '').trim();
      if (teamValue) {
        if (!teamGroups[teamValue]) teamGroups[teamValue] = [];
        teamGroups[teamValue].push(sub);
      }
    });

    // Prepare headers: Team, then quantitative fields, then qualitative fields
    const quantitativeFields = selectedForm.fields.filter(f => f.type === 'number' || f.type === 'ranking');
    const qualitativeFields = selectedForm.fields.filter(f => f.type !== 'number' && f.type !== 'ranking');
    
    const headers = ['Team', ...quantitativeFields.map(f => f.label), ...qualitativeFields.map(f => f.label)];

    // Prepare rows
    const csvRows = Object.entries(teamGroups).map(([team, teamSubs]) => {
      const row: string[] = [team];

      // Quantitative: averages
      quantitativeFields.forEach(field => {
        const vals = teamSubs.map(s => toNumber(s.data?.[field.id])).filter((v): v is number => v !== null && !isNaN(v));
        const avg = vals.length === 0 ? '' : (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
        row.push(avg);
      });

      // Qualitative: unique values comma-separated
      qualitativeFields.forEach(field => {
        const values = new Set<string>();
        teamSubs.forEach(sub => {
          const raw = sub.data?.[field.id];
          if (raw !== undefined && raw !== null && raw !== '') {
            const text = submissionValueToText(raw);
            values.add(text);
          }
        });
        row.push(Array.from(values).join('; '));
      });

      return row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedForm.name}_analyzed_data.csv`;
    link.click();
    setIsExporting(false);
  };

  const filteredSubmissions = useMemo(() => {
    if (!selectedForm || !filterFieldId || !filterValue.trim()) return submissions;
    const q = filterValue.trim().toLowerCase();
    return submissions.filter(sub => {
      const raw = sub.data?.[filterFieldId];
      const v = submissionValueToText(raw).toLowerCase();
      if (filterOp === 'gt' || filterOp === 'lt') {
        const numV = toNumber(raw);
        const numQ = toNumber(q);
        if (numV === null || numQ === null) return false;
        return filterOp === 'gt' ? numV > numQ : numV < numQ;
      }
      return filterOp === 'equals' ? v === q : v.includes(q);
    });
  }, [submissions, filterFieldId, filterValue, filterOp, selectedForm]);

  if (!selectedCompetition) return <div className="p-10 text-center text-gray-400">No active competition selected</div>;

  return (
    <div className="space-y-6 pb-20">
      {/* Top Selectors */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Form</label>
          <select value={selectedForm?.id || ''} onChange={(e) => setSelectedForm(forms.find(f => f.id === e.target.value) || null)} className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500">
            {forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <button onClick={handleExportCSV} disabled={!selectedForm || isExporting} className="w-full md:w-auto px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 flex items-center justify-center gap-2 transition-all">
          <Download size={18} /> {isExporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center font-black text-gray-300 animate-pulse tracking-widest uppercase">Fetching Data...</div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
            <Filter size={18} className="text-gray-400 ml-2" />
            <select className="border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 font-bold" value={filterFieldId || ''} onChange={(e) => setFilterFieldId(Number(e.target.value))}>
              {selectedForm?.fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <select className="border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 font-mono font-bold" value={filterOp} onChange={(e) => setFilterOp(e.target.value as FilterOp)}>
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="gt">Value {'>'}</option>
              <option value="lt">Value {'<'}</option>
            </select>
            <input placeholder="Search records..." value={filterValue} onChange={(e) => setFilterValue(e.target.value)} className="flex-1 border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium" />
            {filterValue && <button onClick={() => setFilterValue('')} className="p-2 text-gray-400 hover:text-red-500"><X size={20}/></button>}
          </div>

          {/* Submission Cards */}
          <div className="space-y-4">
            {filteredSubmissions.length === 0 ? (
              <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed font-bold italic">No records match this filter.</div>
            ) : (
              filteredSubmissions.map(sub => (
                <div key={sub.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 transition-all">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(sub.timestamp).toLocaleString()}</span>
                    <span className="text-[9px] font-bold text-blue-400 px-2 py-0.5 bg-blue-50 rounded uppercase">Verified Entry</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {selectedForm?.fields.map(f => (
                      <div key={f.id} className="space-y-1">
                        <div className="text-[9px] uppercase font-black text-blue-500 tracking-tighter opacity-70">{f.label}</div>
                        <div className="text-sm font-bold text-gray-800">
                          {(() => {
                            const fieldValue = sub.data?.[f.id];
                            if (!isPictureFieldValue(fieldValue)) {
                              return submissionValueToText(fieldValue) || '—';
                            }

                            return (
                            <a
                              href={fieldValue.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block space-y-2"
                            >
                              <img
                                src={fieldValue.url}
                                alt={f.label}
                                className="h-28 w-full rounded-lg border border-gray-200 bg-gray-50 object-cover"
                              />
                              <span className="block break-words text-xs font-medium text-blue-600">
                                {fieldValue.name || 'Open uploaded image'}
                              </span>
                            </a>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};