import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Users, TrendingUp, Shield, Zap, Target, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAllScoutingEntries, subscribeScoutingEntries, getAppDoc, subscribeAppDoc } from '@/lib/firebase'

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
}

const MatchStrategy = () => {
  const { toast } = useToast();
  const [teams, setTeams] = useState<string[]>(['', '', '']);
  const [teamStats, setTeamStats] = useState<(TeamStats | null)[]>([null, null, null]);
  const [scoutingData, setScoutingData] = useState<ScoutingData[]>([]);
  const [superScoutNotes, setSuperScoutNotes] = useState<{[key: string]: SuperScoutNote[]}>({});
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState('');

  useEffect(() => {
    let unsubEntries: any | null = null
    let unsubNotes: any | null = null

    const load = async () => {
      const data = await getAllScoutingEntries();
      const notes = (await getAppDoc('superScoutNotes')) || {};
      setScoutingData(data || []);
      setSuperScoutNotes(notes || {});

      unsubEntries = subscribeScoutingEntries((rows) => setScoutingData(rows || []));
      unsubNotes = subscribeAppDoc('superScoutNotes', (val) => setSuperScoutNotes(val || {}));
    }

    load();

    return () => {
      if (unsubEntries) unsubEntries();
      if (unsubNotes) unsubNotes();
    }
  }, []);

  const calculateTeamStats = (teamNumber: string): TeamStats | null => {
    const teamMatches = scoutingData.filter(match => match.teamNumber === teamNumber);
    
    if (teamMatches.length === 0) return null;

    return {
      teamNumber,
      matches: teamMatches.length,
      avgAutoPoints: teamMatches.reduce((sum, match) => sum + match.autoGamePieces, 0) / teamMatches.length,
      avgTeleopPoints: teamMatches.reduce((sum, match) => sum + match.teleopGamePieces, 0) / teamMatches.length,
      avgDefense: teamMatches.reduce((sum, match) => sum + match.defense, 0) / teamMatches.length,
      avgReliability: teamMatches.reduce((sum, match) => sum + match.reliability, 0) / teamMatches.length,
      climbRate: (teamMatches.filter(match => match.climbing === "success").length / teamMatches.length) * 100,
      mobilityRate: (teamMatches.filter(match => match.autoMobility === "yes").length / teamMatches.length) * 100,
      totalScore: teamMatches.reduce((sum, match) => sum + match.autoGamePieces + match.teleopGamePieces, 0)
    };
  };

  const updateTeam = (index: number, teamNumber: string) => {
    const newTeams = [...teams];
    newTeams[index] = teamNumber;
    setTeams(newTeams);

    const newStats = [...teamStats];
    newStats[index] = teamNumber ? calculateTeamStats(teamNumber) : null;
    setTeamStats(newStats);
  };

  const analyzeAlliance = () => {
    const validStats = teamStats.filter(stat => stat !== null) as TeamStats[];
    
    if (validStats.length === 0) {
      toast({
        title: "No Data",
        description: "Please enter team numbers with available data.",
        variant: "destructive"
      });
      return;
    }

    const totalAuto = validStats.reduce((sum, stat) => sum + stat.avgAutoPoints, 0);
    const totalTeleop = validStats.reduce((sum, stat) => sum + stat.avgTeleopPoints, 0);
    const avgDefense = validStats.reduce((sum, stat) => sum + stat.avgDefense, 0) / validStats.length;
    const avgReliability = validStats.reduce((sum, stat) => sum + stat.avgReliability, 0) / validStats.length;
    const climbCapability = validStats.filter(stat => stat.climbRate > 50).length;

    let strategy = "";
    
    if (totalAuto > 8) {
      strategy += "🚀 Strong autonomous alliance - focus on positioning\n";
    } else {
      strategy += "⚠️ Weak autonomous - prioritize defense\n";
    }

    if (totalTeleop > 40) {
      strategy += "🎯 High scoring potential - play aggressive\n";
    } else {
      strategy += "🛡️ Focus on defense and consistency\n";
    }

    if (climbCapability >= 2) {
      strategy += "🧗 Multiple climbers - coordinate timing\n";
    } else if (climbCapability === 1) {
      strategy += "🧗 Single climber - protect and support\n";
    } else {
      strategy += "❌ No reliable climbers - focus on cycles\n";
    }

    if (avgReliability > 8) {
      strategy += "✅ Reliable alliance - can take risks\n";
    } else {
      strategy += "⚠️ Reliability concerns - play safe\n";
    }

    setAnalysisResult(strategy);
    setShowAnalysis(true);
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

  const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) => (
    <div className="text-center p-2 sm:p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-center mb-1">
        <Icon className={`h-3 w-3 sm:h-4 sm:w-4 ${color} mr-1`} />
        <span className="text-xs sm:text-sm font-medium truncate">{title}</span>
      </div>
      <div className={`text-sm sm:text-lg font-bold ${color}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-6 px-4 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-6 w-6 text-blue-600" />
            <span>Match Strategy Analysis</span>
          </CardTitle>
          <CardDescription>
            Compare up to 3 teams simultaneously for alliance strategy planning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {teams.map((team, index) => (
                <div key={index} className="space-y-2">
                  <Label htmlFor={`team-${index}`} className="text-sm">Team {index + 1}</Label>
                  <Input
                    id={`team-${index}`}
                    placeholder="Enter team number"
                    value={team}
                    onChange={(e) => updateTeam(index, e.target.value)}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
            <Button onClick={analyzeAlliance} className="w-full">
              <Target className="h-4 w-4 mr-2" />
              Analyze Alliance Strategy
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {teamStats.map((stats, index) => (
          <Card key={index} className={stats ? "border-blue-200" : "border-gray-200 opacity-50"}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Team {teams[index] || `${index + 1}`}</span>
                {stats && superScoutNotes[stats.teamNumber] && (
                  (() => {
                    const notesArr = superScoutNotes[stats.teamNumber] || [];
                    const latest = notesArr[notesArr.length - 1];
                    return latest ? (
                      <Badge className={getPriorityColor(latest.picklistPriority)}>
                        {latest.picklistPriority.toUpperCase()}
                      </Badge>
                    ) : null
                  })()
                )}
              </CardTitle>
              {stats && (
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">{stats.matches} matches</Badge>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-1 sm:gap-2">
                    <StatCard
                      title="Auto"
                      value={stats.avgAutoPoints.toFixed(1)}
                      icon={Zap}
                      color="text-blue-600"
                    />
                    <StatCard
                      title="Teleop"
                      value={stats.avgTeleopPoints.toFixed(1)}
                      icon={Target}
                      color="text-green-600"
                    />
                    <StatCard
                      title="Defense"
                      value={`${stats.avgDefense.toFixed(1)}/10`}
                      icon={Shield}
                      color="text-purple-600"
                    />
                    <StatCard
                      title="Reliability"
                      value={`${stats.avgReliability.toFixed(1)}/10`}
                      icon={TrendingUp}
                      color="text-orange-600"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="text-sm font-medium">Climb Success</span>
                      <span className="font-bold text-blue-600">{stats.climbRate.toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm font-medium">Mobility Success</span>
                      <span className="font-bold text-green-600">{stats.mobilityRate.toFixed(0)}%</span>
                    </div>
                  </div>

                  {superScoutNotes[stats.teamNumber] && (
                    (() => {
                      const notesArr = superScoutNotes[stats.teamNumber] || [];
                      const latest = notesArr[notesArr.length - 1];
                      return (
                        <div className="p-2 sm:p-3 bg-gray-50 rounded-lg">
                          <div className="text-xs sm:text-sm font-medium mb-1">Notes:</div>
                          <div className="text-xs sm:text-sm text-gray-700 break-words">
                            {latest ? latest.strategicNotes : 'No notes'}
                          </div>
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
                      )
                    })()
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Enter team number to view data</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analysis Modal - Mobile Friendly */}
      {showAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Alliance Strategy</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAnalysis(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {analysisResult.split('\n').filter(line => line.trim()).map((line, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <span className="text-sm">{line}</span>
                  </div>
                ))}
              </div>
              <Button 
                onClick={() => setShowAnalysis(false)} 
                className="w-full mt-4"
              >
                Got it!
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchStrategy;