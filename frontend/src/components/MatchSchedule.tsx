import React, { useEffect, useState } from 'react';
import type { Competition } from '../types/competition.types';
import { tbaApi } from '../services/api';

export const MatchSchedule: React.FC<{ selectedCompetition?: Competition | null }> = ({ selectedCompetition }) => {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedCompetition?.eventKey) {
      setMatches([]);
      return;
    }
    setLoading(true);
    tbaApi.getEventMatches(selectedCompetition.eventKey)
      .then(data => setMatches(data || []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [selectedCompetition]);

  if (!selectedCompetition) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <p>No active competition selected</p>
      </div>
    );
  }

  if (!selectedCompetition.eventKey) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <p>No event key configured for this competition</p>
        <p className="text-sm text-gray-400">Admins can set the event key in the Competitions tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {loading ? (
        <div className="py-20 text-center font-black text-gray-300 animate-pulse tracking-widest uppercase">Loading schedule...</div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800">{selectedCompetition.name} - Match Schedule</h3>
          </div>
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