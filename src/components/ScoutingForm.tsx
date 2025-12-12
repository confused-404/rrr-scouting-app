
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Plus, Minus, Database } from "lucide-react";
import { addScoutingEntry, addMultipleScoutingEntries, setAppDoc } from '@/lib/firebase'
import { useFormConfiguration } from '@/hooks/useFormConfiguration'
import DynamicFormRenderer from './DynamicFormRenderer'
// FieldPathDrawer disabled due to issues with drawing; placeholder shown instead
// import FieldPathDrawer from "./FieldPathDrawer";

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
  const config = useFormConfiguration();
  const fields = config?.matchScouting || [];

  const [values, setValues] = useState<Record<string, any>>({
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!values.teamNumber || !values.matchNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in team number and match number.",
        variant: "destructive"
      });
      return;
    }
    
    // Build normalized payload so schema changes in form fields don't break saved docs.
    const teamNumber = values.teamNumber ?? values.team ?? values['team_number'] ?? '';
    const matchNumber = values.matchNumber ?? values.match ?? values['match_number'] ?? '';

    if (!teamNumber || !matchNumber) {
      // double-check in case form fields are named differently
      toast({
        title: "Missing Information",
        description: "Team number or match number could not be found in the form values.",
        variant: "destructive",
      });
      return;
    }

    const fieldsOnly: Record<string, any> = { ...values };
    // remove metadata we keep at top-level
    delete fieldsOnly.teamNumber;
    delete fieldsOnly.matchNumber;
    delete fieldsOnly.team;
    delete fieldsOnly.match;
    delete fieldsOnly.team_number;
    delete fieldsOnly.match_number;

    const payload = {
      id: Date.now().toString(),
      teamNumber: String(teamNumber),
      matchNumber: String(matchNumber),
      fields: fieldsOnly,
      formConfigSnapshot: config?.matchScouting ?? null,
      createdAt: new Date().toISOString(),
    };

    try {
      console.log('Saving normalized scouting entry to Firestore:', payload);
      await addScoutingEntry(payload);
      console.log('Successfully saved scouting entry');
    } catch (error) {
      console.error('Failed to save scouting entry to Firestore:', error);
      toast({
        title: 'Save Failed',
        description: 'Unable to save scouting entry. See console for details.',
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: "Data Saved!",
      description: `Scouting data for Team ${payload.teamNumber} in Match ${payload.matchNumber} has been recorded.`,
    });
    
    // Reset form
    setValues({
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
    setValues({
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

  const incrementValue = (field: keyof ScoutingData, max?: number) => {
    setValues(prev => ({
      ...prev,
      [field]: Math.min((prev[field] as number) + 1, max || 100)
    }));
  };

  const decrementValue = (field: keyof ScoutingData, min: number = 0) => {
    setValues(prev => ({
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
            </div>
          </CardTitle>
          <CardDescription>
            Record robot performance data during competition matches
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
