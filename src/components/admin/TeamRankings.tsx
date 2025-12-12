
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

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

interface TeamRankingsProps {
  scoutingData: ScoutingData[];
  superScoutNotes: {[key: string]: SuperScoutNote[]};
  teamNames?: Map<string, string>;
}

import { getTeamNameWithCustom } from "@/lib/teamNames";

const TeamRankings = ({ scoutingData, superScoutNotes, teamNames }: TeamRankingsProps) => {
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

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge className="bg-green-600">Must Pick</Badge>;
      case "medium":
        return <Badge variant="secondary">Good Option</Badge>;
      case "low":
        return <Badge variant="outline">Last Resort</Badge>;
      case "avoid":
        return <Badge className="bg-red-600">Avoid</Badge>;
      default:
        return <Badge variant="outline">Not Rated</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Performance Rankings</CardTitle>
        <CardDescription>Teams ranked by total game pieces scored with strategic notes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {teamStatsArray.slice(0, 15).map((team, index) => (
            <div key={team.teamNumber} className="border rounded-lg p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <Badge variant={index < 3 ? "default" : "secondary"}>
                    #{index + 1}
                  </Badge>
                  <div>
                    <div className="font-semibold">Team {team.teamNumber}</div>
                    <div className="text-sm font-medium text-blue-600">
                      {teamNames?.get(team.teamNumber) || getTeamNameWithCustom(team.teamNumber)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {team.matches} matches • {team.totalScore} total points
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const notesArr = superScoutNotes[team.teamNumber] || [];
                    const latest = notesArr[notesArr.length - 1];
                    return getPriorityBadge(latest?.picklistPriority);
                  })()}
                  <div className="text-left sm:text-right">
                    <div className="font-medium">{team.avgAutoPoints} / {team.avgTeleopPoints}</div>
                    <div className="text-sm text-muted-foreground">Auto / Teleop Avg</div>
                  </div>
                </div>
              </div>
              {((() => {
                const notesArr = superScoutNotes[team.teamNumber] || [];
                const latest = notesArr[notesArr.length - 1];
                return notesArr.length ? (
                  <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                    <div className="flex items-start space-x-2">
                      <Star className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-yellow-800">Strategic Notes:</div>
                        <div className="text-sm text-yellow-700">{latest?.strategicNotes}</div>
                        {notesArr.length > 1 && (
                          <details className="mt-2 text-sm">
                            <summary className="cursor-pointer text-blue-600">View all notes ({notesArr.length})</summary>
                            <ul className="mt-2 list-disc list-inside space-y-1">
                              {notesArr.slice().reverse().map(n => (
                                <li key={n.id} className="text-xs text-yellow-700">
                                  <div className="font-medium">{new Date(n.timestamp).toLocaleString()}</div>
                                  <div>{n.strategicNotes}</div>
                                  <div className="text-[10px] text-muted-foreground">Priority: {n.picklistPriority}</div>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null
              })())}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamRankings;
