
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAppDoc, setAppDoc, subscribeAppDoc } from '@/lib/firebase'
import { Plus, X, Save, RotateCcw, Edit, ArrowUp, ArrowDown } from "lucide-react";

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
  const [customPicklist, setCustomPicklist] = useState<PicklistTeam[]>([]);
  const [newTeam, setNewTeam] = useState("");


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

  const savePicklist = () => {
    setAppDoc('customPicklist', customPicklist).catch(e => console.warn('Failed saving picklist:', e))
    toast({
      title: "Picklist Saved",
      description: "Your custom picklist has been saved.",
    });
  };

  const resetToAuto = () => {
    const autoPicklist: PicklistTeam[] = teamStatsArray.slice(0, 20).map((team, index) => ({
      teamNumber: team.teamNumber,
      tier: Math.floor(index / 5) + 1,
      notes: `Auto: ${team.avgAutoPoints}, Teleop: ${team.avgTeleopPoints}, Climb: ${team.climbRate}%`,
      isManual: false
    }));
    setCustomPicklist(autoPicklist);
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
    if (customPicklist.some(team => team.teamNumber === newTeam.trim())) {
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
    
    setCustomPicklist([newPicklistTeam, ...customPicklist]);
    setNewTeam("");
    
    toast({
      title: "Team Added",
      description: `Team ${newTeam.trim()} has been added to the picklist.`,
    });
  };

  const removeTeam = (teamNumber: string) => {
    setCustomPicklist(customPicklist.filter(team => team.teamNumber !== teamNumber));
    toast({
      title: "Team Removed",
      description: `Team ${teamNumber} has been removed from the picklist.`,
    });
  };

  const moveTeam = (teamNumber: string, direction: 'up' | 'down') => {
    const index = customPicklist.findIndex(team => team.teamNumber === teamNumber);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= customPicklist.length) return;
    
    const newPicklist = [...customPicklist];
    [newPicklist[index], newPicklist[newIndex]] = [newPicklist[newIndex], newPicklist[index]];
    setCustomPicklist(newPicklist);
  };

  const updateTeamNotes = (teamNumber: string, notes: string) => {
    setCustomPicklist(customPicklist.map(team => 
      team.teamNumber === teamNumber ? { ...team, notes } : team
    ));
  };

  // Initialize customPicklist with auto-generated data if empty
  useEffect(() => {
    let unsub: any | null = null
    const load = async () => {
      const saved = await getAppDoc('customPicklist')
      if (saved) {
        setCustomPicklist(saved)
      } else if (teamStatsArray.length > 0) {
      const autoPicklist: PicklistTeam[] = teamStatsArray.slice(0, 15).map((team, index) => ({
        teamNumber: team.teamNumber,
        tier: Math.floor(index / 5) + 1,
        notes: `Auto: ${team.avgAutoPoints}, Teleop: ${team.avgTeleopPoints}, Climb: ${team.climbRate}%`,
        isManual: false
      }));
      setCustomPicklist(autoPicklist);
    }
      unsub = subscribeAppDoc('customPicklist', (val) => {
        if (val) setCustomPicklist(val)
      })
    }

    load()

    return () => { if (unsub) unsub() }
  }, [scoutingData.length]); // Use scoutingData.length as dependency instead

  const displayPicklist = customPicklist;

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
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                className="w-full sm:w-auto text-sm"
              >
                <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                {isEditing ? "View Mode" : "Edit Mode"}
              </Button>
              {isEditing && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetToAuto} className="flex-1 sm:flex-none text-sm">
                    <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Reset
                  </Button>
                  <Button onClick={savePicklist} className="flex-1 sm:flex-none text-sm">
                    <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Save
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
                                disabled={index === customPicklist.length - 1}
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
