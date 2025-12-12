
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAppDoc, setAppDoc } from '@/lib/firebase'
import { Save, RotateCcw, Star } from "lucide-react";

interface SuperScoutData {
  teamNumber: string;
  strategicNotes: string;
  picklistPriority: string;
}

const SuperScoutForm = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<SuperScoutData>({
    teamNumber: "",
    strategicNotes: "",
    picklistPriority: "medium"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.teamNumber || !formData.strategicNotes) {
      toast({
        title: "Missing Information",
        description: "Please fill in team number and strategic notes.",
        variant: "destructive"
      });
      return;
    }
    
    // Save to Firestore as a list of notes per team
    try {
      const existingNotes = (await getAppDoc('superScoutNotes')) || {}
      const teamNotes = existingNotes[formData.teamNumber] || []
      const newNote = {
        strategicNotes: formData.strategicNotes,
        picklistPriority: formData.picklistPriority,
        timestamp: new Date().toISOString(),
        id: Date.now()
      }
      existingNotes[formData.teamNumber] = [...teamNotes, newNote]
      await setAppDoc('superScoutNotes', existingNotes)
    } catch (error) {
      console.warn('Failed to save strategic notes to Firestore:', error)
    }
    
    toast({
      title: "Strategic Notes Saved!",
      description: `Notes for Team ${formData.teamNumber} have been recorded.`,
    });
    
    // Reset form
    setFormData({
      teamNumber: "",
      strategicNotes: "",
      picklistPriority: "medium"
    });
  };

  const handleReset = () => {
    setFormData({
      teamNumber: "",
      strategicNotes: "",
      picklistPriority: "medium"
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Star className="h-6 w-6 text-yellow-600" />
            <span>Super Scout - Strategic Notes</span>
            <Badge variant="outline" className="bg-yellow-50">Strategy Team</Badge>
          </CardTitle>
          <CardDescription>
            Add important strategic notes and picklist priorities for teams during competition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
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
              <Label htmlFor="picklistPriority">Picklist Priority</Label>
              <select
                id="picklistPriority"
                value={formData.picklistPriority}
                onChange={(e) => setFormData({ ...formData, picklistPriority: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="high">High Priority - Must Pick</option>
                <option value="medium">Medium Priority - Good Option</option>
                <option value="low">Low Priority - Last Resort</option>
                <option value="avoid">Avoid - Do Not Pick</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategicNotes">Strategic Notes</Label>
              <Textarea
                id="strategicNotes"
                placeholder="Key observations, strengths, weaknesses, alliance compatibility, reliability concerns, special abilities, etc..."
                value={formData.strategicNotes}
                onChange={(e) => setFormData({ ...formData, strategicNotes: e.target.value })}
                rows={6}
                required
              />
            </div>

            <div className="flex space-x-4">
              <Button type="submit" className="flex-1 bg-yellow-600 hover:bg-yellow-700">
                <Save className="h-4 w-4 mr-2" />
                Save Strategic Notes
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperScoutForm;
