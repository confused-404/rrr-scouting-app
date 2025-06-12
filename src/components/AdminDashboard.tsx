
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TeamRankings from "@/components/admin/TeamRankings";
import PerformanceAnalytics from "@/components/admin/PerformanceAnalytics";
import AlliancePicklist from "@/components/admin/AlliancePicklist";
import OverviewCards from "@/components/admin/OverviewCards";
import CustomChartGenerator from "@/components/CustomChartGenerator";

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

  const handleExportData = () => {
    // Calculate team statistics for export
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
    }));

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

  return (
    <div className="space-y-6">
      <OverviewCards scoutingData={scoutingData} superScoutNotes={superScoutNotes} />

      <Tabs defaultValue="rankings" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto">
            <TabsTrigger value="rankings" className="text-xs sm:text-sm">Rankings</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm">Analytics</TabsTrigger>
            <TabsTrigger value="picklist" className="text-xs sm:text-sm">Picklist</TabsTrigger>
            <TabsTrigger value="custom" className="text-xs sm:text-sm">Custom Charts</TabsTrigger>
          </TabsList>
          <Button onClick={handleExportData} variant="outline" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>

        <TabsContent value="rankings" className="space-y-4">
          <TeamRankings scoutingData={scoutingData} superScoutNotes={superScoutNotes} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <PerformanceAnalytics scoutingData={scoutingData} />
        </TabsContent>

        <TabsContent value="picklist" className="space-y-4">
          <AlliancePicklist scoutingData={scoutingData} />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <CustomChartGenerator scoutingData={scoutingData} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
