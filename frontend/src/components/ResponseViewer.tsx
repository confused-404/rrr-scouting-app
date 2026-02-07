import React, { useEffect, useMemo, useState } from 'react';
import type { Competition } from '../types/competition.types';
import type { Submission, Form, FormField } from '../types/form.types';
import { competitionApi, formApi } from '../services/api';
import { Filter, X, BarChart3, Database } from 'lucide-react';

type FilterOp = 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes';

interface ResponseViewerProps {
  competitionId?: string;
  onFormSelect?: (id: string | null) => void;
}

// Helpers for Stats
function isQuantitative(field: FormField) { 
  return field.type === 'number' || field.type === 'ranking'; 
}

function toNumber(v: any) { 
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v); 
  return isNaN(n) ? null : n; 
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({ competitionId, onFormSelect }) => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter State
  const [filterFieldId, setFilterFieldId] = useState<number | null>(null);
  const [filterOp, setFilterOp] = useState<FilterOp>('contains');
  const [filterValue, setFilterValue] = useState<string>('');

  // 1. Initial Load of Competitions
  useEffect(() => {
    competitionApi.getAll().then(setCompetitions).catch(console.error);
  }, []);

  // 2. Sync Competition from Prop (from AdminMode)
  useEffect(() => {
    if (competitionId && competitions.length > 0) {
      const comp = competitions.find(c => c.id === competitionId);
      if (comp) setSelectedCompetition(comp);
    }
  }, [competitionId, competitions]);

  // 3. Load Forms when Competition changes
  useEffect(() => {
    if (selectedCompetition) {
      formApi.getFormsByCompetition(selectedCompetition.id)
        .then(data => {
          setForms(data);
          if (data.length > 0) {
            setSelectedForm(data[0]);
          } else {
            setSelectedForm(null);
          }
        })
        .catch(console.error);
    }
  }, [selectedCompetition]);

  // 4. Load Submissions when Form changes & Notify Parent for Exporting
  useEffect(() => {
    onFormSelect?.(selectedForm?.id || null);

    if (selectedForm) {
      setLoading(true);
      formApi.getSubmissions(selectedForm.id)
        .then(subs => {
          setSubmissions(subs);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
      
      if (selectedForm.fields.length > 0 && !filterFieldId) {
        setFilterFieldId(selectedForm.fields[0].id);
      }
    } else {
      setSubmissions([]);
    }
  }, [selectedForm?.id]);

  // 5. Advanced Filtering Logic
  const filteredSubmissions = useMemo(() => {
    if (!selectedForm || !filterFieldId || !filterValue.trim()) return submissions;
    const q = filterValue.trim().toLowerCase();
    
    return submissions.filter(sub => {
      const rawValue = sub.data?.[filterFieldId];
      const v = String(rawValue ?? '').toLowerCase();
      
      // Numeric Logic
      if (filterOp === 'gt' || filterOp === 'lt' || filterOp === 'gte' || filterOp === 'lte') {
        const numV = toNumber(rawValue);
        const numQ = toNumber(filterValue);
        if (numV === null || numQ === null) return false;
        if (filterOp === 'gt') return numV > numQ;
        if (filterOp === 'lt') return numV < numQ;
        if (filterOp === 'gte') return numV >= numQ;
        if (filterOp === 'lte') return numV <= numQ;
      }

      // String Logic
      if (filterOp === 'equals') return v === q;
      if (filterOp === 'starts_with') return v.startsWith(q);
      if (filterOp === 'ends_with') return v.endsWith(q);
      return v.includes(q);
    });
  }, [submissions, filterFieldId, filterValue, filterOp, selectedForm]);

  // 6. Quantitative Statistics
  const stats = useMemo(() => {
    if (!selectedForm) return [];
    return selectedForm.fields.filter(isQuantitative).map(field => {
      const vals = filteredSubmissions
        .map(s => toNumber(s.data?.[field.id]))
        .filter((v): v is number => v !== null);

      if (vals.length === 0) return { field, mean: "0.00", count: 0 };
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      return { field, mean: avg.toFixed(2), count: vals.length };
    });
  }, [selectedForm, filteredSubmissions]);

  if (!selectedCompetition) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center border-2 border-dashed border-gray-200">
        <Database className="mx-auto text-gray-300 mb-4" size={48} />
        <h3 className="text-lg font-medium text-gray-900">No Competition Selected</h3>
        <p className="text-gray-500 text-sm">Select a competition in the sidebar or Competitions tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selection Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Competition Context</label>
          <select 
            value={selectedCompetition.id} 
            onChange={(e) => {
                const comp = competitions.find(c => c.id === e.target.value);
                if (comp) setSelectedCompetition(comp);
            }} 
            className="w-full bg-gray-50 border-none rounded-md px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500"
          >
            {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Active Scouting Form</label>
          <select 
            value={selectedForm?.id || ''} 
            onChange={(e) => {
                const form = forms.find(f => f.id === e.target.value);
                if (form) setSelectedForm(form);
            }} 
            className="w-full bg-gray-50 border-none rounded-md px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500"
          >
            {forms.length > 0 ? (
              forms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)
            ) : (
              <option value="">No forms available</option>
            )}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-20 text-center text-gray-400 animate-pulse font-medium uppercase tracking-widest text-xs">Fetching records...</div>
      ) : (
        <>
          {/* Statistics Grid */}
          {stats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.map(s => (
                <div key={s.field.id} className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg border-b-4 border-blue-800">
                  <div className="flex items-center gap-2 mb-2 opacity-80 uppercase text-[10px] font-black tracking-widest">
                    <BarChart3 size={14}/> {s.field.label}
                  </div>
                  <div className="text-3xl font-black tracking-tighter">{s.mean}</div>
                  <div className="text-[10px] mt-1 opacity-60 font-bold uppercase tracking-tight">Avg from {s.count} Entries</div>
                </div>
              ))}
            </div>
          )}

          {/* Advanced Filter Bar */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-gray-400 mr-2">
                <Filter size={18} />
                <span className="text-xs font-black uppercase tracking-wider">Filter</span>
            </div>
            
            <select 
              className="border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              value={filterFieldId || ''}
              onChange={(e) => setFilterFieldId(Number(e.target.value))}
            >
              {selectedForm?.fields.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>

            <select 
              className="border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              value={filterOp}
              onChange={(e) => setFilterOp(e.target.value as FilterOp)}
            >
              <option value="contains">Contains</option>
              <option value="equals">Equals</option>
              <option value="gt">Value &gt;</option>
              <option value="lt">Value &lt;</option>
              <option value="starts_with">Starts With</option>
            </select>

            <input 
              placeholder="Search values..." 
              value={filterValue} 
              onChange={(e) => setFilterValue(e.target.value)} 
              className="flex-1 border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
            />

            {filterValue && (
                <button onClick={() => setFilterValue('')} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <X size={20}/>
                </button>
            )}
          </div>

          {/* Responses Display (Card List) */}
          <div className="space-y-4">
            {filteredSubmissions.length === 0 ? (
                <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed font-medium italic">
                    No scouting records found for this filter.
                </div>
            ) : (
                filteredSubmissions.map(sub => (
                    <div key={sub.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                Timestamp: {new Date(sub.timestamp).toLocaleString()}
                            </span>
                        </div>
                        <span className="text-[9px] font-bold text-gray-300">ID: {sub.id.slice(0,8)}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {selectedForm?.fields.map(f => (
                          <div key={f.id} className="space-y-1">
                            <div className="text-[9px] uppercase font-black text-blue-500 tracking-tighter opacity-70">{f.label}</div>
                            <div className="text-sm font-bold text-gray-800 break-words leading-tight">
                                {Array.isArray(sub.data?.[f.id]) 
                                    ? sub.data[f.id].join(', ') 
                                    : String(sub.data?.[f.id] ?? '—')}
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