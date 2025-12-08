
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Clock, Users, Target } from "lucide-react";
import { getTeamNameWithCustom } from "@/lib/teamNames";
import { ProcessedMatch } from "@/lib/tbaApi";
import { useTeamNames } from "@/hooks/useTeamNames";
import EventImport from "./EventImport";
import { getAppDoc, setAppDoc, getAllScoutingEntries, subscribeScoutingEntries, subscribeAppDoc } from '@/lib/firebase'

interface MatchData {
  id: string;
  matchNumber: string;
  teamNumber: string;
  alliance: 'red' | 'blue';
  alliancePosition: 1 | 2 | 3;
  timestamp: string;
}

interface ScheduledMatch {
  id: string;
  matchNumber: string;
  time: string;
  redAlliance: [string, string, string];
  blueAlliance: [string, string, string];
}

interface MatchScheduleProps {
  userRole?: 'admin' | 'scouter';
  username?: string;
}

const MatchSchedule = ({ userRole = 'scouter', username = '' }: MatchScheduleProps) => {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([]);
  const [newMatch, setNewMatch] = useState({
    matchNumber: '',
    time: '',
    red1: '', red2: '', red3: '',
    blue1: '', blue2: '', blue3: ''
  });
  const [scoutingData, setScoutingData] = useState<MatchData[]>([]);
  const [importData, setImportData] = useState('');
  const [scoutingAssignments, setScoutingAssignments] = useState<any[]>([]);
  const [showMyAssignments, setShowMyAssignments] = useState(false);

  // Get all unique team numbers from the schedule for team name fetching
  const allTeamNumbers = Array.from(new Set(
    schedule.flatMap(match => [...match.redAlliance, ...match.blueAlliance])
  )).filter(Boolean);
  
  const { teamNames } = useTeamNames(allTeamNumbers);

  useEffect(() => {
    let unsubScouting: any | null = null
    let unsubAssignments: any | null = null

    const load = async () => {
      const savedSchedule = (await getAppDoc('matchSchedule')) || []
      const savedScoutingData = await getAllScoutingEntries() || []
      const savedAssignments = (await getAppDoc('scoutingAssignments')) || []
      setSchedule(savedSchedule)
      setScoutingData(savedScoutingData)
      setScoutingAssignments(savedAssignments)

      unsubScouting = subscribeScoutingEntries(rows => setScoutingData(rows || []))
      unsubAssignments = subscribeAppDoc('scoutingAssignments', val => setScoutingAssignments(val || []))
    }

    load()

    return () => { if (unsubScouting) unsubScouting(); if (unsubAssignments) unsubAssignments(); }
  }, []);

  const saveSchedule = (updatedSchedule: ScheduledMatch[]) => {
    setAppDoc('matchSchedule', updatedSchedule).catch(e => console.warn('Failed to save match schedule:', e))
    setSchedule(updatedSchedule);
  };

  const getLastMatch = (teamNumber: string): MatchData | null => {
    const teamMatches = scoutingData
      .filter(match => match.teamNumber === teamNumber)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return teamMatches.length > 0 ? teamMatches[0] : null;
  };

  const getTeamBadge = (teamNumber: string) => {
    const lastMatch = getLastMatch(teamNumber);
    if (!lastMatch) {
      return <Badge variant="outline">No Data</Badge>;
    }

    const matchesAgo = scoutingData
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .findIndex(match => match.teamNumber === teamNumber) + 1;

    return (
      <div className="flex items-center space-x-2">
        <Badge className={lastMatch.alliance === 'red' ? 'bg-red-600' : 'bg-blue-600'}>
          Match {lastMatch.matchNumber}
        </Badge>
        <span className="text-xs text-muted-foreground">
          ({matchesAgo} match{matchesAgo !== 1 ? 'es' : ''} ago)
        </span>
      </div>
    );
  };

  const getScoutingAssignments = (matchNumber: string) => {
    return scoutingAssignments.filter(a => a.matchNumber === parseInt(matchNumber));
  };

  const getPositionLabel = (position: string) => {
    const color = position.startsWith('red') ? 'Red' : 'Blue';
    const num = position.slice(-1);
    return `${color} ${num}`;
  };

  const isUserAssignedToMatch = (matchNumber: string) => {
    const assignments = getScoutingAssignments(matchNumber);
    return assignments.some(assignment => 
      assignment.scouts.includes(username)
    );
  };

  const getFilteredSchedule = () => {
    if (!showMyAssignments || userRole !== 'scouter') {
      return schedule;
    }
    return schedule.filter(match => isUserAssignedToMatch(match.matchNumber));
  };

  const addMatch = () => {
    if (!newMatch.matchNumber || !newMatch.time || 
        !newMatch.red1 || !newMatch.red2 || !newMatch.red3 ||
        !newMatch.blue1 || !newMatch.blue2 || !newMatch.blue3) {
      toast({
        title: "Missing Information",
        description: "Please fill in all match details.",
        variant: "destructive"
      });
      return;
    }

    const match: ScheduledMatch = {
      id: Date.now().toString(),
      matchNumber: newMatch.matchNumber,
      time: newMatch.time,
      redAlliance: [newMatch.red1, newMatch.red2, newMatch.red3],
      blueAlliance: [newMatch.blue1, newMatch.blue2, newMatch.blue3]
    };

    const updatedSchedule = [...schedule, match].sort((a, b) => 
      parseInt(a.matchNumber) - parseInt(b.matchNumber)
    );
    
    saveSchedule(updatedSchedule);
    setNewMatch({
      matchNumber: '',
      time: '',
      red1: '', red2: '', red3: '',
      blue1: '', blue2: '', blue3: ''
    });

    toast({
      title: "Match Added",
      description: `Match ${match.matchNumber} has been added to the schedule.`,
    });
  };

  const deleteMatch = (matchId: string) => {
    const updatedSchedule = schedule.filter(match => match.id !== matchId);
    saveSchedule(updatedSchedule);
    
    toast({
      title: "Match Deleted",
      description: "Match has been removed from the schedule.",
    });
  };

  const importSchedule = () => {
    if (!importData.trim()) {
      toast({
        title: "No Data",
        description: "Please paste CSV data to import.",
        variant: "destructive"
      });
      return;
    }

    try {
      const lines = importData.trim().split('\n');
      const newMatches: ScheduledMatch[] = [];

      lines.forEach((line, index) => {
        const parts = line.split(',').map(part => part.trim());
        if (parts.length !== 8) {
          throw new Error(`Line ${index + 1}: Expected 8 columns, got ${parts.length}`);
        }

        const [matchNum, time, red1, red2, red3, blue1, blue2, blue3] = parts;
        
        newMatches.push({
          id: `import-${Date.now()}-${index}`,
          matchNumber: matchNum,
          time: time,
          redAlliance: [red1, red2, red3],
          blueAlliance: [blue1, blue2, blue3]
        });
      });

      const updatedSchedule = [...schedule, ...newMatches].sort((a, b) => 
        parseInt(a.matchNumber) - parseInt(b.matchNumber)
      );
      
      saveSchedule(updatedSchedule);
      setImportData('');

      toast({
        title: "Schedule Imported",
        description: `Successfully imported ${newMatches.length} matches.`,
      });
    } catch (error) {
      toast({
        title: "Import Error",
        description: error instanceof Error ? error.message : "Invalid CSV format",
        variant: "destructive"
      });
    }
  };

  const handleEventImport = (matches: ProcessedMatch[], clearExisting = false) => {
    const newMatches: ScheduledMatch[] = matches.map((match, index) => ({
      id: `tba-import-${Date.now()}-${index}`,
      matchNumber: match.matchNumber,
      time: match.time,
      redAlliance: match.redAlliance,
      blueAlliance: match.blueAlliance
    }));

    // If clearExisting is true, replace the entire schedule, otherwise append
    const updatedSchedule = clearExisting 
      ? newMatches.sort((a, b) => parseInt(a.matchNumber) - parseInt(b.matchNumber))
      : [...schedule, ...newMatches].sort((a, b) => parseInt(a.matchNumber) - parseInt(b.matchNumber));
    
    saveSchedule(updatedSchedule);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Calendar className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle>Match Schedule</CardTitle>
                <CardDescription>View upcoming matches with team last match data and scout assignments</CardDescription>
              </div>
            </div>
            {userRole === 'scouter' && (
              <Button
                variant={showMyAssignments ? "default" : "outline"}
                size="sm"
                onClick={() => setShowMyAssignments(!showMyAssignments)}
              >
                <Users className="h-4 w-4 mr-2" />
                {showMyAssignments 
                  ? `Show All (${getFilteredSchedule().length} assigned)` 
                  : "My Assignments"
                }
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Add Match Form - Admin Only */}
            {userRole === 'admin' && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <Plus className="h-5 w-5" />
                    <span>Add New Match</span>
                  </CardTitle>
                </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="matchNumber">Match Number</Label>
                    <Input
                      id="matchNumber"
                      value={newMatch.matchNumber}
                      onChange={(e) => setNewMatch(prev => ({ ...prev, matchNumber: e.target.value }))}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={newMatch.time}
                      onChange={(e) => setNewMatch(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                  <div className="space-y-3">
                    <Label className="flex items-center space-x-2 text-red-600">
                      <div className="w-3 h-3 bg-red-600 rounded"></div>
                      <span>Red Alliance</span>
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="Team 1"
                        value={newMatch.red1}
                        onChange={(e) => setNewMatch(prev => ({ ...prev, red1: e.target.value }))}
                      />
                      <Input
                        placeholder="Team 2"
                        value={newMatch.red2}
                        onChange={(e) => setNewMatch(prev => ({ ...prev, red2: e.target.value }))}
                      />
                      <Input
                        placeholder="Team 3"
                        value={newMatch.red3}
                        onChange={(e) => setNewMatch(prev => ({ ...prev, red3: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center space-x-2 text-blue-600">
                      <div className="w-3 h-3 bg-blue-600 rounded"></div>
                      <span>Blue Alliance</span>
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        placeholder="Team 1"
                        value={newMatch.blue1}
                        onChange={(e) => setNewMatch(prev => ({ ...prev, blue1: e.target.value }))}
                      />
                      <Input
                        placeholder="Team 2"
                        value={newMatch.blue2}
                        onChange={(e) => setNewMatch(prev => ({ ...prev, blue2: e.target.value }))}
                      />
                      <Input
                        placeholder="Team 3"
                        value={newMatch.blue3}
                        onChange={(e) => setNewMatch(prev => ({ ...prev, blue3: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={addMatch} className="w-full mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Match to Schedule
                </Button>
              </CardContent>
            </Card>
            )}

            {/* Import from TBA - Admin Only */}
            {userRole === 'admin' && (
              <EventImport onImportMatches={handleEventImport} />
            )}

            {/* Manual CSV Import - Admin Only */}
            {userRole === 'admin' && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg">Manual CSV Import</CardTitle>
                  <CardDescription>
                    Paste CSV data with format: Match,Time,Red1,Red2,Red3,Blue1,Blue2,Blue3
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <textarea
                      className="w-full h-32 p-3 border rounded-md resize-none"
                      placeholder="1,10:00,1114,254,118,148,1678,2056&#10;2,10:15,973,1323,5940,6328,7492,8033"
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                    />
                    <Button onClick={importSchedule} className="w-full">
                      Import CSV Schedule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Mobile-First Schedule Cards */}
            <div className="space-y-4">
              {getFilteredSchedule().map((match) => {
                const isMyMatch = isUserAssignedToMatch(match.matchNumber);
                return (
                  <Card 
                    key={match.id}
                    className={`${isMyMatch && userRole === 'scouter' ? 'border-l-4 border-l-blue-500 bg-blue-50' : ''}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-lg font-bold">Match #{match.matchNumber}</div>
                          <div className="flex items-center space-x-1 text-sm text-gray-600">
                            <Clock className="h-4 w-4" />
                            <span>{match.time}</span>
                          </div>
                          {isMyMatch && userRole === 'scouter' && (
                            <Badge className="bg-blue-600 text-white">Your Match</Badge>
                          )}
                        </div>
                        {userRole === 'admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMatch(match.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Teams Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Red Alliance */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-4 h-4 bg-red-600 rounded"></div>
                              <span className="font-semibold text-red-700">Red Alliance</span>
                            </div>
                            {match.redAlliance.map((team, index) => (
                              <div key={index} className="bg-red-50 p-2 rounded border border-red-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">Team {team}</span>
                                  <Badge className="bg-red-100 text-red-800 text-xs">Red {index + 1}</Badge>
                                </div>
                                <div className="text-xs text-gray-600 mb-2">{teamNames.get(team) || getTeamNameWithCustom(team)}</div>
                                {getTeamBadge(team)}
                              </div>
                            ))}
                          </div>

                          {/* Blue Alliance */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-4 h-4 bg-blue-600 rounded"></div>
                              <span className="font-semibold text-blue-700">Blue Alliance</span>
                            </div>
                            {match.blueAlliance.map((team, index) => (
                              <div key={index} className="bg-blue-50 p-2 rounded border border-blue-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium">Team {team}</span>
                                  <Badge className="bg-blue-100 text-blue-800 text-xs">Blue {index + 1}</Badge>
                                </div>
                                <div className="text-xs text-gray-600 mb-2">{teamNames.get(team) || getTeamNameWithCustom(team)}</div>
                                {getTeamBadge(team)}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Scout Assignments */}
                        {getScoutingAssignments(match.matchNumber).length > 0 && (
                          <div className="border-t pt-4">
                            <div className="flex items-center space-x-2 mb-3">
                              <Users className="h-4 w-4 text-gray-600" />
                              <span className="font-semibold text-gray-700">Scout Assignments</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {getScoutingAssignments(match.matchNumber).map((assignment, index) => {
                                const isMyAssignment = assignment.scouts.includes(username);
                                return (
                                  <div 
                                    key={index} 
                                    className={`p-2 rounded border text-sm ${
                                      isMyAssignment && userRole === 'scouter' 
                                        ? 'bg-yellow-100 border-yellow-300 ring-2 ring-yellow-400' 
                                        : assignment.position.startsWith('red')
                                          ? 'bg-red-50 border-red-200'
                                          : 'bg-blue-50 border-blue-200'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <Badge 
                                        className={`text-xs ${
                                          assignment.position.startsWith('red') 
                                            ? 'bg-red-100 text-red-800' 
                                            : 'bg-blue-100 text-blue-800'
                                        }`}
                                      >
                                        {getPositionLabel(assignment.position)}
                                      </Badge>
                                      {isMyAssignment && userRole === 'scouter' && (
                                        <Badge className="bg-yellow-600 text-white text-xs">YOU</Badge>
                                      )}
                                    </div>
                                    <div className="font-medium text-xs">{assignment.teamName}</div>
                                    <div className="text-xs text-gray-600 mt-1">
                                      {assignment.scouts.map(scout => 
                                        scout === username && userRole === 'scouter' 
                                          ? <span key={scout} className="font-bold text-blue-700">{scout}</span>
                                          : scout
                                      ).reduce((prev, curr, index) => 
                                        index === 0 ? [curr] : [...prev, ', ', curr], []
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {getFilteredSchedule().length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500 mb-2">
                      {showMyAssignments && userRole === 'scouter' 
                        ? `No matches assigned to ${username}`
                        : "No matches scheduled yet"
                      }
                    </p>
                    <p className="text-sm text-gray-400">
                      {showMyAssignments && userRole === 'scouter' 
                        ? 'Check with your admin or switch to "Show All"'
                        : userRole === 'admin' ? 'Add your first match above to get started' : 'Ask your admin to add matches'
                      }
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchSchedule;
