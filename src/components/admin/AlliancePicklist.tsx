
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
}

const AlliancePicklist = ({ scoutingData }: AlliancePicklistProps) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alliance Selection Picklist</CardTitle>
        <CardDescription>Recommended teams for alliance selection based on overall performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-yellow-800">Tier 1 - First Picks</CardTitle>
              </CardHeader>
              <CardContent>
                {teamStatsArray.slice(0, 3).map((team, index) => (
                  <div key={team.teamNumber} className="flex items-center justify-between mb-2 p-2 bg-white rounded">
                    <span className="font-semibold text-sm sm:text-base">Team {team.teamNumber}</span>
                    <Badge className="bg-yellow-600">
                      {team.totalScore} pts
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-blue-800">Tier 2 - Strong Options</CardTitle>
              </CardHeader>
              <CardContent>
                {teamStatsArray.slice(3, 8).map((team, index) => (
                  <div key={team.teamNumber} className="flex items-center justify-between mb-2 p-2 bg-white rounded">
                    <span className="font-semibold text-sm sm:text-base">Team {team.teamNumber}</span>
                    <Badge variant="secondary">
                      {team.totalScore} pts
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-800">Tier 3 - Solid Choices</CardTitle>
              </CardHeader>
              <CardContent>
                {teamStatsArray.slice(8, 13).map((team, index) => (
                  <div key={team.teamNumber} className="flex items-center justify-between mb-2 p-2 bg-white rounded">
                    <span className="font-semibold text-sm sm:text-base">Team {team.teamNumber}</span>
                    <Badge variant="outline">
                      {team.totalScore} pts
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
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
                        <span>Team {team.teamNumber}</span>
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
                        <span>Team {team.teamNumber}</span>
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
                        <span>Team {team.teamNumber}</span>
                        <span>{team.avgDefense}/10 defense</span>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

export default AlliancePicklist;
