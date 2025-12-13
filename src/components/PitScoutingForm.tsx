
import { useState } from "react";
import { useFormConfiguration } from '@/hooks/useFormConfiguration'
import DynamicFormRenderer from './DynamicFormRenderer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAppDoc, setAppDoc } from '@/lib/firebase'
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
  const config = useFormConfiguration();
  const fields = config?.pitScouting || [];

  const [values, setValues] = useState<Record<string, any>>({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!values.teamNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in team number.",
        variant: "destructive"
      });
      return;
    }
    
    const newEntry: PitScoutData & { id: number; timestamp: string } = {
      ...values as PitScoutData,
      id: Date.now(),
      timestamp: new Date().toISOString()
    };
    try {
      console.log('Saving pit scouting entry:', newEntry);
      const existingData = (await getAppDoc('pitScoutingData')) || []
      console.log('Existing pit data:', existingData);
      const all = [...existingData, newEntry]
      await setAppDoc('pitScoutingData', all)
      console.log('Successfully saved pit scouting data');
    } catch (error) {
      console.error('Failed to save pit scouting data to Firestore:', error)
    }
    
    toast({
      title: "Pit Scouting Data Saved!",
      description: `Pit data for Team ${newEntry.teamNumber} has been recorded.`,
    });
    
    // Reset form
    setValues({
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
    setValues({
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
            <DynamicFormRenderer
              fields={fields}
              values={values}
              onChange={(fieldId, value) => setValues(prev => ({ ...prev, [fieldId]: value }))}
            />

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
