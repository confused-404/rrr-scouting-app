
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Plus, Clock, Users, Target } from "lucide-react";

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

const MatchSchedule = () => {
  const { toast } = useToast();
  const [schedule, setSchedule] = useState<ScheduledMatch[]>([]);
  const [newMatch, setNewMatch] = useState({
    matchNumber: '',
    time: '',
    red1: '', red2: '', red3: '',
    blue1: '', blue2: '', blue3: ''
  });
  const [scoutingData, setScoutingData] = useState<MatchData[]>([]);

  useEffect(() => {
    const savedSchedule = JSON.parse(localStorage.getItem("matchSchedule") || "[]");
    const savedScoutingData = JSON.parse(localStorage.getItem("scoutingData") || "[]");
    setSchedule(savedSchedule);
    setScoutingData(savedScoutingData);
  }, []);

  const saveSchedule = (updatedSchedule: ScheduledMatch[]) => {
    localStorage.setItem("matchSchedule", JSON.stringify(updatedSchedule));
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle>Match Schedule</CardTitle>
              <CardDescription>View upcoming matches with team last match data</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Add Match Form */}
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

            {/* Schedule Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Match</TableHead>
                    <TableHead className="w-24">Time</TableHead>
                    <TableHead>Red Alliance</TableHead>
                    <TableHead>Blue Alliance</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedule.map((match) => (
                    <TableRow key={match.id}>
                      <TableCell className="font-medium">#{match.matchNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span className="text-sm">{match.time}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {match.redAlliance.map((team, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="font-medium">Team {team}</span>
                              {getTeamBadge(team)}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          {match.blueAlliance.map((team, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="font-medium">Team {team}</span>
                              {getTeamBadge(team)}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMatch(match.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {schedule.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No matches scheduled yet. Add your first match above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MatchSchedule;
