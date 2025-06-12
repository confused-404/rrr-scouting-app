
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, BarChart3, Trophy, Target } from "lucide-react";
import ScoutingForm from "@/components/ScoutingForm";
import AdminDashboard from "@/components/AdminDashboard";

const Index = () => {
  const [currentView, setCurrentView] = useState<"home" | "scout" | "admin">("home");

  if (currentView === "scout") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Target className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-foreground">FRC Scout</h1>
            </div>
            <Button variant="outline" onClick={() => setCurrentView("home")}>
              Back to Home
            </Button>
          </div>
          <ScoutingForm />
        </div>
      </div>
    );
  }

  if (currentView === "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-8 w-8 text-red-600" />
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
            </div>
            <Button variant="outline" onClick={() => setCurrentView("home")}>
              Back to Home
            </Button>
          </div>
          <AdminDashboard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <Trophy className="h-12 w-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-foreground">FRC Strategy Hub</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Scout robots, analyze performance, and build winning alliance strategies for FIRST Robotics Competition
          </p>
          <Badge variant="secondary" className="mt-4">
            2024 Season Ready
          </Badge>
        </div>

        {/* Main Action Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCurrentView("scout")}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Users className="h-16 w-16 text-blue-600" />
              </div>
              <CardTitle className="text-2xl">Robot Scouting</CardTitle>
              <CardDescription className="text-lg">
                Quick and easy form to scout robots during matches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                Start Scouting
              </Button>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>• Auto scoring</span>
                  <span>• Teleop performance</span>
                </div>
                <div className="flex justify-between">
                  <span>• Climbing ability</span>
                  <span>• Defense rating</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCurrentView("admin")}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <BarChart3 className="h-16 w-16 text-red-600" />
              </div>
              <CardTitle className="text-2xl">Data Analysis</CardTitle>
              <CardDescription className="text-lg">
                Analyze scouting data and generate alliance picklists
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-red-600 hover:bg-red-700" size="lg">
                View Dashboard
              </Button>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>• Performance charts</span>
                  <span>• Team rankings</span>
                </div>
                <div className="flex justify-between">
                  <span>• Alliance predictor</span>
                  <span>• Export reports</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
