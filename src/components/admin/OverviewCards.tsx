
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, Shield, MessageSquare } from "lucide-react";

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

interface OverviewCardsProps {
  scoutingData: ScoutingData[];
  superScoutNotes: {[key: string]: SuperScoutNote[]};
}

const OverviewCards = ({ scoutingData, superScoutNotes }: OverviewCardsProps) => {
  const teamStats = scoutingData.reduce((acc, entry) => {
    if (!acc[entry.teamNumber]) acc[entry.teamNumber] = true;
    return acc;
  }, {} as any);

  return (
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
  );
};

export default OverviewCards;
