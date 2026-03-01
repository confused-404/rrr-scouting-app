import React, { useEffect, useState } from 'react';
import type { Competition } from '../types/competition.types';
import { competitionApi, tbaApi } from '../services/api';

export const MatchSchedule: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);

  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    competitionApi.getAll().then(data => {
      setCompetitions(data);
      if (data.length > 0) {
        setSelectedCompetition(data[0]);
      }
    });
  }, []);

  // whenever competition (or its season) changes, update year and reload events
  useEffect(() => {
    const y = selectedCompetition?.season || new Date().getFullYear().toString();
    setYear(y);
  }, [selectedCompetition]);

  useEffect(() => {
    if (!year) return;
    tbaApi.getEvents(year).then(data => {
      setEvents(data || []);
      setSelectedEvent(data && data.length > 0 ? data[0] : null);
    }).catch(() => setEvents([]));
  }, [year]);

  useEffect(() => {
    if (!selectedEvent) {
      setMatches([]);
      return;
    }
    setLoading(true);
    tbaApi.getEventMatches(selectedEvent.key)
      .then(data => setMatches(data || []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [selectedEvent]);

  return (
    <div className="space-y-6 pb-20">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Competition</label>
          <select
            value={selectedCompetition?.id || ''}
            onChange={(e) => setSelectedCompetition(competitions.find(c => c.id === e.target.value) || null)}
            className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500"
          >
            {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Event</label>
          <select
            value={selectedEvent?.key || ''}
            onChange={(e) => setSelectedEvent(events.find(ev => ev.key === e.target.value) || null)}
            className="w-full bg-gray-50 border-none rounded-lg px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500"
          >
            {events.map(ev => <option key={ev.key} value={ev.key}>{ev.name} ({ev.key})</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center font-black text-gray-300 animate-pulse tracking-widest uppercase">Loading schedule...</div>
      ) : (
        <div className="space-y-4">
          {matches.length === 0 ? (
            <div className="p-12 text-center text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed font-bold italic">No matches available.</div>
          ) : (
            matches.map((m: any) => (
              <div key={m.key} className="bg-white p-4 rounded-lg shadow">
                <div className="font-black uppercase text-sm mb-2">
                  {m.comp_level}{m.match_number}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <div className="font-bold text-red-600">Red Alliance</div>
                    <ul className="list-disc list-inside">
                      {m.alliances.red.team_keys.map((tk: string) => <li key={tk}>{tk}</li>)}
                    </ul>
                  </div>
                  <div>
                    <div className="font-bold text-blue-600">Blue Alliance</div>
                    <ul className="list-disc list-inside">
                      {m.alliances.blue.team_keys.map((tk: string) => <li key={tk}>{tk}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};