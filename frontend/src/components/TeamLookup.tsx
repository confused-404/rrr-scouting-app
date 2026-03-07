import React, { useEffect, useState, useMemo } from 'react';
import type { Competition } from '../types/competition.types';
import type { Form, Submission, FormField } from '../types/form.types';
import { formApi, tbaApi } from '../services/api';
import { BarChart3 } from 'lucide-react';

// reuse helpers from ResponseViewer
const isQuantitative = (field: FormField) => field.type === 'number' || field.type === 'ranking';
const toNumber = (v: any) => (v === '' || v === null || v === undefined) ? null : Number(v);

export const TeamLookup: React.FC<{ selectedCompetition?: Competition | null }> = ({ selectedCompetition }) => {
  const [forms, setForms] = useState<Form[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  const [teamQuery, setTeamQuery] = useState('');
  const [teamInfo, setTeamInfo] = useState<any | null>(null);
  // no longer support name-based lookup; only number

  useEffect(() => {
    if (selectedCompetition) {
      loadAllData();
    }
  }, [selectedCompetition?.id]);

  const loadAllData = async () => {
    if (!selectedCompetition) return;
    setLoading(true);
    try {
      const loadedForms = await formApi.getFormsByCompetition(selectedCompetition.id);
      setForms(loadedForms);

      // Load submissions for all forms
      const allSubs: Submission[] = [];
      for (const form of loadedForms) {
        const subs = await formApi.getSubmissions(form.id);
        allSubs.push(...subs);
      }
      setAllSubmissions(allSubs);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // clear team query/info when context changes
  useEffect(() => {
    setTeamQuery('');
    setTeamInfo(null);
  }, [selectedCompetition?.id]);

  // filtered submissions by team query
  const filteredSubs = useMemo(() => {
    if (!teamQuery.trim()) return [];
    const q = teamQuery.trim().toLowerCase();
    return allSubmissions.filter(sub => {
      return Object.values(sub.data).some(val => {
        if (val === undefined || val === null) return false;
        return String(val).toLowerCase().includes(q);
      });
    });
  }, [allSubmissions, teamQuery]);

  const stats = useMemo(() => {
    const fieldStats: Record<string, { field: FormField; vals: number[] }> = {};
    forms.forEach(form => {
      form.fields.filter(isQuantitative).forEach(field => {
        if (!fieldStats[field.label]) {
          fieldStats[field.label] = { field, vals: [] };
        }
        // collect values from filteredSubs for this field
        filteredSubs.forEach(sub => {
          const val = toNumber(sub.data?.[field.id]);
          if (val !== null && !isNaN(val)) {
            fieldStats[field.label].vals.push(val);
          }
        });
      });
    });
    return Object.values(fieldStats).map(({ field, vals }) => {
      const avg = vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
      return { field, mean: avg.toFixed(2), count: vals.length };
    });
  }, [forms, filteredSubs]);

  const qualitativeSummary = useMemo(() => {
    const summary: Record<string, Set<string>> = {};
    forms.forEach(form => {
      form.fields.forEach(field => {
        if (!isQuantitative(field)) {
          filteredSubs.forEach(sub => {
            const raw = sub.data?.[field.id];
            if (raw !== undefined && raw !== null && raw !== '') {
              const text = Array.isArray(raw) ? raw.join(', ') : String(raw);
              if (!summary[field.label]) summary[field.label] = new Set();
              summary[field.label].add(text);
            }
          });
        }
      });
    });
    const out: Record<string, string[]> = {};
    Object.entries(summary).forEach(([k, set]) => {
      out[k] = Array.from(set);
    });
    return out;
  }, [forms, filteredSubs]);

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

  if (!selectedCompetition) return <div className="p-10 text-center text-gray-400">No active competition selected</div>;

  return (
    <div className="space-y-6 pb-20">
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
