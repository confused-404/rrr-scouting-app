import React, { useState, useEffect } from 'react';
import { Users, Plus, X, Clock } from 'lucide-react';
import type { Competition, ScoutingTeam, GeneratedAssignment } from '../types/competition.types';
import { competitionApi, tbaApi, statboticsApi } from '../services/api';

export const ScoutingTeams: React.FC<{ selectedCompetition?: Competition | null }> = ({ selectedCompetition }) => {
  const [teams, setTeams] = useState<ScoutingTeam[]>([]);
  const [assignments, setAssignments] = useState<GeneratedAssignment[]>([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newScoutName, setNewScoutName] = useState('');
  const [matchesPerShift, setMatchesPerShift] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
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

  const generateSchedule = async () => {
    if (!selectedCompetition?.eventKey) {
      alert('Please set an event key for this competition first');
      return;
    }

    if (teams.length === 0 || teams.length % 6 !== 0) {
      alert('Please create scouting teams (must be a multiple of 6)');
      return;
    }

    setIsGenerating(true);
    try {
      // Get match schedule from TBA, fallback to Statbotics when needed
      let matchSchedule: unknown[] = [];
      try {
        matchSchedule = await tbaApi.getEventMatches(selectedCompetition.eventKey);
      } catch (tbaError) {
        console.warn('TBA match load failed during schedule generation, falling back to Statbotics', tbaError);
        matchSchedule = await statboticsApi.getEventMatches(selectedCompetition.eventKey);
      }

      const totalMatches = Array.isArray(matchSchedule) ? matchSchedule.length : 0;
      if (totalMatches === 0) {
        alert('No matches found for this event');
        return;
      }

      // Create a map of match numbers to times
      const matchTimes = new Map<number, number>();
      matchSchedule.forEach((rawMatch) => {
        if (!rawMatch || typeof rawMatch !== 'object') return;

        const match = rawMatch as { match_number?: unknown; key?: unknown; time?: unknown };
        const matchKey = typeof match.key === 'string' ? match.key : '';
        const derivedMatchNumber = matchKey.includes('m') ? Number.parseInt(matchKey.split('m')[1] || '0', 10) : 0;
        const matchNum = Number(match.match_number ?? derivedMatchNumber);
        const matchTime = Number(match.time);

        if (Number.isFinite(matchNum) && matchNum > 0 && Number.isFinite(matchTime)) {
          matchTimes.set(matchNum, matchTime);
        }
      });

      // Calculate groups of 6 teams
      const teamsPerGroup = 6;
      const numGroups = Math.floor(teams.length / teamsPerGroup);

      // Ensure we have valid parameters
      if (numGroups === 0 || matchesPerShift <= 0) {
        alert('Invalid team configuration or shift length');
        return;
      }

      const newAssignments: GeneratedAssignment[] = [];
      const positions: GeneratedAssignment['position'][] = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'];

      for (let matchNum = 1; matchNum <= totalMatches; matchNum++) {
        // Determine which group is active for this match
        // Use integer division to ensure we get whole numbers
        const groupIndex = Math.floor((matchNum - 1) / matchesPerShift) % numGroups;
        const activeTeams = teams.slice(groupIndex * teamsPerGroup, (groupIndex + 1) * teamsPerGroup);

        // Ensure we have exactly 6 teams for this match
        if (activeTeams.length === teamsPerGroup) {
          // Assign teams to positions, rotating through the match
          activeTeams.forEach((team, teamIndex) => {
            newAssignments.push({
              matchNumber: matchNum,
              position: positions[teamIndex],
              teamId: team.id,
              teamName: team.name,
              scouts: team.members.map(m => m.name),
              matchTime: matchTimes.get(matchNum),
            });
          });
        }
      }

      await saveToCompetition(teams, newAssignments);
    } catch (error) {
      console.error('Error generating schedule:', error);
      alert('Failed to generate schedule');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!selectedCompetition) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
        <Users size={48} className="mx-auto mb-4 opacity-50" />
        <p>No active competition selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-2">
          <Users size={24} className="text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">Scouting Teams</h2>
        </div>
        <p className="text-sm text-gray-500">
          Create scouting teams that will automatically rotate through all positions
        </p>
      </div>

      {/* Create Team */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Create New Team</h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Team name (e.g., Team Alpha)"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={createTeam}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus size={18} />
            {isSaving ? 'Creating...' : 'Create Team'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)] gap-6 items-start">
        {/* Teams List */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Teams ({teams.length})</h3>
          {teams.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No teams created yet</p>
          ) : (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {teams.map(team => (
                <div key={team.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-lg">{team.name}</h4>
                    <button
                      onClick={() => deleteTeam(team.id)}
                      disabled={isSaving}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Add Scout */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      placeholder="Scout name"
                      value={newScoutName}
                      onChange={(e) => setNewScoutName(e.target.value)}
                      className="flex-1 px-3 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => addScoutToTeam(team.id)}
                      disabled={isSaving}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Add
                    </button>
                  </div>

                  {/* Scouts List */}
                  <div className="flex flex-wrap gap-2">
                    {team.members.map((scout, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {scout.name}
                        <button
                          onClick={() => removeScoutFromTeam(team.id, scout.name)}
                          disabled={isSaving}
                          className="ml-1 text-blue-600 hover:text-blue-800"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schedule Generation */}
        <div className="bg-white rounded-xl shadow-sm p-6 xl:sticky xl:top-6">
          <h3 className="text-lg font-semibold mb-4">Generate Schedule</h3>
          <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Matches per Shift</label>
              <input
                type="number"
                min="1"
                max="20"
                value={matchesPerShift}
                onChange={(e) => setMatchesPerShift(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">How many matches each group scouts before rotating</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
              <div className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm">
                {selectedCompetition.eventKey || 'No event selected'}
              </div>
              <p className="text-xs text-gray-500 mt-1">Set event key in competition settings</p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Schedule Summary</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Teams: {teams.length} (must be multiple of 6)</p>
              <p>• Groups: {teams.length > 0 ? Math.floor(teams.length / 6) : 0}</p>
              <p>• Shift length: {matchesPerShift} matches</p>
              <p>• Teams rotate through all 6 positions automatically</p>
            </div>
          </div>

            <button
              onClick={generateSchedule}
              disabled={isGenerating || teams.length === 0 || teams.length % 6 !== 0 || !selectedCompetition.eventKey}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Clock size={18} />
              {isGenerating ? 'Generating...' : 'Generate Scouting Schedule'}
            </button>
          </div>
        </div>
      </div>

      {/* Current Assignments Preview */}
      {assignments.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Schedule Preview</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {Array.from(new Set(assignments.map(a => a.matchNumber))).slice(0, 10).map(matchNum => {
              const matchAssignments = assignments.filter(a => a.matchNumber === matchNum);
              return (
                <div key={matchNum} className="flex items-center gap-4 p-2 bg-gray-50 rounded">
                  <span className="font-medium w-16">Match {matchNum}</span>
                  <div className="flex flex-wrap gap-1">
                    {matchAssignments.map(assignment => (
                      <span key={assignment.teamId} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                        {assignment.teamName} ({assignment.position})
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {assignments.length > 60 && (
            <p className="text-sm text-gray-500 mt-2">... and {assignments.length - 60} more assignments</p>
          )}
        </div>
      )}
    </div>
  );
};
