
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAppDoc, setAppDoc } from '@/lib/firebase'
import { Settings, Plus, Trash2, Save } from "lucide-react";

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select';
  options?: string[];
  required: boolean;
}

interface FormConfiguration {
  matchScouting: FormField[];
  pitScouting: FormField[];
}

const FormConfiguration = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'match' | 'pit'>('match');
  const [config, setConfig] = useState<FormConfiguration>({
    matchScouting: [
      { id: 'teamNumber', label: 'Team Number', type: 'number', required: true },
      { id: 'matchNumber', label: 'Match Number', type: 'number', required: true },
      { id: 'alliance', label: 'Alliance', type: 'select', options: ['red', 'blue'], required: true },
      { id: 'autoGamePieces', label: 'Auto Game Pieces', type: 'number', required: false },
      { id: 'autoMobility', label: 'Auto Mobility', type: 'select', options: ['yes', 'no'], required: false },
      { id: 'teleopGamePieces', label: 'Teleop Game Pieces', type: 'number', required: false },
      { id: 'climbing', label: 'Climbing', type: 'select', options: ['success', 'fail', 'not attempted'], required: false },
      { id: 'defense', label: 'Defense Rating (1-10)', type: 'number', required: false },
      { id: 'reliability', label: 'Reliability Rating (1-10)', type: 'number', required: false },
      { id: 'comments', label: 'Additional Comments', type: 'textarea', required: false }
    ],
    pitScouting: [
      { id: 'teamNumber', label: 'Team Number', type: 'number', required: true },
      { id: 'robotWeight', label: 'Robot Weight (lbs)', type: 'text', required: false },
      { id: 'drivetrainType', label: 'Drivetrain Type', type: 'select', 
        options: ['Tank Drive', 'Mecanum Drive', 'Swerve Drive', 'West Coast Drive', 'Other'], required: false },
      { id: 'autoCapabilities', label: 'Autonomous Capabilities', type: 'textarea', required: false },
      { id: 'teamExperience', label: 'Team Experience Level', type: 'select', 
        options: ['Rookie', 'Sophomore', 'Veteran', 'Elite'], required: false }
    ]
  });
  // Local edited text for select options to avoid parsing while the user types commas
  const [optionInputs, setOptionInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const savedConfig = await getAppDoc('formConfiguration')
      if (savedConfig) setConfig(savedConfig)
    }
    load()
  }, []);

  // Keep a simple mapping of fieldId -> raw option string for editing comfort
  useEffect(() => {
    const map: Record<string, string> = {}
    Object.values({ ...config.matchScouting, ...config.pitScouting }).forEach((f: any) => {
      if (f?.type === 'select') {
        map[f.id] = Array.isArray(f.options) ? f.options.join(', ') : (f.options || '').toString()
      }
    })
    setOptionInputs(map)
  }, [config.matchScouting, config.pitScouting])

  const saveConfiguration = () => {
    setAppDoc('formConfiguration', config).catch(e => console.warn('Failed to save form config:', e))
    toast({
      title: "Configuration Saved",
      description: "Form configuration has been updated successfully.",
    });
  };

  const addField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false
    };

    setConfig(prev => ({
      ...prev,
      [activeTab === 'match' ? 'matchScouting' : 'pitScouting']: [
        ...prev[activeTab === 'match' ? 'matchScouting' : 'pitScouting'],
        newField
      ]
    }));
  };

  const updateFieldId = (oldId: string, newId: string) => {
    if (!newId || oldId === newId) return
    setConfig(prev => ({
      ...prev,
      matchScouting: prev.matchScouting.map(f => f.id === oldId ? { ...f, id: newId } : f),
      pitScouting: prev.pitScouting.map(f => f.id === oldId ? { ...f, id: newId } : f),
    }))

    setOptionInputs(prev => {
      const copy = { ...prev }
      if (copy[oldId] !== undefined) {
        copy[newId] = copy[oldId]
        delete copy[oldId]
      }
      return copy
    })
  }

  const removeField = (fieldId: string) => {
    setConfig(prev => ({
      ...prev,
      [activeTab === 'match' ? 'matchScouting' : 'pitScouting']: 
        prev[activeTab === 'match' ? 'matchScouting' : 'pitScouting'].filter(field => field.id !== fieldId)
    }));
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setConfig(prev => ({
      ...prev,
      [activeTab === 'match' ? 'matchScouting' : 'pitScouting']: 
        prev[activeTab === 'match' ? 'matchScouting' : 'pitScouting'].map(field => 
          field.id === fieldId ? { ...field, ...updates } : field
        )
    }));
  };

  const currentFields = config[activeTab === 'match' ? 'matchScouting' : 'pitScouting'];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-6 w-6 text-blue-600" />
            <span>Form Configuration</span>
          </CardTitle>
          <CardDescription>
            Customize the fields available in scouting forms. Changes will apply to new form submissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex space-x-2">
              <Button
                variant={activeTab === 'match' ? 'default' : 'outline'}
                onClick={() => setActiveTab('match')}
              >
                Match Scouting
              </Button>
              <Button
                variant={activeTab === 'pit' ? 'default' : 'outline'}
                onClick={() => setActiveTab('pit')}
              >
                Pit Scouting
              </Button>
            </div>

            <div className="space-y-4">
              {currentFields.map((field, index) => (
                <Card key={field.id} className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-2">
                      <Label>Field Label</Label>
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Field ID</Label>
                      <Input
                        value={field.id}
                        onChange={(e) => updateFieldId(field.id, e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Changing the ID will affect stored data keys. Use unique alphanumeric IDs.</p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Field Type</Label>
                      <select
                        value={field.type}
                        onChange={(e) => updateField(field.id, { type: e.target.value as FormField['type'] })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="textarea">Textarea</option>
                        <option value="select">Select</option>
                      </select>
                    </div>

                    {field.type === 'select' && (
                      <div className="space-y-2">
                        <Label>Options (comma-separated)</Label>
                        <Textarea
                          value={optionInputs[field.id] ?? field.options?.join(', ') ?? ''}
                          onChange={(e) => setOptionInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                          onBlur={(e) => updateField(field.id, {
                            options: e.target.value.split(',').map(opt => opt.trim()).filter(Boolean)
                          })}
                          placeholder="Option 1, Option 2, Option 3"
                          rows={2}
                        />
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                        />
                        <span className="text-sm">Required</span>
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeField(field.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div className="flex space-x-4">
              <Button onClick={addField} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
              <Button onClick={saveConfiguration} className="bg-green-600 hover:bg-green-700">
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FormConfiguration;
