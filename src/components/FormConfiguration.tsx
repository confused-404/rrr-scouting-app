
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Settings, Plus, Trash2, Save } from "lucide-react";

interface FormField {
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
      { id: 'autoPoints', label: 'Auto Points', type: 'number', required: false },
      { id: 'teleopPoints', label: 'Teleop Points', type: 'number', required: false },
      { id: 'notes', label: 'Additional Notes', type: 'textarea', required: false }
    ],
    pitScouting: [
      { id: 'teamNumber', label: 'Team Number', type: 'number', required: true },
      { id: 'robotWeight', label: 'Robot Weight (lbs)', type: 'text', required: false },
      { id: 'drivetrainType', label: 'Drivetrain Type', type: 'select', 
        options: ['Tank Drive', 'Mecanum Drive', 'Swerve Drive', 'West Coast Drive', 'Other'], required: false },
      { id: 'autoCapabilities', label: 'Autonomous Capabilities', type: 'textarea', required: false }
    ]
  });

  useEffect(() => {
    // Load saved configuration from localStorage
    const savedConfig = localStorage.getItem('formConfiguration');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  const saveConfiguration = () => {
    localStorage.setItem('formConfiguration', JSON.stringify(config));
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
            Customize the fields available in scouting forms
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
                        <Input
                          value={field.options?.join(', ') || ''}
                          onChange={(e) => updateField(field.id, { 
                            options: e.target.value.split(',').map(opt => opt.trim()).filter(Boolean)
                          })}
                          placeholder="Option 1, Option 2, Option 3"
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
