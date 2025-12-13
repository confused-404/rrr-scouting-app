
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAppDoc, setAppDoc, subscribeAppDoc } from '@/lib/firebase'
import { Plus, X, Save, RotateCcw, Edit, ArrowUp, ArrowDown } from "lucide-react";
import { useRef } from 'react';

interface ScoutingData {
  id: number;
  teamNumber: string;
  matchNumber: string;
  alliance: string;
  autoGamePieces: number;
  autoMobility: string;
  teleopGamePieces: number;
  climbing: string;
  defense: number;
  reliability: number;
  comments: string;
  timestamp: string;
}

interface AlliancePicklistProps {
  scoutingData: ScoutingData[];
  teamNames?: Map<string, string>;
}

interface PicklistTeam {
  teamNumber: string;
  tier: number;
  notes: string;
  isManual: boolean;
}

import { getTeamNameWithCustom } from "@/lib/teamNames";

const AlliancePicklist = ({ scoutingData, teamNames }: AlliancePicklistProps) => {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [picklists, setPicklists] = useState<Record<string, { id: string; name: string; teams: PicklistTeam[]; createdAt?: string; updatedAt?: string }>>({});
  const [selectedPicklistId, setSelectedPicklistId] = useState<string | null>(null);
  const [newTeam, setNewTeam] = useState("");
  const [newPicklistName, setNewPicklistName] = useState("");


  // Calculate team statistics
  const teamStats = scoutingData.reduce((acc, entry) => {
    const team = entry.teamNumber;
    if (!acc[team]) {
      acc[team] = {
        teamNumber: team,
        matches: 0,
        totalAutoPoints: 0,
        totalTeleopPoints: 0,
        avgDefense: 0,
        avgReliability: 0,
        climbSuccess: 0,
        mobilitySuccess: 0
      };
    }
    
    acc[team].matches++;
    acc[team].totalAutoPoints += entry.autoGamePieces;
    acc[team].totalTeleopPoints += entry.teleopGamePieces;
    acc[team].avgDefense += entry.defense;
    acc[team].avgReliability += entry.reliability;
    
    if (entry.climbing === "success") acc[team].climbSuccess++;
    if (entry.autoMobility === "yes") acc[team].mobilitySuccess++;
    
    return acc;
  }, {} as any);

  const teamStatsArray = Object.values(teamStats).map((team: any) => ({
    ...team,
    avgAutoPoints: (team.totalAutoPoints / team.matches).toFixed(1),
    avgTeleopPoints: (team.totalTeleopPoints / team.matches).toFixed(1),
    avgDefense: (team.avgDefense / team.matches).toFixed(1),
    avgReliability: (team.avgReliability / team.matches).toFixed(1),
    climbRate: ((team.climbSuccess / team.matches) * 100).toFixed(0),
    mobilityRate: ((team.mobilitySuccess / team.matches) * 100).toFixed(0),
    totalScore: team.totalAutoPoints + team.totalTeleopPoints
  })).sort((a, b) => b.totalScore - a.totalScore);

  const savePicklists = () => {
    setAppDoc('customPicklists', picklists).catch(e => console.warn('Failed saving picklists:', e))
    toast({
      title: "Picklist Saved",
      description: "Your custom picklist has been saved.",
    });
  };

  // Autosave when picklists change (debounced)
  const autosaveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    // Clear any pending timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current as any);
      autosaveTimerRef.current = null;
    }

    // Skip saving if no picklists present
    if (!picklists || Object.keys(picklists).length === 0) return;

    // Debounce write
    autosaveTimerRef.current = window.setTimeout(() => {
      setAppDoc('customPicklists', picklists).catch(e => console.warn('Failed autosaving picklists:', e));
      autosaveTimerRef.current = null;
    }, 1000);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current as any);
        autosaveTimerRef.current = null;
      }
    };
  }, [picklists]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current as any);
        autosaveTimerRef.current = null;
      }
      // Save synchronously on unmount
      if (Object.keys(picklists).length) setAppDoc('customPicklists', picklists).catch(() => {});
    };
  }, []);

  const resetToAuto = (picklistId?: string) => {
    const autoPicklist: PicklistTeam[] = teamStatsArray.slice(0, 20).map((team, index) => ({
      teamNumber: team.teamNumber,
      tier: Math.floor(index / 5) + 1,
      notes: `Auto: ${team.avgAutoPoints}, Teleop: ${team.avgTeleopPoints}, Climb: ${team.climbRate}%`,
      isManual: false
    }));
    if (!picklistId) picklistId = selectedPicklistId as string;
    if (!picklistId) return;
    setPicklists(prev => ({ ...prev, [picklistId!]: { ...(prev[picklistId!] || { id: picklistId!, name: prev[picklistId!]?.name || 'Default' }), teams: autoPicklist, updatedAt: new Date().toISOString() } }));
    toast({
      title: "Picklist Reset",
      description: "Picklist has been reset to auto-generated rankings.",
    });
  };

  const addTeam = () => {
    if (!newTeam.trim()) {
      toast({
        title: "Invalid Team",
        description: "Please enter a team number.",
        variant: "destructive"
      });
      return;
    }
    
    // Check if team already exists
    const currentPicklist = selectedPicklistId ? picklists[selectedPicklistId] : null;
    if (!currentPicklist) {
      toast({ title: 'No Picklist Selected', description: 'Please select or create a picklist first.', variant: 'destructive' });
      return;
    }
    if (currentPicklist.teams.some(team => team.teamNumber === newTeam.trim())) {
      toast({
        title: "Team Already Exists",
        description: `Team ${newTeam} is already in the picklist.`,
        variant: "destructive"
      });
      return;
    }
    
    const newPicklistTeam: PicklistTeam = {
      teamNumber: newTeam.trim(),
      tier: 1,
      notes: "Manually added",
      isManual: true
    };
    
    setPicklists(prev => ({
      ...prev,
      [selectedPicklistId!]: { ...(prev[selectedPicklistId!] || { id: selectedPicklistId!, name: prev[selectedPicklistId!]?.name || 'Default' }), teams: [newPicklistTeam, ...(prev[selectedPicklistId!]?.teams || [])], updatedAt: new Date().toISOString() }
    }));
    setNewTeam("");
    
    toast({
      title: "Team Added",
      description: `Team ${newTeam.trim()} has been added to the picklist.`,
    });
  };

  const removeTeam = (teamNumber: string) => {
    if (!selectedPicklistId) return;
    setPicklists(prev => ({
      ...prev,
      [selectedPicklistId]: { ...(prev[selectedPicklistId] || { id: selectedPicklistId, name: prev[selectedPicklistId]?.name || 'Default' }), teams: (prev[selectedPicklistId]?.teams || []).filter(team => team.teamNumber !== teamNumber), updatedAt: new Date().toISOString() }
    }));
    toast({
      title: "Team Removed",
      description: `Team ${teamNumber} has been removed from the picklist.`,
    });
  };

  const moveTeam = (teamNumber: string, direction: 'up' | 'down') => {
    if (!selectedPicklistId) return;
    const cur = picklists[selectedPicklistId]?.teams || [];
    const index = cur.findIndex(team => team.teamNumber === teamNumber);
    if (index === -1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= cur.length) return;
    const newPicklist = [...cur];
    [newPicklist[index], newPicklist[newIndex]] = [newPicklist[newIndex], newPicklist[index]];
    setPicklists(prev => ({ ...prev, [selectedPicklistId]: { ...(prev[selectedPicklistId] || { id: selectedPicklistId, name: prev[selectedPicklistId]?.name || 'Default' }), teams: newPicklist, updatedAt: new Date().toISOString() } }));
  };

  const updateTeamNotes = (teamNumber: string, notes: string) => {
    if (!selectedPicklistId) return;
    setPicklists(prev => ({ ...prev, [selectedPicklistId]: { ...(prev[selectedPicklistId] || { id: selectedPicklistId, name: prev[selectedPicklistId]?.name || 'Default' }), teams: (prev[selectedPicklistId]?.teams || []).map(team => team.teamNumber === teamNumber ? { ...team, notes } : team), updatedAt: new Date().toISOString() } }));
  };

  // Initialize customPicklist with auto-generated data if empty
  useEffect(() => {
    let unsub: any | null = null
    const load = async () => {
      // Try modern storage first
      const saved = await getAppDoc('customPicklists')
      if (saved && Object.keys(saved || {}).length) {
        setPicklists(saved as any)
        const ids = Object.keys(saved);
        setSelectedPicklistId(prev => prev || ids[0] || null);
      } else {
        // Back-compat: try legacy single picklist
        const legacy = await getAppDoc('customPicklist')
        if (legacy && legacy.length) {
          const defaultPicklistId = 'default';
          setPicklists({ [defaultPicklistId]: { id: defaultPicklistId, name: 'Default', teams: legacy, createdAt: new Date().toISOString() } });
          setSelectedPicklistId(defaultPicklistId);
        } else if (teamStatsArray.length > 0) {
          const autoPicklist: PicklistTeam[] = teamStatsArray.slice(0, 15).map((team, index) => ({
            teamNumber: team.teamNumber,
            tier: Math.floor(index / 5) + 1,
            notes: `Auto: ${team.avgAutoPoints}, Teleop: ${team.avgTeleopPoints}, Climb: ${team.climbRate}%`,
            isManual: false
          }));
          const defaultId = 'default';
          setPicklists({ [defaultId]: { id: defaultId, name: 'Default', teams: autoPicklist, createdAt: new Date().toISOString() } });
          setSelectedPicklistId(defaultId);
        }
      }

      unsub = subscribeAppDoc('customPicklists', (val) => {
        if (val) {
          setPicklists(val as any);
          const ids = Object.keys(val);
          setSelectedPicklistId(prev => prev || ids[0] || null);
        }
      })
    }

    load()

    return () => { if (unsub) unsub() }
  }, [scoutingData.length]); // Use scoutingData.length as dependency instead

  const displayPicklist = selectedPicklistId ? (picklists[selectedPicklistId]?.teams || []) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg sm:text-xl">Alliance Selection Picklist</CardTitle>
              <CardDescription className="text-sm">
                {isEditing ? "Edit your custom picklist" : "Recommended teams for alliance selection"}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={selectedPicklistId || ''}
                  onChange={(e) => setSelectedPicklistId(e.target.value || null)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  {Object.values(picklists).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Input placeholder="New picklist name" value={newPicklistName} onChange={(e) => setNewPicklistName(e.target.value)} className="w-40 text-sm" />
                <Button onClick={() => {
                  const name = newPicklistName.trim() || `Picklist ${Object.keys(picklists).length + 1}`;
                  const id = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-') + `-${Date.now()}`;
                  const autoPicklist: PicklistTeam[] = teamStatsArray.slice(0, 15).map((team, index) => ({
                    teamNumber: team.teamNumber,
                    tier: Math.floor(index / 5) + 1,
                    notes: `Auto: ${team.avgAutoPoints}, Teleop: ${team.avgTeleopPoints}, Climb: ${team.climbRate}%`,
                    isManual: false
                  }));
                  setPicklists(prev => ({ ...prev, [id]: { id, name, teams: autoPicklist, createdAt: new Date().toISOString() } }));
                  setSelectedPicklistId(id);
                  setNewPicklistName('');
                }} className="text-sm">Add Picklist</Button>
                <Button variant="outline" onClick={() => setIsEditing(!isEditing)} className="w-full sm:w-auto text-sm">
                  <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  {isEditing ? "View Mode" : "Edit Mode"}
                </Button>
              </div>
              {isEditing && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetToAuto} className="flex-1 sm:flex-none text-sm">
                    <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Reset
                  </Button>
                  <Button onClick={() => {
                    // Save all picklists
                    savePicklists();
                  }} className="flex-1 sm:flex-none text-sm">
                    <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Save
                  </Button>
                  <Button variant="destructive" onClick={() => {
                    if (!selectedPicklistId) return;
                    if (!confirm(`Delete picklist "${picklists[selectedPicklistId].name}"? This action cannot be undone.`)) return;
                    setPicklists(prev => {
                      const copy = { ...prev };
                      delete copy[selectedPicklistId];
                      const remainingIds = Object.keys(copy);
                      // pick first remaining or null
                      setSelectedPicklistId(remainingIds[0] || null);
                      return copy;
                    });
                  }} className="flex-1 sm:flex-none text-sm">
                    Delete
                  </Button>
                  <Button variant="outline" onClick={() => {
                    if (!selectedPicklistId) return;
                    const newName = prompt('Enter new picklist name', picklists[selectedPicklistId].name);
                    if (!newName) return;
                    setPicklists(prev => ({ ...prev, [selectedPicklistId]: { ...(prev[selectedPicklistId] || { id: selectedPicklistId, name: newName }), name: newName, updatedAt: new Date().toISOString() } }));
                  }} className="flex-1 sm:flex-none text-sm">
                    Rename
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isEditing && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Add team number"
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addTeam()}
                  className="flex-1"
                />
                <Button onClick={addTeam} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Team
                </Button>
              </div>
            )}

            <div className="space-y-2">
              {displayPicklist.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No teams in picklist yet.</p>
                  <p className="text-sm">Add teams manually or wait for scouting data to generate auto rankings.</p>
                </div>
              ) : (
                displayPicklist.map((team, index) => {
                const teamData = teamStatsArray.find(t => t.teamNumber === team.teamNumber);
                const tierColor = index < 3 ? "bg-yellow-100 border-yellow-300" : 
                                index < 8 ? "bg-blue-100 border-blue-300" : 
                                "bg-green-100 border-green-300";
                const editModeColor = isEditing ? "ring-2 ring-blue-200" : "";
                
                return (
                  <div key={team.teamNumber} className={`p-3 border rounded-lg ${tierColor} ${editModeColor}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-gray-500">#{index + 1}</span>
                          {isEditing && (
                            <div className="flex flex-col space-y-1 mt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveTeam(team.teamNumber, 'up')}
                                disabled={index === 0}
                                className="h-6 w-6 p-0"
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => moveTeam(team.teamNumber, 'down')}
                                disabled={index === displayPicklist.length - 1}
                                className="h-6 w-6 p-0"
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-lg">Team {team.teamNumber}</span>
                            {team.isManual && <Badge variant="outline">Manual</Badge>}
                            {teamData && (
                              <Badge className={index < 3 ? "bg-yellow-600" : index < 8 ? "bg-blue-600" : "bg-green-600"}>
                                {teamData.totalScore} pts
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm font-medium text-blue-600">
                            {teamNames?.get(team.teamNumber) || getTeamNameWithCustom(team.teamNumber)}
                          </div>
                          {isEditing ? (
                            <Input
                              className="mt-1 text-sm"
                              value={team.notes}
                              onChange={(e) => updateTeamNotes(team.teamNumber, e.target.value)}
                              placeholder="Add notes..."
                            />
                          ) : (
                            <p className="text-sm text-gray-600">{team.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {teamData && (
                          <div className="text-right text-sm">
                            <div>Auto: {teamData.avgAutoPoints}</div>
                            <div>Teleop: {teamData.avgTeleopPoints}</div>
                            <div>Climb: {teamData.climbRate}%</div>
                          </div>
                        )}
                        {isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTeam(team.teamNumber)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
                })
              )}
            </div>
          </div>


        </CardContent>
      </Card>

      {/* Specialist Teams - Only show in view mode */}
      {!isEditing && (
        <Card>
          <CardHeader>
            <CardTitle>Specialist Teams</CardTitle>
            <CardDescription>Teams with unique strengths for specific alliance needs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-purple-700">Best Climbers</h4>
                {teamStatsArray
                  .filter(team => parseInt(team.climbRate) > 75)
                  .slice(0, 3)
                  .map(team => (
                    <div key={team.teamNumber} className="flex justify-between text-sm">
                      <div>
                        <div>Team {team.teamNumber}</div>
                        <div className="text-xs text-gray-600">
                          {teamNames?.get(team.teamNumber) || getTeamNameWithCustom(team.teamNumber)}
                        </div>
                      </div>
                      <span>{team.climbRate}% climb rate</span>
                    </div>
                  ))}
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-blue-700">Auto Specialists</h4>
                {teamStatsArray
                  .sort((a, b) => parseFloat(b.avgAutoPoints) - parseFloat(a.avgAutoPoints))
                  .slice(0, 3)
                  .map(team => (
                    <div key={team.teamNumber} className="flex justify-between text-sm">
                      <div>
                        <div>Team {team.teamNumber}</div>
                        <div className="text-xs text-gray-600">
                          {teamNames?.get(team.teamNumber) || getTeamNameWithCustom(team.teamNumber)}
                        </div>
                      </div>
                      <span>{team.avgAutoPoints} avg auto</span>
                    </div>
                  ))}
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-red-700">Defense Bots</h4>
                {teamStatsArray
                  .sort((a, b) => parseFloat(b.avgDefense) - parseFloat(a.avgDefense))
                  .slice(0, 3)
                  .map(team => (
                    <div key={team.teamNumber} className="flex justify-between text-sm">
                      <div>
                        <div>Team {team.teamNumber}</div>
                        <div className="text-xs text-gray-600">
                          {teamNames?.get(team.teamNumber) || getTeamNameWithCustom(team.teamNumber)}
                        </div>
                      </div>
                      <span>{team.avgDefense}/10 defense</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AlliancePicklist;
