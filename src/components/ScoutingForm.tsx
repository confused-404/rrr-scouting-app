
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Plus, Minus } from "lucide-react";

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
}

const ScoutingForm = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<ScoutingData>({
    teamNumber: "",
    matchNumber: "",
    alliance: "",
    autoGamePieces: 0,
    autoMobility: "",
    teleopGamePieces: 0,
    climbing: "",
    defense: 5,
    reliability: 5,
    comments: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save to localStorage for demo purposes
    const existingData = JSON.parse(localStorage.getItem("scoutingData") || "[]");
    const newData = { ...formData, id: Date.now(), timestamp: new Date().toISOString() };
    existingData.push(newData);
    localStorage.setItem("scoutingData", JSON.stringify(existingData));
    
    toast({
      title: "Scouting Data Saved!",
      description: `Team ${formData.teamNumber} - Match ${formData.matchNumber} recorded successfully.`,
    });
    
    // Reset form for next entry
    setFormData({
      teamNumber: "",
      matchNumber: "",
      alliance: "",
      autoGamePieces: 0,
      autoMobility: "",
      teleopGamePieces: 0,
      climbing: "",
      defense: 5,
      reliability: 5,
      comments: ""
    });
  };

  const handleReset = () => {
    setFormData({
      teamNumber: "",
      matchNumber: "",
      alliance: "",
      autoGamePieces: 0,
      autoMobility: "",
      teleopGamePieces: 0,
      climbing: "",
      defense: 5,
      reliability: 5,
      comments: ""
    });
  };

  const incrementValue = (field: keyof ScoutingData, max?: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: max ? Math.min(prev[field] as number + 1, max) : (prev[field] as number) + 1
    }));
  };

  const decrementValue = (field: keyof ScoutingData, min: number = 0) => {
    setFormData(prev => ({
      ...prev,
      [field]: Math.max((prev[field] as number) - 1, min)
    }));
  };

  const NumberInputWithButtons = ({ 
    id, 
    label, 
    value, 
    field, 
    min = 0, 
    max 
  }: { 
    id: string; 
    label: string; 
    value: number; 
    field: keyof ScoutingData; 
    min?: number; 
    max?: number; 
  }) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => decrementValue(field, min)}
          disabled={value <= min}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => setFormData({ ...formData, [field]: parseInt(e.target.value) || min })}
          className="text-center"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => incrementValue(field, max)}
          disabled={max ? value >= max : false}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>Robot Scouting Form</span>
            <Badge variant="outline">Quick Entry</Badge>
          </CardTitle>
          <CardDescription>
            Fill out this form during each match to collect robot performance data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Match Info */}
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
                <Select value={formData.alliance} onValueChange={(value) => setFormData({ ...formData, alliance: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select alliance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Red Alliance</SelectItem>
                    <SelectItem value="blue">Blue Alliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Autonomous Period */}
            <Card className="bg-blue-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-blue-700">Autonomous Period</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NumberInputWithButtons
                    id="autoGamePieces"
                    label="Game Pieces Scored"
                    value={formData.autoGamePieces}
                    field="autoGamePieces"
                  />
                  <div className="space-y-2">
                    <Label htmlFor="autoMobility">Mobility</Label>
                    <Select value={formData.autoMobility} onValueChange={(value) => setFormData({ ...formData, autoMobility: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mobility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes - Left Community</SelectItem>
                        <SelectItem value="no">No - Stayed in Community</SelectItem>
                        <SelectItem value="attempted">Attempted but Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Teleoperated Period */}
            <Card className="bg-green-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-700">Teleoperated Period</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NumberInputWithButtons
                    id="teleopGamePieces"
                    label="Game Pieces Scored"
                    value={formData.teleopGamePieces}
                    field="teleopGamePieces"
                  />
                  <div className="space-y-2">
                    <Label htmlFor="climbing">Climbing Performance</Label>
                    <Select value={formData.climbing} onValueChange={(value) => setFormData({ ...formData, climbing: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select climbing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Attempt</SelectItem>
                        <SelectItem value="attempted">Attempted but Failed</SelectItem>
                        <SelectItem value="partial">Partial Climb</SelectItem>
                        <SelectItem value="success">Successful Climb</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Ratings */}
            <Card className="bg-purple-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-purple-700">Performance Ratings</CardTitle>
                <CardDescription>Rate from 1 (poor) to 10 (excellent)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NumberInputWithButtons
                    id="defense"
                    label="Defense Rating (1-10)"
                    value={formData.defense}
                    field="defense"
                    min={1}
                    max={10}
                  />
                  <NumberInputWithButtons
                    id="reliability"
                    label="Reliability Rating (1-10)"
                    value={formData.reliability}
                    field="reliability"
                    min={1}
                    max={10}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Comments */}
            <div className="space-y-2">
              <Label htmlFor="comments">Additional Comments</Label>
              <Textarea
                id="comments"
                placeholder="Any notable observations, breakdowns, or special abilities..."
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                <Save className="h-4 w-4 mr-2" />
                Save & Next Robot
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
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
