
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, UserCheck } from "lucide-react";

interface RoleSelectorProps {
  onRoleSelect: (role: 'admin' | 'scouter') => void;
}

const RoleSelector = ({ onRoleSelect }: RoleSelectorProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <UserCheck className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-foreground">Select Your Role</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose your role to access the appropriate scouting features
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onRoleSelect('admin')}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Shield className="h-16 w-16 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Admin</CardTitle>
              <CardDescription className="text-lg">
                Full access to all features including data analysis and strategic notes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                <Badge className="bg-green-600">✓ Match Scouting</Badge>
                <Badge className="bg-green-600">✓ Pit Scouting</Badge>
                <Badge className="bg-green-600">✓ Strategic Notes</Badge>
                <Badge className="bg-green-600">✓ Data Analysis</Badge>
                <Badge className="bg-green-600">✓ Export Data</Badge>
              </div>
              <Button className="w-full bg-red-600 hover:bg-red-700" size="lg">
                Continue as Admin
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onRoleSelect('scouter')}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Users className="h-16 w-16 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Scouter</CardTitle>
              <CardDescription className="text-lg">
                Access to scouting forms for data collection during matches and in pits
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                <Badge className="bg-green-600">✓ Match Scouting</Badge>
                <Badge className="bg-green-600">✓ Pit Scouting</Badge>
                <Badge variant="outline">✗ Strategic Notes</Badge>
                <Badge variant="outline">✗ Data Analysis</Badge>
                <Badge variant="outline">✗ Export Data</Badge>
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                Continue as Scouter
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RoleSelector;
