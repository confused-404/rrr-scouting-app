import React, { useEffect, useState, useMemo } from 'react';
import type { Competition } from '../types/competition.types';
import type { Form, Submission, FormField } from '../types/form.types';
import { formApi, tbaApi } from '../services/api';
import { BarChart3, ClipboardList } from 'lucide-react';
import { submissionValueToText } from '../utils/formValues';

// reuse helpers from ResponseViewer
const isQuantitative = (field: FormField) => field.type === 'number' || field.type === 'ranking';
const toNumber = (v: any) => (v === '' || v === null || v === undefined) ? null : Number(v);

interface TeamLookupProps {
  selectedCompetition?: Competition | null;
  superscoutNotes?: string;
  targetTeam?: string; // To ensure notes only show for the active team
}

export const TeamLookup: React.FC<TeamLookupProps> = ({ 
  selectedCompetition, 
  superscoutNotes, 
  targetTeam 
}) => {
  const [forms, setForms] = useState<Form[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  const [teamQuery, setTeamQuery] = useState('');
  const [teamInfo, setTeamInfo] = useState<any | null>(null);

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

  useEffect(() => {
    setTeamQuery('');
    setTeamInfo(null);
  }, [selectedCompetition?.id]);

  const filteredSubs = useMemo(() => {
    if (!teamQuery.trim()) return [];
    const q = teamQuery.trim().toLowerCase();
    return allSubmissions.filter(sub => {
      return Object.values(sub.data).some(val => {
        if (val === undefined || val === null) return false;
        return submissionValueToText(val).toLowerCase().includes(q);
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
    const summary: Record<string, { type: FormField['type']; data: any }> = {};
    
    forms.forEach(form => {
      form.fields.forEach(field => {
        if (!isQuantitative(field) && field.type !== 'picture') {
          const fieldKey = `${field.label}|${field.id}`;
          
          if (field.type === 'multiple_choice') {
            const counts: Record<string, number> = {};
            filteredSubs.forEach(sub => {
              const val = sub.data?.[field.id];
              if (val !== undefined && val !== null && val !== '') {
                const key = String(val);
                counts[key] = (counts[key] || 0) + 1;
              }
            });
            summary[fieldKey] = { type: field.type, data: { counts, options: field.options || [] } };
            
          } else if (field.type === 'multiple_select') {
            const counts: Record<string, number> = {};
            filteredSubs.forEach(sub => {
              const val = sub.data?.[field.id];
              if (Array.isArray(val)) {
                val.forEach(option => {
                  counts[option] = (counts[option] || 0) + 1;
                });
              }
            });
            summary[fieldKey] = { type: field.type, data: { counts, options: field.options || [] } };
            
          } else if (field.type === 'rank_order') {
            const counts: Record<string, number> = {};
            filteredSubs.forEach(sub => {
              const val = sub.data?.[field.id];
              if (Array.isArray(val) && val.length > 0) {
                const compact = val
                  .map((item) => String(item ?? '').trim())
                  .filter((item) => item !== '');
                if (compact.length > 0) {
                  const rankingString = compact.join(' > ');
                  counts[rankingString] = (counts[rankingString] || 0) + 1;
                }
              }
            });
            summary[fieldKey] = { type: field.type, data: { counts, options: field.options || [] } };
            
          } else {
            const values = new Set<string>();
            filteredSubs.forEach(sub => {
              const raw = sub.data?.[field.id];
              if (raw !== undefined && raw !== null && raw !== '') {
                const text = submissionValueToText(raw);
                values.add(text);
              }
            });
            summary[fieldKey] = { type: field.type, data: Array.from(values) };
          }
        }
      });
    });
    return summary;
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

  // Only show notes if the current search query matches the team the notes belong to
  const showNotes = superscoutNotes && teamQuery.trim() === targetTeam?.trim();

  if (!selectedCompetition) return <div className="p-10 text-center text-gray-400">No active competition selected</div>;

  return (
    <div className="space-y-4 sm:space-y-6 pb-20">
      {/* Team search */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-center">
        <input
          placeholder="Team number..."
          value={teamQuery}
          onChange={e => setTeamQuery(e.target.value)}
          className="flex-1 border-gray-200 rounded-lg text-sm bg-gray-50 px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
        />
        <button onClick={handleSearch} className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-all">
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

      {/* NEW: Superscouter Notes Section */}
      {showNotes && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-3 text-amber-800 font-black uppercase text-xs tracking-widest">
            <ClipboardList size={18} /> Superscouter Insight
          </div>
          <div className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed font-medium">
            {superscoutNotes}
          </div>
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
              {Object.entries(qualitativeSummary).map(([fieldKey, summary]) => {
                const [label] = fieldKey.split('|');
                
                if (summary.type === 'multiple_choice' || summary.type === 'multiple_select' || summary.type === 'rank_order') {
                  const { counts, options } = summary.data;
                  const totalResponses = filteredSubs.length;
                  const displayItems = summary.type === 'rank_order' 
                    ? Object.keys(counts).sort((a, b) => counts[b] - counts[a])
                    : options;
                  
                  return (
                    <div key={fieldKey} className="bg-white p-4 rounded-lg shadow">
                      <div className="font-black text-sm mb-3">{label}</div>
                      <div className="space-y-2">
                        {displayItems.map((item: string) => {
                          const count = counts[item] || 0;
                          const percentage = totalResponses > 0 ? (count / totalResponses * 100).toFixed(1) : '0';
                          
                          return (
                            <div key={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                              <span className="text-sm break-words">{item}</span>
                              <div className="flex items-center gap-2 sm:min-w-[11rem]">
                                <div className="flex-1 sm:flex-none sm:w-24 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-blue-600 h-2 rounded-full" 
                                    style={{ width: `${percentage}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-medium text-gray-600 min-w-[3rem] text-right">
                                  {count} ({percentage}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                } else {
                  const values = summary.data as string[];
                  return (
                    <div key={fieldKey} className="bg-white p-4 rounded-lg shadow">
                      <div className="font-black text-sm mb-2">{label}</div>
                      <div className="text-sm text-gray-600 mb-2">
                        {values.length} unique response{values.length !== 1 ? 's' : ''}
                      </div>
                      <ul className="list-disc list-inside text-sm max-h-32 overflow-y-auto">
                        {values.slice(0, 10).map(v => <li key={v}>{v}</li>)}
                        {values.length > 10 && (
                          <li className="text-gray-500">... and {values.length - 10} more</li>
                        )}
                      </ul>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TeamLookup;