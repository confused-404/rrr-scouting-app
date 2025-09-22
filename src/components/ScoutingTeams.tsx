import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, X, Clock, Target } from "lucide-react";

interface Scout {
  name: string;
}

interface ScoutingTeam {
  id: string;
  name: string;
  members: Scout[];
  position: 'red1' | 'red2' | 'red3' | 'blue1' | 'blue2' | 'blue3';
  shiftPattern: number; // matches on
  offsetPattern: number; // matches off before starting
}

interface GeneratedAssignment {
  matchNumber: number;
  position: 'red1' | 'red2' | 'red3' | 'blue1' | 'blue2' | 'blue3';
  teamId: string;
  teamName: string;
  scouts: string[];
}

const ScoutingTeams = () => {
  const { toast } = useToast();
  const [teams, setTeams] = useState<ScoutingTeam[]>([]);
  const [assignments, setAssignments] = useState<GeneratedAssignment[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newScoutName, setNewScoutName] = useState("");
  const [shiftLength, setShiftLength] = useState(5);
  const [totalMatches, setTotalMatches] = useState(50);

  useEffect(() => {
    const savedTeams = localStorage.getItem("scoutingTeams");
    const savedAssignments = localStorage.getItem("scoutingAssignments");
    if (savedTeams) {
      setTeams(JSON.parse(savedTeams));
    }
    if (savedAssignments) {
      setAssignments(JSON.parse(savedAssignments));
    }
  }, []);

  const saveTeams = (updatedTeams: ScoutingTeam[]) => {
    localStorage.setItem("scoutingTeams", JSON.stringify(updatedTeams));
    setTeams(updatedTeams);
  };

  const saveAssignments = (updatedAssignments: GeneratedAssignment[]) => {
    localStorage.setItem("scoutingAssignments", JSON.stringify(updatedAssignments));
    setAssignments(updatedAssignments);
  };

  const createTeam = (position: ScoutingTeam['position']) => {
    if (!newTeamName.trim()) {
      toast({
        title: "Enter Team Name",
        description: "Please enter a team name.",
        variant: "destructive"
      });
      return;
    }

    const existingTeam = teams.find(t => t.position === position);
    if (existingTeam) {
      toast({
        title: "Position Taken",
        description: `${getPositionLabel(position)} already has a team assigned.`,
        variant: "destructive"
      });
      return;
    }

    const newTeam: ScoutingTeam = {
      id: Date.now().toString(),
      name: newTeamName,
      members: [],
      position,
      shiftPattern: shiftLength,
      offsetPattern: 0
    };

    const updatedTeams = [...teams, newTeam];
    saveTeams(updatedTeams);
    setNewTeamName("");

    toast({
      title: "Team Created",
      description: `Created team "${newTeam.name}" for ${getPositionLabel(position)}`,
    });
  };

  const addScoutToTeam = (teamId: string) => {
    if (!newScoutName.trim()) {
      toast({
        title: "Enter Scout Name",
        description: "Please enter a scout name.",
        variant: "destructive"
      });
      return;
    }

    const updatedTeams = teams.map(team => {
      if (team.id === teamId) {
        return {
          ...team,
          members: [...team.members, { name: newScoutName }]
        };
      }
      return team;
    });

    saveTeams(updatedTeams);
    setNewScoutName("");
  };

  const removeScoutFromTeam = (teamId: string, scoutName: string) => {
    const updatedTeams = teams.map(team => {
      if (team.id === teamId) {
        return {
          ...team,
          members: team.members.filter(s => s.name !== scoutName)
        };
      }
      return team;
    });

    saveTeams(updatedTeams);
  };

  const deleteTeam = (teamId: string) => {
    const updatedTeams = teams.filter(team => team.id !== teamId);
    saveTeams(updatedTeams);
    
    toast({
      title: "Team Deleted",
      description: "Scouting team has been removed.",
    });
  };

  const updateTeamOffset = (teamId: string, offset: number) => {
    const updatedTeams = teams.map(team => {
      if (team.id === teamId) {
        return { ...team, offsetPattern: offset };
      }
      return team;
    });
    saveTeams(updatedTeams);
  };

  const generateAssignments = () => {
    const newAssignments: GeneratedAssignment[] = [];
    
    teams.forEach(team => {
      for (let match = 1; match <= totalMatches; match++) {
        const adjustedMatch = match - 1; // 0-based for calculations
        const cycleLength = team.shiftPattern * 2; // on + off period
        const positionInCycle = (adjustedMatch + team.offsetPattern) % cycleLength;
        
        // Team is "on" if position in cycle is less than shift pattern
        if (positionInCycle < team.shiftPattern) {
          newAssignments.push({
            matchNumber: match,
            position: team.position,
            teamId: team.id,
            teamName: team.name,
            scouts: team.members.map(m => m.name)
          });
        }
      }
    });

    saveAssignments(newAssignments);
    
    toast({
      title: "Assignments Generated",
      description: `Generated assignments for ${totalMatches} matches across ${teams.length} teams.`,
    });
  };

  const positions: ScoutingTeam['position'][] = ['red1', 'red2', 'red3', 'blue1', 'blue2', 'blue3'];

  const getPositionColor = (position: ScoutingTeam['position']) => {
    return position.startsWith('red') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800';
  };

  const getPositionLabel = (position: ScoutingTeam['position']) => {
    const color = position.startsWith('red') ? 'Red' : 'Blue';
    const num = position.slice(-1);
    return `${color} ${num}`;
  };

  const getAssignmentsForMatch = (matchNumber: number) => {
    return assignments.filter(a => a.matchNumber === matchNumber);
  };

  return (
    <div className="space-y-6 px-4 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-6 w-6 text-blue-600" />
            <span>Rotating Scouting Teams</span>
          </CardTitle>
          <CardDescription>
            Create teams that rotate positions automatically (e.g., 5 matches on, 5 matches off)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <Label htmlFor="shiftLength">Shift Length (matches on)</Label>
              <Input
                id="shiftLength"
                type="number"
                min="1"
                max="20"
                value={shiftLength}
                onChange={(e) => setShiftLength(parseInt(e.target.value) || 5)}
              />
            </div>
            <div>
              <Label htmlFor="totalMatches">Total Matches</Label>
              <Input
                id="totalMatches"
                type="number"
                min="1"
                value={totalMatches}
                onChange={(e) => setTotalMatches(parseInt(e.target.value) || 50)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={generateAssignments} className="w-full" disabled={teams.length === 0}>
                <Target className="h-4 w-4 mr-2" />
                Generate Schedule
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <Label htmlFor="newTeamName">Team Name</Label>
              <Input
                id="newTeamName"
                placeholder="Enter team name (e.g., Team Alpha)"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="newScoutName">Scout Name</Label>
              <Input
                id="newScoutName"
                placeholder="Enter scout name"
                value={newScoutName}
                onChange={(e) => setNewScoutName(e.target.value)}
              />
            </div>
          </div>

          {/* Position Assignment Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {positions.map((position) => {
              const existingTeam = teams.find(t => t.position === position);
              return (
                <Card key={position} className="border-2">
                  <CardHeader className="pb-3">
                    <CardTitle className={`text-sm px-2 py-1 rounded text-center ${getPositionColor(position)}`}>
                      {getPositionLabel(position)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {existingTeam ? (
                      <div className="text-center">
                        <p className="font-medium text-sm">{existingTeam.name}</p>
                        <p className="text-xs text-gray-500">{existingTeam.members.length} scouts</p>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => createTeam(position)}
                        className="w-full text-xs"
                        disabled={!newTeamName.trim()}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Assign Team
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Team Details */}
      <div className="space-y-4">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <div className={`w-4 h-4 rounded ${getPositionColor(team.position).replace('text-', 'bg-').replace('-800', '-600')}`}></div>
                    <span>{team.name}</span>
                    <Badge className={getPositionColor(team.position)}>{getPositionLabel(team.position)}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {team.shiftPattern} matches on, {team.shiftPattern} matches off • {team.members.length} scouts
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <Label className="text-xs">Offset</Label>
                    <Input
                      type="number"
                      min="0"
                      max="20"
                      value={team.offsetPattern}
                      onChange={(e) => updateTeamOffset(team.id, parseInt(e.target.value) || 0)}
                      className="w-16 h-8 text-xs"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteTeam(team.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {team.members.map((scout, index) => (
                    <Badge key={index} variant="outline" className="flex items-center space-x-1">
                      <span>{scout.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeScoutFromTeam(team.id, scout.name)}
                        className="h-4 w-4 p-0 ml-1 text-red-600 hover:text-red-700"
                      >
                        <X className="h-2 w-2" />
                      </Button>
                    </Badge>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addScoutToTeam(team.id)}
                    className="text-xs"
                    disabled={!newScoutName.trim()}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Scout
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {teams.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">No scouting teams created yet.</p>
              <p className="text-sm text-gray-400">Create teams for each position above to get started.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Generated Schedule Preview */}
      {assignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Generated Schedule Preview</span>
            </CardTitle>
            <CardDescription>
              First 10 matches showing team rotations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.from({ length: Math.min(10, totalMatches) }, (_, i) => i + 1).map(matchNum => {
                const matchAssignments = getAssignmentsForMatch(matchNum);
                return (
                  <div key={matchNum} className="flex items-center space-x-4 p-2 bg-gray-50 rounded">
                    <div className="font-medium w-16">Match {matchNum}</div>
                    <div className="flex flex-wrap gap-2">
                      {positions.map(position => {
                        const assignment = matchAssignments.find(a => a.position === position);
                        return (
                          <Badge 
                            key={position} 
                            className={assignment ? getPositionColor(position) : 'bg-gray-200 text-gray-500'}
                          >
                            {getPositionLabel(position)}: {assignment ? assignment.teamName : 'Off'}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ScoutingTeams;