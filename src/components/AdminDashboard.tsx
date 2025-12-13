
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
import TeamManagement from "@/components/admin/TeamManagement";
import { useTeamNames } from "@/hooks/useTeamNames";
import { getTeamNameWithCustom } from "@/lib/teamNames";
import {
  getAllScoutingEntries,
  subscribeScoutingEntries,
  getAppDoc,
  subscribeAppDoc,
} from '@/lib/firebase'

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
  const [superScoutNotes, setSuperScoutNotes] = useState<{[key: string]: SuperScoutNote[]}>({});

  // Get all unique team numbers for team name fetching
  const allTeamNumbers = Array.from(new Set(scoutingData.map(entry => entry.teamNumber)));
  const { teamNames } = useTeamNames(allTeamNumbers);

  useEffect(() => {
    let unsubEntries: any | null = null
    let unsubNotes: any | null = null
    let unsubConfig: any | null = null
    let unsubPit: any | null = null

    const load = async () => {
      const data = await getAllScoutingEntries();
      const notes = (await getAppDoc('superScoutNotes')) || {};
      const savedConfig = (await getAppDoc('formConfiguration')) || null;
      const pitData = (await getAppDoc('pitScoutingData')) || [];
      console.log('AdminDashboard loaded from Firestore:', { dataCount: data?.length, notes });
      setScoutingData(data || []);
      setSuperScoutNotes(notes || {});
      setPitScoutingData(pitData || []);
      if (savedConfig && savedConfig.matchScouting) setFormConfig(savedConfig as any)

      unsubEntries = subscribeScoutingEntries((rows) => {
        console.log('AdminDashboard real-time update:', rows?.length);
        setScoutingData(rows || []);
      });
      unsubNotes = subscribeAppDoc('superScoutNotes', (val) => {
        console.log('AdminDashboard notes update:', val);
        setSuperScoutNotes(val || {});
      });
      unsubConfig = subscribeAppDoc('formConfiguration', (val) => { if (val && val.matchScouting) setFormConfig(val) })
      unsubPit = subscribeAppDoc('pitScoutingData', (val) => { setPitScoutingData(val || []) })
    }

    load();

    return () => {
      if (unsubEntries) unsubEntries();
      if (unsubNotes) unsubNotes();
      if (unsubConfig) unsubConfig();
      if (unsubPit) unsubPit();
    }
  }, []);

  const [formConfig, setFormConfig] = useState<any>(null);
  const [pitScoutingData, setPitScoutingData] = useState<any[]>([]);

  const handleExportData = () => {
    // Build CSV with one row per submission (match or pit), using configured fields as columns
    const matchFields = formConfig?.matchScouting ?? [];
    const pitFields = formConfig?.pitScouting ?? [];

    const matchFieldIds = matchFields.map((f:any) => f.id);
    const pitFieldIds = pitFields.map((f:any) => f.id);

    // Headers: FormType, Team, Team Name, Match, Created At, <match field labels...>, <pit field labels not duplicated>, Strategic Notes, Priority
    const pitOnlyFields = pitFields.filter((pf:any) => !matchFieldIds.includes(pf.id));
    const headerCols = [
      'FormType', 'Team', 'Team Name', 'Match', 'Created At',
      ...matchFields.map((f:any) => f.label),
      ...pitOnlyFields.map((f:any) => f.label),
      'Strategic Notes', 'Priority'
    ];

    const escape = (v: any) => {
      if (v === null || v === undefined) return '';
      const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }

    const rows: string[] = [];

    // Helper to get team-level notes/priority
    const getNotesForTeam = (teamNumber: string) => {
      const notesArr = superScoutNotes[teamNumber] || [];
      const latest = notesArr[notesArr.length - 1];
      const joinedNotes = notesArr.length ? notesArr.map((n:any) => n.strategicNotes).join(' | ') : '';
      const priority = latest?.picklistPriority || '';
      return { joinedNotes, priority };
    }

    // Match submissions (scoutingData)
    scoutingData.forEach((entry: any) => {
      const team = entry.teamNumber;
      const formType = 'match';
      const matchNum = entry.matchNumber ?? '';
      const createdAt = entry.createdAt ?? entry.timestamp ?? '';

      const values: any[] = [];
      // match fields
      matchFields.forEach((f:any) => {
        const v = (entry.fields && entry.fields[f.id]) ?? entry[f.id] ?? entry[f.id.replace(/\s+/g, '')] ?? '';
        values.push(escape(v));
      });
      // pit-only fields blank for match rows
      pitOnlyFields.forEach(() => values.push(''));

      const notes = getNotesForTeam(team);

      const row = [formType, team, `"${teamNames.get(team) || getTeamNameWithCustom(team)}"`, matchNum, createdAt, ...values, escape(notes.joinedNotes), notes.priority].join(',');
      rows.push(row);
    });

    // Pit submissions (pitScoutingData)
    pitScoutingData.forEach((entry: any) => {
      const team = entry.teamNumber;
      const formType = 'pit';
      const matchNum = '';
      const createdAt = entry.timestamp ?? '';

      const values: any[] = [];
      // match fields blank for pit rows
      matchFields.forEach(() => values.push(''));
      // pit fields
      pitOnlyFields.forEach((f:any) => {
        const v = entry[f.id] ?? entry[f.id.replace(/\s+/g, '')] ?? '';
        values.push(escape(v));
      });

      const notes = getNotesForTeam(team);

      const row = [formType, team, `"${teamNames.get(team) || getTeamNameWithCustom(team)}"`, matchNum, createdAt, ...values, escape(notes.joinedNotes), notes.priority].join(',');
      rows.push(row);
    });

    const csvContent = [headerCols.join(','), ...rows].join('\n');

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
          <TabsList className="grid w-full grid-cols-5 lg:w-auto">
            <TabsTrigger value="rankings" className="text-xs sm:text-sm">Rankings</TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs sm:text-sm">Analytics</TabsTrigger>
            <TabsTrigger value="picklist" className="text-xs sm:text-sm">Picklist</TabsTrigger>
            <TabsTrigger value="teams" className="text-xs sm:text-sm">Teams</TabsTrigger>
            <TabsTrigger value="custom" className="text-xs sm:text-sm">Charts</TabsTrigger>
          </TabsList>
          <Button onClick={handleExportData} variant="outline" className="w-full sm:w-auto">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>

        <TabsContent value="rankings" className="space-y-4">
          <TeamRankings scoutingData={scoutingData} superScoutNotes={superScoutNotes} teamNames={teamNames} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <PerformanceAnalytics scoutingData={scoutingData} teamNames={teamNames} />
        </TabsContent>

        <TabsContent value="picklist" className="space-y-4">
          <AlliancePicklist scoutingData={scoutingData} teamNames={teamNames} />
        </TabsContent>

        <TabsContent value="teams" className="space-y-4">
          <TeamManagement />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <CustomChartGenerator scoutingData={scoutingData} teamNames={teamNames} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;
