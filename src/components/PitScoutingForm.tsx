
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Wrench } from "lucide-react";

interface PitScoutData {
  teamNumber: string;
  robotWeight: string;
  drivetrainType: string;
  autoCapabilities: string;
  teleopCapabilities: string;
  climbingMechanism: string;
  robotHeight: string;
  programmingLanguage: string;
  specialFeatures: string;
  concerns: string;
  overallRating: number;
}

const PitScoutingForm = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<PitScoutData>({
    teamNumber: "",
    robotWeight: "",
    drivetrainType: "",
    autoCapabilities: "",
    teleopCapabilities: "",
    climbingMechanism: "",
    robotHeight: "",
    programmingLanguage: "",
    specialFeatures: "",
    concerns: "",
    overallRating: 5
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.teamNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in team number.",
        variant: "destructive"
      });
      return;
    }
    
    // Save to localStorage
    const existingData = JSON.parse(localStorage.getItem("pitScoutingData") || "[]");
    const newEntry = {
      ...formData,
      id: Date.now(),
      timestamp: new Date().toISOString()
    };
    
    existingData.push(newEntry);
    localStorage.setItem("pitScoutingData", JSON.stringify(existingData));
    
    toast({
      title: "Pit Scouting Data Saved!",
      description: `Pit data for Team ${formData.teamNumber} has been recorded.`,
    });
    
    // Reset form
    setFormData({
      teamNumber: "",
      robotWeight: "",
      drivetrainType: "",
      autoCapabilities: "",
      teleopCapabilities: "",
      climbingMechanism: "",
      robotHeight: "",
      programmingLanguage: "",
      specialFeatures: "",
      concerns: "",
      overallRating: 5
    });
  };

  const handleReset = () => {
    setFormData({
      teamNumber: "",
      robotWeight: "",
      drivetrainType: "",
      autoCapabilities: "",
      teleopCapabilities: "",
      climbingMechanism: "",
      robotHeight: "",
      programmingLanguage: "",
      specialFeatures: "",
      concerns: "",
      overallRating: 5
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wrench className="h-6 w-6 text-orange-600" />
            <span>Pit Scouting Form</span>
            <Badge variant="outline" className="bg-orange-50">Pre-Match</Badge>
          </CardTitle>
          <CardDescription>
            Collect detailed robot information in the pit area before competition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="robotWeight">Robot Weight (lbs)</Label>
                <Input
                  id="robotWeight"
                  placeholder="120"
                  value={formData.robotWeight}
                  onChange={(e) => setFormData({ ...formData, robotWeight: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="drivetrainType">Drivetrain Type</Label>
                <select
                  id="drivetrainType"
                  value={formData.drivetrainType}
                  onChange={(e) => setFormData({ ...formData, drivetrainType: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select drivetrain</option>
                  <option value="tank">Tank Drive</option>
                  <option value="mecanum">Mecanum Drive</option>
                  <option value="swerve">Swerve Drive</option>
                  <option value="west_coast">West Coast Drive</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="robotHeight">Robot Height (inches)</Label>
                <Input
                  id="robotHeight"
                  placeholder="30"
                  value={formData.robotHeight}
                  onChange={(e) => setFormData({ ...formData, robotHeight: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="programmingLanguage">Programming Language</Label>
                <select
                  id="programmingLanguage"
                  value={formData.programmingLanguage}
                  onChange={(e) => setFormData({ ...formData, programmingLanguage: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select language</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="python">Python</option>
                  <option value="labview">LabVIEW</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="overallRating">Overall Rating (1-10)</Label>
                <Input
                  id="overallRating"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.overallRating}
                  onChange={(e) => setFormData({ ...formData, overallRating: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="autoCapabilities">Autonomous Capabilities</Label>
                <Textarea
                  id="autoCapabilities"
                  placeholder="Describe what the robot can do during autonomous period..."
                  value={formData.autoCapabilities}
                  onChange={(e) => setFormData({ ...formData, autoCapabilities: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="teleopCapabilities">Teleoperated Capabilities</Label>
                <Textarea
                  id="teleopCapabilities"
                  placeholder="Describe what the robot can do during teleoperated period..."
                  value={formData.teleopCapabilities}
                  onChange={(e) => setFormData({ ...formData, teleopCapabilities: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="climbingMechanism">Climbing Mechanism</Label>
                <Textarea
                  id="climbingMechanism"
                  placeholder="Describe the climbing mechanism and capabilities..."
                  value={formData.climbingMechanism}
                  onChange={(e) => setFormData({ ...formData, climbingMechanism: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialFeatures">Special Features</Label>
                <Textarea
                  id="specialFeatures"
                  placeholder="Any unique or special features of the robot..."
                  value={formData.specialFeatures}
                  onChange={(e) => setFormData({ ...formData, specialFeatures: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="concerns">Concerns/Weaknesses</Label>
                <Textarea
                  id="concerns"
                  placeholder="Any concerns, weaknesses, or potential issues observed..."
                  value={formData.concerns}
                  onChange={(e) => setFormData({ ...formData, concerns: e.target.value })}
                  rows={2}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button type="submit" className="flex-1 bg-orange-600 hover:bg-orange-700 w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Pit Scouting Data
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

export default PitScoutingForm;
