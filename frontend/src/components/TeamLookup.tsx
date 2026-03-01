import React, { useEffect, useState, useMemo } from 'react';
import type { Competition } from '../types/competition.types';
import type { Form, Submission, FormField } from '../types/form.types';
import { competitionApi, formApi, tbaApi } from '../services/api';
import { BarChart3 } from 'lucide-react';

// reuse helpers from ResponseViewer
const isQuantitative = (field: FormField) => field.type === 'number' || field.type === 'ranking';
const toNumber = (v: any) => (v === '' || v === null || v === undefined) ? null : Number(v);

export const TeamLookup: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [forms, setForms] = useState<Form[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  const [teamQuery, setTeamQuery] = useState('');
  const [teamInfo, setTeamInfo] = useState<any | null>(null);
  // no longer support name-based lookup; only number

  // refresh competitions on mount
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
    }
  }, [selectedForm?.id]);

  // clear team query/info when context changes
  useEffect(() => {
    setTeamQuery('');
    setTeamInfo(null);
  }, [selectedCompetition?.id, selectedForm?.id]);

  // filtered submissions by team query
  const filteredSubs = useMemo(() => {
    if (!teamQuery.trim()) return [];
    const q = teamQuery.trim().toLowerCase();
    return submissions.filter(sub => {
      return Object.values(sub.data).some(val => {
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [submissions, teamQuery]);

  const stats = useMemo(() => {
    if (!selectedForm) return [];
    return selectedForm.fields.filter(isQuantitative).map(field => {
      const vals = filteredSubs.map(s => toNumber(s.data?.[field.id])).filter((v): v is number => v !== null && !isNaN(v));
      const avg = vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
      return { field, mean: avg.toFixed(2), count: vals.length };
    });
  }, [selectedForm, filteredSubs]);

  const qualitativeSummary = useMemo(() => {
    if (!selectedForm) return {} as Record<string, string[]>;
    const summary: Record<string, Set<string>> = {};
    filteredSubs.forEach(sub => {
      selectedForm.fields.forEach(field => {
        if (!isQuantitative(field)) {
          const raw = sub.data?.[field.id];
          if (raw !== undefined && raw !== null && raw !== '') {
            const text = Array.isArray(raw) ? raw.join(', ') : String(raw);
            if (!summary[field.label]) summary[field.label] = new Set();
            summary[field.label].add(text);
          }
        }
      });
    });
    const out: Record<string, string[]> = {};
    Object.entries(summary).forEach(([k, set]) => {
      out[k] = Array.from(set);
    });
    return out;
  }, [selectedForm, filteredSubs]);

  const handleSearch = async () => {
    const q = teamQuery.trim();
    if (!q) {
      setTeamInfo(null);
      return;
    }

    try {
      if (!/^\d+$/.test(q)) {
        alert('Please enter a numeric team number');
        return;
      }

      const key = `frc${q}`;
      const data = await tbaApi.getTeam(key);
      setTeamInfo(data);
    } catch (err) {
      console.error('team lookup error', err);
      setTeamInfo(null);
    }
  };

  if (!selectedCompetition) return <div className="p-10 text-center text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6 pb-20">
      {/* Selectors */}
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
      </div>

      {/* Team search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <input
          placeholder="Team number..."
          value={teamQuery}
          onChange={e => setTeamQuery(e.target.value)}
          className="flex-1 border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
        />
        <button onClick={handleSearch} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-all">
          Search
        </button>
      </div>


      {teamInfo && (
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="font-black text-lg">{teamInfo.nickname || teamInfo.team_number}</div>
          <div className="text-sm text-gray-600">{teamInfo.team_number && `#${teamInfo.team_number}`}</div>
          {teamInfo.city && <div className="text-sm text-gray-600">{teamInfo.city}, {teamInfo.state_prov || teamInfo.country}</div>}
        </div>
      )}

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

          {/* Qualitative summary */}
          {Object.keys(qualitativeSummary).length > 0 && (
            <div className="space-y-4">
              {Object.entries(qualitativeSummary).map(([label, values]) => (
                <div key={label} className="bg-white p-4 rounded-lg shadow">
                  <div className="font-black text-sm mb-2">{label}</div>
                  <ul className="list-disc list-inside text-sm">
                    {values.map(v => <li key={v}>{v}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
