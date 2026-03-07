import React, { useState, useEffect } from 'react';
import { Users, Plus, X, Clock, Target } from 'lucide-react';
import type { Competition, ScoutingTeam, GeneratedAssignment } from '../types/competition.types';
import { competitionApi } from '../services/api';

export const ScoutingTeams: React.FC<{ selectedCompetition?: Competition | null }> = ({ selectedCompetition }) => {
  const [teams, setTeams] = useState<ScoutingTeam[]>([]);
  const [assignments, setAssignments] = useState<GeneratedAssignment[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newScoutName, setNewScoutName] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<ScoutingTeam['position']>('red1');
  const [shiftLength, setShiftLength] = useState(5);
  const [totalMatches, setTotalMatches] = useState(50);
  const [isSaving, setIsSaving] = useState(false);

  // Load teams/assignments when competition changes
  useEffect(() => {
    if (selectedCompetition) {
      setTeams(selectedCompetition.scoutingTeams || []);
      setAssignments(selectedCompetition.scoutingAssignments || []);
    }
  }, [selectedCompetition]);

  const saveToCompetition = async (updatedTeams: ScoutingTeam[], updatedAssignments?: GeneratedAssignment[]) => {
    if (!selectedCompetition) return;

    setIsSaving(true);
    try {
      await competitionApi.update(selectedCompetition.id, {
        scoutingTeams: updatedTeams,
        ...(updatedAssignments && { scoutingAssignments: updatedAssignments }),
      });
      setTeams(updatedTeams);
      if (updatedAssignments) setAssignments(updatedAssignments);
    } catch (error) {
      console.error('Error saving teams:', error);
      alert('Failed to save teams');
    } finally {
      setIsSaving(false);
    }
  };

  const createTeam = () => {
    if (!newTeamName.trim()) {
      alert('Please enter a team name');
      return;
    }

    const newTeam: ScoutingTeam = {
      id: Date.now().toString(),
      name: newTeamName,
      members: [],
      position: selectedPosition,
      shiftPattern: shiftLength,
      offsetPattern: 0,
    };

    const updatedTeams = [...teams, newTeam];
    saveToCompetition(updatedTeams);
    setNewTeamName('');
  };

  const addScoutToTeam = (teamId: string) => {
    if (!newScoutName.trim()) {
      alert('Please enter a scout name');
      return;
    }

    const updatedTeams = teams.map(team =>
      team.id === teamId
        ? { ...team, members: [...team.members, { name: newScoutName }] }
        : team
    );

    saveToCompetition(updatedTeams);
    setNewScoutName('');
  };

  const removeScoutFromTeam = (teamId: string, scoutName: string) => {
    const updatedTeams = teams.map(team =>
      team.id === teamId
        ? { ...team, members: team.members.filter(s => s.name !== scoutName) }
        : team
    );
    saveToCompetition(updatedTeams);
  };

  const deleteTeam = (teamId: string) => {
    const updatedTeams = teams.filter(team => team.id !== teamId);
    saveToCompetition(updatedTeams);
  };

  const updateTeamOffset = (teamId: string, offset: number) => {
    const updatedTeams = teams.map(team =>
      team.id === teamId ? { ...team, offsetPattern: offset } : team
    );
    saveToCompetition(updatedTeams);
  };

  const generateAssignments = () => {
    const newAssignments: GeneratedAssignment[] = [];

    teams.forEach(team => {
      for (let match = 1; match <= totalMatches; match++) {
        const adjustedMatch = match - 1;
        const cycleLength = team.shiftPattern * 2;
        const positionInCycle = (adjustedMatch + team.offsetPattern) % cycleLength;

        if (positionInCycle < team.shiftPattern) {
          newAssignments.push({
            matchNumber: match,
            position: team.position,
            teamId: team.id,
            teamName: team.name,
            scouts: team.members.map(m => m.name),
          });
        }
      }
    });

    saveToCompetition(teams, newAssignments);
  };

  const getPositionColor = (position: ScoutingTeam['position']) => {
    return position.startsWith('red')
      ? 'bg-red-100 text-red-800'
      : 'bg-blue-100 text-blue-800';
  };

  const getPositionLabel = (position: ScoutingTeam['position']) => {
    const color = position.startsWith('red') ? 'Red' : 'Blue';
    const num = position.slice(-1);
    return `${color} ${num}`;
  };

  const getAssignmentsForMatch = (matchNumber: number) => {
    return assignments.filter(a => a.matchNumber === matchNumber);
  };

  if (!selectedCompetition) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <Users size={48} className="mx-auto mb-4 opacity-50" />
        <p>No active competition selected</p>
      </div>
    );
  }

  const positions: ScoutingTeam['position'][] = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <Users size={24} className="text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">Rotating Scouting Teams</h2>
        </div>
        <p className="text-sm text-gray-500">
          Create teams that rotate positions automatically (e.g., 5 matches on, 5 matches off)
        </p>
      </div>

      {/* Configuration and Controls */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shift Length (matches on)</label>
            <input
              type="number"
              min="1"
              max="20"
              value={shiftLength}
              onChange={(e) => setShiftLength(parseInt(e.target.value) || 5)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Matches</label>
            <input
              type="number"
              min="1"
              value={totalMatches}
              onChange={(e) => setTotalMatches(parseInt(e.target.value) || 50)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={generateAssignments}
              disabled={teams.length === 0 || isSaving}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Target size={18} />
              Generate Schedule
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            <input
              type="text"
              placeholder="e.g., Team Alpha"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Position</label>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value as ScoutingTeam['position'])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="red1">Red 1</option>
              <option value="red2">Red 2</option>
              <option value="red3">Red 3</option>
              <option value="blue1">Blue 1</option>
              <option value="blue2">Blue 2</option>
              <option value="blue3">Blue 3</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={createTeam}
              disabled={!newTeamName.trim() || isSaving}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Plus size={18} />
              Create Team
            </button>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Scout Name</label>
          <input
            type="text"
            placeholder="Enter scout name"
            value={newScoutName}
            onChange={(e) => setNewScoutName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Team Details - Grouped by Position */}
      <div className="space-y-6">
        {teams.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Users size={48} className="mx-auto mb-4 opacity-25" />
            <p className="text-gray-500 font-medium">No scouting teams created yet</p>
            <p className="text-sm text-gray-400">Create teams above to get started</p>
          </div>
        ) : (
          positions.map((position) => {
            const positionTeams = teams.filter(t => t.position === position);
            if (positionTeams.length === 0) return null;

            return (
              <div key={position} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <h3
                  className={`text-lg font-bold px-3 py-1.5 rounded-md mb-4 w-fit ${getPositionColor(
                    position
                  )}`}
                >
                  {getPositionLabel(position)}
                </h3>

                <div className="space-y-4">
                  {positionTeams.map((team) => (
                    <div
                      key={team.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="text-base font-bold text-gray-800">{team.name}</h4>
                          <p className="text-xs text-gray-500">
                            {team.shiftPattern} on / {team.shiftPattern} off • {team.members.length} scouts
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Offset
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={team.offsetPattern}
                              onChange={(e) =>
                                updateTeamOffset(team.id, parseInt(e.target.value) || 0)
                              }
                              disabled={isSaving}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            />
                          </div>
                          <button
                            onClick={() => deleteTeam(team.id)}
                            disabled={isSaving}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-all"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Scouts */}
                      <div className="flex flex-wrap gap-2">
                        {team.members.map((scout, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-1 bg-gray-200 text-gray-800 rounded-full text-sm font-medium flex items-center gap-2"
                          >
                            {scout.name}
                            <button
                              onClick={() => removeScoutFromTeam(team.id, scout.name)}
                              disabled={isSaving}
                              className="text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addScoutToTeam(team.id)}
                          disabled={!newScoutName.trim() || isSaving}
                          className="px-3 py-1 border border-gray-300 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-all"
                        >
                          <Plus size={14} />
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Generated Schedule Preview */}
      {assignments.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} className="text-blue-600" />
            <h3 className="text-lg font-bold text-gray-800">Generated Schedule Preview</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">Showing first 10 matches</p>

          <div className="space-y-2">
            {Array.from({ length: Math.min(10, totalMatches) }, (_, i) => i + 1).map((matchNum) => {
              const matchAssignments = getAssignmentsForMatch(matchNum);
              return (
                <div key={matchNum} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="font-bold text-gray-800 w-20">Match {matchNum}</div>
                  <div className="flex flex-wrap gap-2">
                    {positions.map((position) => {
                      const assignment = matchAssignments.find(a => a.position === position);
                      return (
                        <div
                          key={position}
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            assignment
                              ? getPositionColor(position)
                              : 'bg-gray-300 text-gray-600'
                          }`}
                        >
                          {getPositionLabel(position)}: {assignment ? assignment.teamName : 'Off'}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
