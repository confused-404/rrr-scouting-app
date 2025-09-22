import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Calendar, MapPin, Users, Loader2 } from "lucide-react";
import { tbaApi, TBAEvent, ProcessedMatch } from "@/lib/tbaApi";
import { fetchMultipleTeamNames } from "@/lib/teamNames";

interface EventImportProps {
  onImportMatches: (matches: ProcessedMatch[], clearExisting?: boolean) => void;
  onImportTeams?: (teamNumbers: string[]) => void;
}

const EventImport = ({ onImportMatches, onImportTeams }: EventImportProps) => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<TBAEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TBAEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchYear, setSearchYear] = useState(new Date().getFullYear());

  const searchEvents = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Search Required",
        description: "Please enter an event name, code, or location to search.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const results = await tbaApi.searchEvents(searchQuery, searchYear);
      setEvents(results);
      
      if (results.length === 0) {
        toast({
          title: "No Events Found",
          description: `No events found matching "${searchQuery}" for ${searchYear}.`,
        });
      }
    } catch (error) {
      toast({
        title: "Search Failed",
        description: "Failed to search events. Please check your TBA API key configuration.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const importEventData = async (event: TBAEvent) => {
    setImporting(true);
    try {
      // Import match schedule
      const matches = await tbaApi.processEventMatches(event.key);
      
      if (matches.length === 0) {
        toast({
          title: "No Matches Found",
          description: "This event doesn't have any qualification matches scheduled yet.",
          variant: "destructive"
        });
        return;
      }

      // Get all team numbers from the event
      const teamNumbers = await tbaApi.getAllEventTeamNumbers(event.key);
      
      // Pre-fetch team names for better performance
      if (teamNumbers.length > 0) {
        try {
          await fetchMultipleTeamNames(teamNumbers);
          toast({
            title: "Team Names Updated",
            description: `Fetched names for ${teamNumbers.length} teams from The Blue Alliance.`,
          });
        } catch (error) {
          console.warn('Failed to pre-fetch team names:', error);
        }
      }

      // Import the data (clear existing schedule)
      onImportMatches(matches, true);
      if (onImportTeams) {
        onImportTeams(teamNumbers);
      }

      toast({
        title: "Import Successful",
        description: `Imported ${matches.length} matches from ${event.name}.`,
      });

      // Reset state
      setSelectedEvent(null);
      setEvents([]);
      setSearchQuery('');
      
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import event data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getEventStatus = (event: TBAEvent) => {
    const now = new Date();
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    
    if (now < start) return { status: 'upcoming', color: 'bg-blue-100 text-blue-800' };
    if (now >= start && now <= end) return { status: 'ongoing', color: 'bg-green-100 text-green-800' };
    return { status: 'completed', color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-lg flex items-center space-x-2">
          <Download className="h-5 w-5" />
          <span>Import from The Blue Alliance</span>
        </CardTitle>
        <CardDescription>
          Search for FRC events and automatically import match schedules with team names
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Search Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="eventSearch">Event Name, Code, or Location</Label>
              <Input
                id="eventSearch"
                placeholder="e.g. 'Silicon Valley Regional', '2024casj', 'San Jose'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchEvents()}
              />
            </div>
            <div>
              <Label htmlFor="searchYear">Year</Label>
              <Input
                id="searchYear"
                type="number"
                min="2008"
                max={new Date().getFullYear() + 1}
                value={searchYear}
                onChange={(e) => setSearchYear(parseInt(e.target.value) || new Date().getFullYear())}
              />
            </div>
          </div>

          <Button 
            onClick={searchEvents} 
            disabled={loading || !searchQuery.trim()}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Searching Events...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Search Events
              </>
            )}
          </Button>

          {/* Search Results */}
          {events.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-gray-700">
                Found {events.length} event{events.length !== 1 ? 's' : ''}:
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.map((event) => {
                  const eventStatus = getEventStatus(event);
                  return (
                    <Card 
                      key={event.key} 
                      className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                        selectedEvent?.key === event.key ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h5 className="font-medium text-sm">{event.name}</h5>
                              <Badge className={`text-xs ${eventStatus.color}`}>
                                {eventStatus.status}
                              </Badge>
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-gray-600">
                              <div className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatDate(event.start_date)} - {formatDate(event.end_date)}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <MapPin className="h-3 w-3" />
                                <span>{event.city}, {event.state_prov}</span>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              Event Code: {event.event_code}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Import Button */}
          {selectedEvent && (
            <div className="border-t pt-4">
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <h4 className="font-semibold text-blue-900 mb-2">Selected Event:</h4>
                <p className="text-blue-800 text-sm">{selectedEvent.name}</p>
                <p className="text-blue-600 text-xs">
                  {selectedEvent.city}, {selectedEvent.state_prov} • {formatDate(selectedEvent.start_date)} - {formatDate(selectedEvent.end_date)}
                </p>
                <div className="mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded text-xs text-yellow-800">
                  <strong>Note:</strong> This will replace your current match schedule completely.
                </div>
              </div>
              
              <Button 
                onClick={() => importEventData(selectedEvent)}
                disabled={importing}
                className="w-full"
                size="lg"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing Event Data...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Import Match Schedule & Team Names
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Help Text */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <p className="mb-1">
              <strong>Tip:</strong> This will automatically import the qualification match schedule and fetch real team names from The Blue Alliance.
            </p>
            <p>
              Make sure your TBA API key is configured in your .env file for this feature to work.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EventImport;