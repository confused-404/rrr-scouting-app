import React, { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import type { Competition, GeneratedAssignment } from '../types/competition.types';

interface ScouttingScheduleProps {
  selectedCompetition: Competition | null;
}

export const ScouttingSchedule: React.FC<ScouttingScheduleProps> = ({ selectedCompetition }) => {
  const [viewMode, setViewMode] = useState<'all' | 'myMatches'>('all');

  if (!selectedCompetition) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <Clock size={48} className="mx-auto mb-4 opacity-50" />
        <p>Please select a competition to view the scouting schedule</p>
      </div>
    );
  }

  const assignments = selectedCompetition.scoutingAssignments || [];

  if (assignments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <Clock size={48} className="mx-auto mb-4 opacity-50" />
        <p>No scouting schedule has been generated yet.</p>
        <p className="text-sm text-gray-400">Admins can generate schedules in the Scouting Teams tab.</p>
      </div>
    );
  }

  // Get unique teams and their assignments
  const uniqueTeams = useMemo(() => {
    const teamMap = new Map<string, GeneratedAssignment[]>();
    assignments.forEach(assignment => {
      if (!teamMap.has(assignment.teamId)) {
        teamMap.set(assignment.teamId, []);
      }
      teamMap.get(assignment.teamId)!.push(assignment);
    });
    return Array.from(teamMap.entries()).map(([teamId, teamAssignments]) => ({
      teamId,
      teamName: teamAssignments[0].teamName,
      assignments: teamAssignments.sort((a, b) => a.matchNumber - b.matchNumber),
    }));
  }, [assignments]);

  // Get position colors
  const getPositionColor = (position: string) => {
    return position.startsWith('red')
      ? 'bg-red-100 text-red-800'
      : 'bg-blue-100 text-blue-800';
  };

  const getPositionLabel = (position: string) => {
    const color = position.startsWith('red') ? 'Red' : 'Blue';
    const num = position.slice(-1);
    return `${color} ${num}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <Clock size={24} className="text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">Scouting Schedule</h2>
        </div>
        <p className="text-sm text-gray-500">
          {selectedCompetition.name} ({selectedCompetition.season})
        </p>
      </div>

      {/* View Mode Toggle */}
      <div className="bg-white rounded-lg shadow-sm p-2 flex gap-2">
        <button
          onClick={() => setViewMode('all')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            viewMode === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Matches
        </button>
        <button
          onClick={() => setViewMode('myMatches')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            viewMode === 'myMatches'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          My Assignments
        </button>
      </div>

      {/* Schedule View - All Matches */}
      {viewMode === 'all' && (
        <div className="space-y-2">
          {Array.from(
            { length: Math.max(...assignments.map(a => a.matchNumber)) },
            (_, i) => i + 1
          ).map((matchNum) => {
            const matchAssignments = assignments.filter(a => a.matchNumber === matchNum);
            return (
              <div
                key={matchNum}
                className="bg-white rounded-lg shadow-sm p-4 border border-gray-200"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-bold text-lg text-gray-800">Match {matchNum}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {matchAssignments.map((assignment) => (
                    <div
                      key={`${matchNum}-${assignment.position}`}
                      className={`px-4 py-3 rounded-lg ${getPositionColor(assignment.position)}`}
                    >
                      <div className="font-bold text-sm mb-1">{getPositionLabel(assignment.position)}</div>
                      <div className="text-sm font-semibold">{assignment.teamName}</div>
                      {assignment.scouts.length > 0 && (
                        <div className="text-xs mt-2 pt-2 border-t border-current border-opacity-20">
                          {assignment.scouts.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule View - My Assignments */}
      {viewMode === 'myMatches' && (
        <div className="space-y-4">
          {uniqueTeams.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
              <p>No assignments currently visible.</p>
              <p className="text-sm text-gray-400">Switch to "All Matches" to see the full schedule.</p>
            </div>
          ) : (
            uniqueTeams.map((team) => (
              <div key={team.teamId} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">{team.teamName}</h3>
                <div className="space-y-2">
                  {team.assignments.map((assignment) => (
                    <div
                      key={`${assignment.matchNumber}-${assignment.position}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="font-bold text-gray-800 w-24">Match {assignment.matchNumber}</div>
                        <div className={`px-3 py-1 rounded text-sm font-bold ${getPositionColor(assignment.position)}`}>
                          {getPositionLabel(assignment.position)}
                        </div>
                      </div>
                      {assignment.scouts.length > 0 && (
                        <div className="text-sm text-gray-500">
                          {assignment.scouts.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
