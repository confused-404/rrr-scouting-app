
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

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

interface PerformanceAnalyticsProps {
  scoutingData: ScoutingData[];
}

const PerformanceAnalytics = ({ scoutingData }: PerformanceAnalyticsProps) => {
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

  const allianceData = [
    { name: "Red Alliance", value: scoutingData.filter(d => d.alliance === "red").length, color: "#ef4444" },
    { name: "Blue Alliance", value: scoutingData.filter(d => d.alliance === "blue").length, color: "#3b82f6" }
  ];

  const top10Teams = teamStatsArray.slice(0, 10);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top 10 Teams - Total Points</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10Teams}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="teamNumber" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="totalScore" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alliance Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={allianceData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {allianceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Defense vs Reliability Ratings</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={top10Teams}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="teamNumber" />
              <YAxis domain={[0, 10]} />
              <Tooltip />
              <Line type="monotone" dataKey="avgDefense" stroke="#ef4444" name="Defense" />
              <Line type="monotone" dataKey="avgReliability" stroke="#22c55e" name="Reliability" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceAnalytics;
