import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Download, RefreshCw, Loader2, Check, X } from "lucide-react";
import { tbaApi } from "@/lib/tbaApi";
import { fetchMultipleTeamNames, preloadTeamNames } from "@/lib/teamNames";

interface TeamManagementProps {
  eventTeams?: string[];
}

const TeamManagement = ({ eventTeams = [] }: TeamManagementProps) => {
  const { toast } = useToast();
  const [teamNumbers, setTeamNumbers] = useState('');
  const [loading, setLoading] = useState(false);
  const [teamStatuses, setTeamStatuses] = useState<Map<string, { name: string; status: 'success' | 'error' | 'loading' }>>(new Map());

  useEffect(() => {
    if (eventTeams.length > 0) {
      setTeamNumbers(eventTeams.join(', '));
    }
  }, [eventTeams]);

  const parseTeamNumbers = (input: string): string[] => {
    return input
      .split(/[,\s\n]+/)
      .map(num => num.trim())
      .filter(num => num && /^\d+$/.test(num))
      .filter((num, index, arr) => arr.indexOf(num) === index); // Remove duplicates
  };

  const fetchTeamNames = async () => {
    const teams = parseTeamNumbers(teamNumbers);
    
    if (teams.length === 0) {
      toast({
        title: "No Teams",
        description: "Please enter team numbers to fetch names for.",
        variant: "destructive"
      });
      return;
    }

    if (teams.length > 100) {
      toast({
        title: "Too Many Teams",
        description: "Please limit to 100 teams at a time to avoid rate limiting.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    const newStatuses = new Map<string, { name: string; status: 'success' | 'error' | 'loading' }>();
    
    // Initialize all teams as loading
    teams.forEach(team => {
      newStatuses.set(team, { name: `Team ${team}`, status: 'loading' });
    });
    setTeamStatuses(new Map(newStatuses));

    try {
      const teamNames = await fetchMultipleTeamNames(teams);
      
      // Update statuses based on results
      for (const [teamNumber, teamName] of teamNames) {
        const isRealName = !teamName.startsWith('Team ') || teamName !== `Team ${teamNumber}`;
        newStatuses.set(teamNumber, {
          name: teamName,
          status: isRealName ? 'success' : 'error'
        });
      }
      
      setTeamStatuses(new Map(newStatuses));
      
      const successCount = Array.from(newStatuses.values()).filter(t => t.status === 'success').length;
      const errorCount = teams.length - successCount;
      
      toast({
        title: "Team Names Fetched",
        description: `Successfully fetched ${successCount} team names${errorCount > 0 ? `, ${errorCount} not found` : ''}.`,
      });
      
    } catch (error) {
      toast({
        title: "Fetch Failed",
        description: "Failed to fetch team names from The Blue Alliance.",
        variant: "destructive"
      });
      
      // Mark all as error
      teams.forEach(team => {
        newStatuses.set(team, { name: `Team ${team}`, status: 'error' });
      });
      setTeamStatuses(new Map(newStatuses));
    } finally {
      setLoading(false);
    }
  };

  const preloadAllTeams = async () => {
    const teams = parseTeamNumbers(teamNumbers);
    
    if (teams.length === 0) {
      toast({
        title: "No Teams",
        description: "Please enter team numbers to preload.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await preloadTeamNames(teams);
      toast({
        title: "Teams Preloaded",
        description: `Preloaded team names for ${teams.length} teams for faster access.`,
      });
    } catch (error) {
      toast({
        title: "Preload Failed",
        description: "Failed to preload team names.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    tbaApi.clearCache();
    setTeamStatuses(new Map());
    toast({
      title: "Cache Cleared",
      description: "TBA cache has been cleared. Team names will be re-fetched on next request.",
    });
  };

  const getStatusIcon = (status: 'success' | 'error' | 'loading') => {
    switch (status) {
      case 'success':
        return <Check className="h-3 w-3 text-green-600" />;
      case 'error':
        return <X className="h-3 w-3 text-red-600" />;
      case 'loading':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-600" />;
    }
  };

  const getStatusBadge = (status: 'success' | 'error' | 'loading') => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800 text-xs">Found</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800 text-xs">Not Found</Badge>;
      case 'loading':
        return <Badge className="bg-blue-100 text-blue-800 text-xs">Loading</Badge>;
    }
  };

  const parsedTeams = parseTeamNumbers(teamNumbers);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Team Name Management</span>
        </CardTitle>
        <CardDescription>
          Bulk fetch and manage team names from The Blue Alliance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Team Input */}
          <div>
            <Label htmlFor="teamNumbers">Team Numbers</Label>
            <textarea
              id="teamNumbers"
              className="w-full h-32 p-3 border rounded-md resize-none"
              placeholder="Enter team numbers separated by commas, spaces, or new lines:&#10;254, 1678, 118&#10;973 1114 1323&#10;2056&#10;5940"
              value={teamNumbers}
              onChange={(e) => setTeamNumbers(e.target.value)}
            />
            <div className="text-sm text-gray-600 mt-1">
              {parsedTeams.length > 0 ? (
                <>Found {parsedTeams.length} valid team number{parsedTeams.length !== 1 ? 's' : ''}</>
              ) : (
                'Enter team numbers above'
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button 
              onClick={fetchTeamNames}
              disabled={loading || parsedTeams.length === 0}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Fetch Names
                </>
              )}
            </Button>
            
            <Button 
              onClick={preloadAllTeams}
              disabled={loading || parsedTeams.length === 0}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Preload Cache
            </Button>
            
            <Button 
              onClick={clearCache}
              variant="outline"
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Cache
            </Button>
          </div>

          {/* Results */}
          {teamStatuses.size > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-gray-700">
                Team Name Results ({teamStatuses.size} teams):
              </h4>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {Array.from(teamStatuses.entries())
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([teamNumber, { name, status }]) => (
                    <div 
                      key={teamNumber}
                      className="flex items-center justify-between p-2 border rounded-md bg-gray-50"
                    >
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(status)}
                        <span className="font-medium">Team {teamNumber}</span>
                        <span className="text-gray-600">{name}</span>
                      </div>
                      {getStatusBadge(status)}
                    </div>
                  ))}
              </div>
              
              {/* Summary */}
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="font-semibold text-green-600">
                      {Array.from(teamStatuses.values()).filter(t => t.status === 'success').length}
                    </div>
                    <div>Found</div>
                  </div>
                  <div>
                    <div className="font-semibold text-red-600">
                      {Array.from(teamStatuses.values()).filter(t => t.status === 'error').length}
                    </div>
                    <div>Not Found</div>
                  </div>
                  <div>
                    <div className="font-semibold text-blue-600">
                      {Array.from(teamStatuses.values()).filter(t => t.status === 'loading').length}
                    </div>
                    <div>Loading</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <p className="mb-1">
              <strong>Fetch Names:</strong> Downloads team names from TBA and caches them locally.
            </p>
            <p className="mb-1">
              <strong>Preload Cache:</strong> Loads team names into memory for faster access during scouting.
            </p>
            <p>
              <strong>Clear Cache:</strong> Removes all cached team data to force fresh downloads.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamManagement;