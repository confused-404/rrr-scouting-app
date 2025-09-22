
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Plus, Minus, Database } from "lucide-react";
import FieldPathDrawer from "./FieldPathDrawer";

interface Point {
  x: number;
  y: number;
}

interface ScoutingData {
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
  autoPath: Point[];
}

const ScoutingForm = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ScoutingData>({
    teamNumber: "",
    matchNumber: "",
    alliance: "red",
    autoGamePieces: 0,
    autoMobility: "no",
    teleopGamePieces: 0,
    climbing: "none",
    defense: 5,
    reliability: 5,
    comments: "",
    autoPath: []
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.teamNumber || !formData.matchNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in team number and match number.",
        variant: "destructive"
      });
      return;
    }
    
    // Save to localStorage
    const existingData = JSON.parse(localStorage.getItem("scoutingData") || "[]");
    const newEntry = {
      ...formData,
      id: Date.now(),
      timestamp: new Date().toISOString()
    };
    
    existingData.push(newEntry);
    localStorage.setItem("scoutingData", JSON.stringify(existingData));
    
    toast({
      title: "Data Saved!",
      description: `Scouting data for Team ${formData.teamNumber} in Match ${formData.matchNumber} has been recorded.`,
    });
    
    // Reset form
    setFormData({
      teamNumber: "",
      matchNumber: "",
      alliance: "red",
      autoGamePieces: 0,
      autoMobility: "no",
      teleopGamePieces: 0,
      climbing: "none",
      defense: 5,
      reliability: 5,
      comments: "",
      autoPath: []
    });
  };

  const handleReset = () => {
    setFormData({
      teamNumber: "",
      matchNumber: "",
      alliance: "red",
      autoGamePieces: 0,
      autoMobility: "no",
      teleopGamePieces: 0,
      climbing: "none",
      defense: 5,
      reliability: 5,
      comments: "",
      autoPath: []
    });
  };

  const generateDummyData = () => {
    const teams = ['1114', '254', '118', '148', '1678', '2056', '973', '1323', '5940', '6328', '7492', '8033', '9999', '1234', '5678'];
    const alliances = ['red', 'blue'];
    const climbOptions = ['none', 'attempted', 'success'];
    const mobilityOptions = ['yes', 'no'];
    
    const dummyEntries = [];
    
    for (let i = 0; i < 45; i++) {
      const team = teams[Math.floor(Math.random() * teams.length)];
      const match = (i % 15 + 1).toString();
      const alliance = alliances[Math.floor(Math.random() * alliances.length)];
      
      // Generate realistic auto path
      const pathLength = Math.floor(Math.random() * 5) + 2; // 2-6 points
      const autoPath = [];
      for (let j = 0; j < pathLength; j++) {
        autoPath.push({
          x: Math.random() * 648,
          y: Math.random() * 324
        });
      }
      
      dummyEntries.push({
        id: Date.now() + i,
        teamNumber: team,
        matchNumber: match,
        alliance: alliance,
        autoGamePieces: Math.floor(Math.random() * 6),
        autoMobility: mobilityOptions[Math.floor(Math.random() * mobilityOptions.length)],
        teleopGamePieces: Math.floor(Math.random() * 15) + 5,
        climbing: climbOptions[Math.floor(Math.random() * climbOptions.length)],
        defense: Math.floor(Math.random() * 6) + 5,
        reliability: Math.floor(Math.random() * 4) + 7,
        comments: [
          "Great driver, very consistent",
          "Strong defense capabilities",
          "Fast autonomous routine",
          "Reliable climber",
          "Good alliance partner",
          "Aggressive but controlled",
          "Excellent game piece manipulation",
          "Needs improvement on reliability"
        ][Math.floor(Math.random() * 8)],
        autoPath: autoPath,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString()
      });
    }
    
    // Also add some strategic notes
    const strategicNotes = {
      '1114': {
        strategicNotes: 'Excellent autonomous, very reliable, great for first pick',
        picklistPriority: 'high',
        timestamp: new Date().toISOString(),
        id: Date.now()
      },
      '254': {
        strategicNotes: 'Aggressive but sometimes unreliable, good defense',
        picklistPriority: 'medium',
        timestamp: new Date().toISOString(),
        id: Date.now() + 1
      },
      '118': {
        strategicNotes: 'Solid all-around robot, works well in any alliance',
        picklistPriority: 'high',
        timestamp: new Date().toISOString(),
        id: Date.now() + 2
      },
      '973': {
        strategicNotes: 'Unreliable autonomous, avoid for critical matches',
        picklistPriority: 'avoid',
        timestamp: new Date().toISOString(),
        id: Date.now() + 3
      }
    };
    
    const existingData = JSON.parse(localStorage.getItem("scoutingData") || "[]");
    const allData = [...existingData, ...dummyEntries];
    localStorage.setItem("scoutingData", JSON.stringify(allData));
    localStorage.setItem("superScoutNotes", JSON.stringify(strategicNotes));
    
    toast({
      title: "Dummy Data Generated!",
      description: `Added ${dummyEntries.length} scouting entries and strategic notes.`,
    });
  };

  const incrementValue = (field: keyof ScoutingData, max?: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: Math.min((prev[field] as number) + 1, max || 100)
    }));
  };

  const decrementValue = (field: keyof ScoutingData, min: number = 0) => {
    setFormData(prev => ({
      ...prev,
      [field]: Math.max((prev[field] as number) - 1, min)
    }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-lg sm:text-xl">Match Scouting Form</span>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-xs">Quick Entry</Badge>
              <Button onClick={generateDummyData} variant="outline" size="sm" className="w-full sm:w-auto text-xs">
                <Database className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                Add Demo Data
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Record robot performance data during competition matches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teamNumber">Team Number</Label>
                <Input
                  id="teamNumber"
                  type="number"
                  placeholder="1234"
                  value={formData.teamNumber}
                  onChange={(e) => setFormData({ ...formData, teamNumber: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="matchNumber">Match Number</Label>
                <Input
                  id="matchNumber"
                  type="number"
                  placeholder="15"
                  value={formData.matchNumber}
                  onChange={(e) => setFormData({ ...formData, matchNumber: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alliance">Alliance Color</Label>
                <select
                  id="alliance"
                  value={formData.alliance}
                  onChange={(e) => setFormData({ ...formData, alliance: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="red">Red Alliance</option>
                  <option value="blue">Blue Alliance</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-blue-600">Autonomous Period</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="autoGamePieces">Game Pieces Scored</Label>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => decrementValue('autoGamePieces')}
                        disabled={formData.autoGamePieces <= 0}
                        className="h-8 w-8 sm:h-10 sm:w-10 p-0 flex-shrink-0"
                      >
                        <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <Input
                        id="autoGamePieces"
                        type="number"
                        min="0"
                        max="10"
                        value={formData.autoGamePieces}
                        onChange={(e) => setFormData({ ...formData, autoGamePieces: parseInt(e.target.value) || 0 })}
                        className="text-center flex-1 min-w-0"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => incrementValue('autoGamePieces', 10)}
                        disabled={formData.autoGamePieces >= 10}
                        className="h-8 w-8 sm:h-10 sm:w-10 p-0 flex-shrink-0"
                      >
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="autoMobility">Mobility</Label>
                    <select
                      id="autoMobility"
                      value={formData.autoMobility}
                      onChange={(e) => setFormData({ ...formData, autoMobility: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="yes">Yes - Left Community</option>
                      <option value="no">No - Stayed in Community</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-green-600">Teleoperated Period</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="teleopGamePieces">Game Pieces Scored</Label>
                    <div className="flex items-center space-x-1 sm:space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => decrementValue('teleopGamePieces')}
                        disabled={formData.teleopGamePieces <= 0}
                        className="h-8 w-8 sm:h-10 sm:w-10 p-0 flex-shrink-0"
                      >
                        <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <Input
                        id="teleopGamePieces"
                        type="number"
                        min="0"
                        max="50"
                        value={formData.teleopGamePieces}
                        onChange={(e) => setFormData({ ...formData, teleopGamePieces: parseInt(e.target.value) || 0 })}
                        className="text-center flex-1 min-w-0"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => incrementValue('teleopGamePieces', 50)}
                        disabled={formData.teleopGamePieces >= 50}
                        className="h-8 w-8 sm:h-10 sm:w-10 p-0 flex-shrink-0"
                      >
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="climbing">Climbing Attempt</Label>
                    <select
                      id="climbing"
                      value={formData.climbing}
                      onChange={(e) => setFormData({ ...formData, climbing: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="none">No Attempt</option>
                      <option value="attempted">Attempted - Failed</option>
                      <option value="success">Successful Climb</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-purple-600">Performance Ratings</h3>
                  
                  <div className="space-y-3">
                    <Label htmlFor="defense">Defense Rating: {formData.defense}/10</Label>
                    <div className="px-2">
                      <input
                        type="range"
                        id="defense"
                        min="1"
                        max="10"
                        value={formData.defense}
                        onChange={(e) => setFormData({ ...formData, defense: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Poor</span>
                        <span>Average</span>
                        <span>Excellent</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2 justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => decrementValue('defense', 1)}
                        disabled={formData.defense <= 1}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={formData.defense}
                        onChange={(e) => setFormData({ ...formData, defense: parseInt(e.target.value) || 1 })}
                        className="text-center w-12 sm:w-16 h-7 sm:h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => incrementValue('defense', 10)}
                        disabled={formData.defense >= 10}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="reliability">Reliability Rating: {formData.reliability}/10</Label>
                    <div className="px-2">
                      <input
                        type="range"
                        id="reliability"
                        min="1"
                        max="10"
                        value={formData.reliability}
                        onChange={(e) => setFormData({ ...formData, reliability: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Unreliable</span>
                        <span>Consistent</span>
                        <span>Very Reliable</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 sm:space-x-2 justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => decrementValue('reliability', 1)}
                        disabled={formData.reliability <= 1}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={formData.reliability}
                        onChange={(e) => setFormData({ ...formData, reliability: parseInt(e.target.value) || 1 })}
                        className="text-center w-12 sm:w-16 h-7 sm:h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => incrementValue('reliability', 10)}
                        disabled={formData.reliability >= 10}
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="comments">Additional Comments</Label>
                  <Textarea
                    id="comments"
                    placeholder="Any additional observations about the robot's performance..."
                    value={formData.comments}
                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <div>
                <FieldPathDrawer
                  onPathChange={(path) => setFormData({ ...formData, autoPath: path })}
                  initialPath={formData.autoPath}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Scouting Data
              </Button>
              <Button type="button" variant="outline" onClick={handleReset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Form
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScoutingForm;
