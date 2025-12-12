import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, TrendingUp, Shield, Zap, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getTeamNameWithCustom } from "@/lib/teamNames";
import { getAllScoutingEntries, getAppDoc, subscribeScoutingEntries, subscribeAppDoc } from '@/lib/firebase'

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

interface SuperScoutNote {
  strategicNotes: string;
  picklistPriority: string;
  timestamp: string;
  id: number;
}

interface TeamStats {
  teamNumber: string;
  matches: number;
  avgAutoPoints: number;
  avgTeleopPoints: number;
  avgDefense: number;
  avgReliability: number;
  climbRate: number;
  mobilityRate: number;
  totalScore: number;
  recentMatches: ScoutingData[];
}

const TeamLookup = () => {
  const { toast } = useToast();
  const [searchTeam, setSearchTeam] = useState("");
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [scoutingData, setScoutingData] = useState<ScoutingData[]>([]);
  const [superScoutNotes, setSuperScoutNotes] = useState<{[key: string]: SuperScoutNote[]}>({});

  useEffect(() => {
    let unsubEntries: any | null = null;
    let unsubNotes: any | null = null;

    const load = async () => {
      const data = await getAllScoutingEntries();
      const notes = (await getAppDoc('superScoutNotes')) || {};
      setScoutingData(data || []);
      setSuperScoutNotes(notes || {});

      unsubEntries = subscribeScoutingEntries(rows => setScoutingData(rows || []));
      unsubNotes = subscribeAppDoc('superScoutNotes', val => setSuperScoutNotes(val || {}));
    };

    load();

    return () => {
      if (unsubEntries) unsubEntries();
      if (unsubNotes) unsubNotes();
    };
  }, []);

  const searchTeamData = () => {
    const teamKey = searchTeam.trim();
    if (!teamKey) {
      toast({
        title: "Enter Team Number",
        description: "Please enter a team number to search.",
        variant: "destructive"
      });
      return;
    }

    const teamMatches = scoutingData.filter(match => match.teamNumber === teamKey);
    
    // If there are no scouting entries, still show the team view so strategic notes are visible.
    if (teamMatches.length === 0) {
      toast({
        title: "No Scouting Entries",
        description: `No scouting data found for team ${teamKey}, showing strategic notes if present.`,
        variant: "default"
      });
      const emptyStats: TeamStats = {
        teamNumber: teamKey,
        matches: 0,
        avgAutoPoints: 0,
        avgTeleopPoints: 0,
        avgDefense: 0,
        avgReliability: 0,
        climbRate: 0,
        mobilityRate: 0,
        totalScore: 0,
        recentMatches: []
      };
      setTeamStats(emptyStats);
      return;
    }

    const stats: TeamStats = {
      teamNumber: teamKey,
      matches: teamMatches.length,
      avgAutoPoints: teamMatches.reduce((sum, match) => sum + match.autoGamePieces, 0) / teamMatches.length,
      avgTeleopPoints: teamMatches.reduce((sum, match) => sum + match.teleopGamePieces, 0) / teamMatches.length,
      avgDefense: teamMatches.reduce((sum, match) => sum + match.defense, 0) / teamMatches.length,
      avgReliability: teamMatches.reduce((sum, match) => sum + match.reliability, 0) / teamMatches.length,
      climbRate: (teamMatches.filter(match => match.climbing === "success").length / teamMatches.length) * 100,
      mobilityRate: (teamMatches.filter(match => match.autoMobility === "yes").length / teamMatches.length) * 100,
      totalScore: teamMatches.reduce((sum, match) => sum + match.autoGamePieces + match.teleopGamePieces, 0),
      recentMatches: teamMatches.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5)
    };

    setTeamStats(stats);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-green-600';
      case 'medium': return 'bg-yellow-600';
      case 'low': return 'bg-orange-600';
      case 'avoid': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="space-y-6 px-4 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-6 w-6 text-blue-600" />
            <span>Team Lookup</span>
          </CardTitle>
          <CardDescription>
            Search for detailed team performance data and strategic notes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
            <Input
              placeholder="Enter team number (e.g., 1114)"
              value={searchTeam}
              onChange={(e) => setSearchTeam(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchTeamData()}
              className="flex-1"
            />
            <Button onClick={searchTeamData} className="w-full sm:w-auto">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {teamStats && (
        <div className="space-y-6">
          {/* Team Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Team {teamStats.teamNumber}</CardTitle>
              <CardDescription className="text-lg font-medium text-gray-700">
                {getTeamNameWithCustom(teamStats.teamNumber)}
              </CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{teamStats.matches} matches scouted</Badge>
                {superScoutNotes[teamStats.teamNumber] && (() => {
                  const notesArr = superScoutNotes[teamStats.teamNumber] || [];
                  const latest = notesArr[notesArr.length - 1];
                  return latest ? (
                    <Badge className={getPriorityColor(latest.picklistPriority)}>
                      {latest.picklistPriority.toUpperCase()} Priority
                    </Badge>
                  ) : null
                })()}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Zap className="h-5 w-5 text-blue-600 mr-1" />
                    <span className="font-semibold">Auto Avg</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {teamStats.avgAutoPoints.toFixed(1)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Target className="h-5 w-5 text-green-600 mr-1" />
                    <span className="font-semibold">Teleop Avg</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {teamStats.avgTeleopPoints.toFixed(1)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Shield className="h-5 w-5 text-purple-600 mr-1" />
                    <span className="font-semibold">Defense</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {teamStats.avgDefense.toFixed(1)}/10
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingUp className="h-5 w-5 text-orange-600 mr-1" />
                    <span className="font-semibold">Reliability</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {teamStats.avgReliability.toFixed(1)}/10
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-lg font-semibold text-blue-700">Climb Success Rate</div>
                  <div className="text-3xl font-bold text-blue-600">{teamStats.climbRate.toFixed(0)}%</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-lg font-semibold text-green-700">Mobility Success Rate</div>
                  <div className="text-3xl font-bold text-green-600">{teamStats.mobilityRate.toFixed(0)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Strategic Notes */}
          {((() => {
            const notesArr = superScoutNotes[teamStats.teamNumber] || [];
            if (!notesArr.length) return null;
            const latest = notesArr[notesArr.length - 1];
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Strategic Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-700">{latest?.strategicNotes}</p>
                    {notesArr.length > 1 && (
                      <details className="mt-2 text-sm">
                        <summary className="cursor-pointer text-blue-600">View all notes ({notesArr.length})</summary>
                        <ul className="mt-2 list-disc list-inside space-y-1">
                          {notesArr.slice().reverse().map(n => (
                            <li key={n.id} className="text-xs text-gray-700">
                              <div className="font-medium">{new Date(n.timestamp).toLocaleString()}</div>
                              <div>{n.strategicNotes}</div>
                              <div className="text-[10px] text-muted-foreground">Priority: {n.picklistPriority}</div>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })())}

          {/* Recent Matches */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Match Performance</CardTitle>
              <CardDescription>Last {teamStats.recentMatches.length} matches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teamStats.recentMatches.map((match, index) => (
                  <div key={match.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Badge className={match.alliance === 'red' ? 'bg-red-600' : 'bg-blue-600'}>
                        Match {match.matchNumber}
                      </Badge>
                      <div className="text-sm text-gray-600">
                        {new Date(match.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div>Auto: <span className="font-semibold">{match.autoGamePieces}</span></div>
                      <div>Teleop: <span className="font-semibold">{match.teleopGamePieces}</span></div>
                      <div>Climb: <span className="font-semibold">{match.climbing}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TeamLookup;