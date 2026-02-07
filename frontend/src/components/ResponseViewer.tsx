import React, { useEffect, useMemo, useState } from 'react';
import type { Competition } from '../types/competition.types';
import type { Submission, Form, FormField } from '../types/form.types';
import { competitionApi, formApi } from '../services/api';
import { Filter, X, BarChart3, Database, Download, ChevronRight } from 'lucide-react';

type FilterOp = 'contains' | 'equals' | 'gt' | 'lt';

// Helpers for Stats
const isQuantitative = (field: FormField) => field.type === 'number' || field.type === 'ranking';
const toNumber = (v: any) => (v === '' || v === null || v === undefined) ? null : Number(v);

export const ResponseViewer: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
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
    competitionApi.getAll().then(data => {
      setCompetitions(data);
      if (data.length > 0) setSelectedCompetition(data[0]);
    });
  }, []);

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
    const headers = selectedForm.fields.map(f => f.label);
    const fieldIds = selectedForm.fields.map(f => String(f.id));
    const csvRows = submissions.map((sub: any) => 
      fieldIds.map(id => `"${String(sub.data[id] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedForm.name}_data.csv`;
    link.click();
    setIsExporting(false);
  };

  const filteredSubmissions = useMemo(() => {
    if (!selectedForm || !filterFieldId || !filterValue.trim()) return submissions;
    const q = filterValue.trim().toLowerCase();
    return submissions.filter(sub => {
      const raw = sub.data?.[filterFieldId];
      const v = String(raw ?? '').toLowerCase();
      if (filterOp === 'gt' || filterOp === 'lt') {
        const numV = toNumber(raw);
        const numQ = toNumber(q);
        if (numV === null || numQ === null) return false;
        return filterOp === 'gt' ? numV > numQ : numV < numQ;
      }
      return filterOp === 'equals' ? v === q : v.includes(q);
    });
  }, [submissions, filterFieldId, filterValue, filterOp, selectedForm]);

  const stats = useMemo(() => {
    if (!selectedForm) return [];
    return selectedForm.fields.filter(isQuantitative).map(field => {
      const vals = filteredSubmissions.map(s => toNumber(s.data?.[field.id])).filter((v): v is number => v !== null && !isNaN(v));
      const avg = vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
      return { field, mean: avg.toFixed(2), count: vals.length };
    });
  }, [selectedForm, filteredSubmissions]);

  if (!selectedCompetition) return <div className="p-10 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 pb-20">
      {/* Top Selectors */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Competition</label>
          <select value={selectedCompetition.id} onChange={(e) => setSelectedCompetition(competitions.find(c => c.id === e.target.value) || null)} className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500">
            {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
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
          {/* Stats Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map(s => (
              <div key={s.field.id} className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg border-b-4 border-blue-800">
                <div className="flex items-center gap-2 mb-2 opacity-80 uppercase text-[10px] font-black tracking-widest"><BarChart3 size={14}/> {s.field.label}</div>
                <div className="text-3xl font-black">{s.mean}</div>
                <div className="text-[10px] mt-1 opacity-60 font-bold uppercase tracking-tight">Average of {s.count} responses</div>
              </div>
            ))}
          </div>

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
                          {Array.isArray(sub.data?.[f.id]) ? sub.data[f.id].join(', ') : String(sub.data?.[f.id] ?? '—')}
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