import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Download, Trophy, Target, Shield, Zap, Star, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

const AdminDashboard = () => {
  const { toast } = useToast();
  const [scoutingData, setScoutingData] = useState<ScoutingData[]>([]);
  const [superScoutNotes, setSuperScoutNotes] = useState<{[key: string]: SuperScoutNote}>({});

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("scoutingData") || "[]");
    const notes = JSON.parse(localStorage.getItem("superScoutNotes") || "{}");
    setScoutingData(data);
    setSuperScoutNotes(notes);
  }, []);

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

  // Convert to array and calculate averages
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

  const handleExportData = () => {
    const csvContent = [
      ["Team", "Matches", "Avg Auto", "Avg Teleop", "Defense", "Reliability", "Climb Rate", "Mobility Rate", "Strategic Notes", "Priority"].join(","),
      ...teamStatsArray.map(team => [
        team.teamNumber,
        team.matches,
        team.avgAutoPoints,
        team.avgTeleopPoints,
        team.avgDefense,
        team.avgReliability,
        team.climbRate + "%",
        team.mobilityRate + "%",
        `"${superScoutNotes[team.teamNumber]?.strategicNotes || 'No notes'}"`,
        superScoutNotes[team.teamNumber]?.picklistPriority || 'Not rated'
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "frc-scouting-data.csv";
    a.click();
    
    toast({
      title: "Data Exported!",
      description: "Scouting data has been downloaded as CSV file.",
    });
  };

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

  // Convert to array and calculate averages
  const allianceData = [
    { name: "Red Alliance Wins", value: scoutingData.filter(d => d.alliance === "red").length, color: "#ef4444" },
    { name: "Blue Alliance Wins", value: scoutingData.filter(d => d.alliance === "blue").length, color: "#3b82f6" }
  ];

  const top10Teams = teamStatsArray.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scoutingData.length}</div>
            <p className="text-xs text-muted-foreground">
              Scouted this season
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teams Tracked</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(teamStats).length}</div>
            <p className="text-xs text-muted-foreground">
              Unique teams scouted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Strategic Notes</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(superScoutNotes).length}</div>
            <p className="text-xs text-muted-foreground">
              Teams with notes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Climb Success</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {scoutingData.length > 0 ? 
                Math.round((scoutingData.filter(d => d.climbing === "success").length / scoutingData.length) * 100) : 
                0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Successful climbs
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="rankings" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto">
            <TabsTrigger value="rankings" className="text-xs sm:text-sm">Team Rankings</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm">Performance Analytics</TabsTrigger>
            <TabsTrigger value="picklist" className="text-xs sm:text-sm">Alliance Picklist</TabsTrigger>
          </TabsList>
          <Button onClick={handleExportData} variant="outline" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>

        <TabsContent value="rankings" className="space-y-4">
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
                          <div className="text-sm text-muted-foreground">
                            {team.matches} matches • {team.totalScore} total points
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPriorityBadge(superScoutNotes[team.teamNumber]?.picklistPriority)}
                        <div className="text-left sm:text-right">
                          <div className="font-medium">{team.avgAutoPoints} / {team.avgTeleopPoints}</div>
                          <div className="text-sm text-muted-foreground">Auto / Teleop Avg</div>
                        </div>
                      </div>
                    </div>
                    {superScoutNotes[team.teamNumber]?.strategicNotes && (
                      <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                        <div className="flex items-start space-x-2">
                          <Star className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-sm font-medium text-yellow-800">Strategic Notes:</div>
                            <div className="text-sm text-yellow-700">{superScoutNotes[team.teamNumber].strategicNotes}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
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
          </div>

          <Card>
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
        </TabsContent>

        <TabsContent value="picklist" className="space-y-4">
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
