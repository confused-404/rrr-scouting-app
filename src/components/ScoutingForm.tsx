
import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Plus, Minus, Database } from "lucide-react";
import { addScoutingEntry } from '@/lib/firebase'
import { useFormConfiguration } from '@/hooks/useFormConfiguration'
import DynamicFormRenderer from './DynamicFormRenderer'
// FieldPathDrawer disabled due to issues with drawing; placeholder shown instead
// import FieldPathDrawer from "./FieldPathDrawer";

const ScoutingForm = () => {
  const { toast } = useToast();
  const config = useFormConfiguration();
  const fields = config?.matchScouting || [];

  const initializedRef = useRef(false);

  useEffect(() => {
    // Initialize dynamic form values from the configured fields only once
    if (initializedRef.current) return;
    if (!fields || fields.length === 0) return;

    const initial: Record<string, any> = {};
    fields.forEach((f) => {
      if (f.id === 'teamNumber' || f.id === 'matchNumber' || f.id === 'alliance') return;
      switch (f.type) {
        case 'number':
          initial[f.id] = 0;
          break;
        case 'select':
          initial[f.id] = f.options?.[0] ?? '';
          break;
        default:
          initial[f.id] = '';
      }
    });
    setValues(prev => {
      const merged = { ...prev } as Record<string, any>;
      Object.keys(initial).forEach(k => { if (!(k in merged)) merged[k] = initial[k] });
      return merged;
    });
    initializedRef.current = true;
  }, [fields]);

  const [values, setValues] = useState<Record<string, any>>({
    teamNumber: "",
    matchNumber: "",
    alliance: "red",
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

    // Only persist fields that exist in the current form configuration.
    // This prevents legacy/hardcoded keys from being saved into `fields`.
    const configuredIds = new Set((config?.matchScouting ?? []).map((f: any) => f.id));
    const filteredFields: Record<string, any> = {};
    const unknownKeys: string[] = [];
    Object.entries(fieldsOnly).forEach(([k, v]) => {
      if (configuredIds.has(k)) filteredFields[k] = v;
      else unknownKeys.push(k);
    });
    if (unknownKeys.length > 0) {
      console.warn('ScoutingForm: dropping unknown fields before save:', unknownKeys);
    }

    // Sanitize the saved form config snapshot to avoid saving obviously invalid
    // entries (for example, stray timestamp-like objects accidentally inserted
    // into the app config).
    const snapshot = config?.matchScouting ?? null;
    const sanitizedSnapshot = snapshot
      ? (snapshot as any[]).filter((f: any) => {
          // keep entries that have a non-empty string id that is not just a long
          // numeric timestamp
          if (!f || typeof f.id !== 'string' || f.id.trim() === '') return false;
          if (/^\d{10,}$/.test(f.id)) return false;
          return true;
        })
      : null;

    if (snapshot && sanitizedSnapshot && sanitizedSnapshot.length !== snapshot.length) {
      console.warn('ScoutingForm: sanitized formConfigSnapshot before save; some items removed');
      toast({ title: 'Configuration Snapshot Sanitized', description: 'Some invalid fields were removed from the saved snapshot.' });
    }

    const payload = {
      id: Date.now().toString(),
      teamNumber: String(teamNumber),
      matchNumber: String(matchNumber),
      fields: filteredFields,
      formConfigSnapshot: sanitizedSnapshot,
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
    
    // Reset form to only the top-level metadata. Dynamic fields are populated
    // from `config.matchScouting` via the initialization effect / renderer.
    setValues({ teamNumber: "", matchNumber: "", alliance: "red" });
  };

  const handleReset = () => {
    // Reset only top-level metadata. Dynamic fields will be controlled by the
    // `DynamicFormRenderer` and populated from `config.matchScouting`.
    setValues({ teamNumber: "", matchNumber: "", alliance: "red" });
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
