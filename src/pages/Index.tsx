
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, BarChart3, Trophy, Target, Star, Wrench, Settings, LogOut } from "lucide-react";
import ScoutingForm from "@/components/ScoutingForm";
import AdminDashboard from "@/components/AdminDashboard";
import SuperScoutForm from "@/components/SuperScoutForm";
import PitScoutingForm from "@/components/PitScoutingForm";
import RoleSelector from "@/components/RoleSelector";

type UserRole = 'admin' | 'scouter' | null;
type ViewType = "home" | "match-scout" | "pit-scout" | "admin" | "superscout";

const Index = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>(null);
  const [currentView, setCurrentView] = useState<ViewType>("home");

  const handleRoleSelect = (role: UserRole) => {
    setCurrentRole(role);
    setCurrentView("home");
  };

  const handleLogout = () => {
    setCurrentRole(null);
    setCurrentView("home");
  };

  if (!currentRole) {
    return <RoleSelector onRoleSelect={handleRoleSelect} />;
  }

  if (currentView === "match-scout") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Target className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-foreground">Match Scouting</h1>
              <Badge className="bg-blue-600">{currentRole}</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => setCurrentView("home")}>
                Back to Home
              </Button>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          <ScoutingForm />
        </div>
      </div>
    );
  }

  if (currentView === "pit-scout") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Wrench className="h-8 w-8 text-orange-600" />
              <h1 className="text-2xl font-bold text-foreground">Pit Scouting</h1>
              <Badge className="bg-orange-600">{currentRole}</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => setCurrentView("home")}>
                Back to Home
              </Button>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          <PitScoutingForm />
        </div>
      </div>
    );
  }

  if (currentView === "admin" && currentRole === "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-8 w-8 text-red-600" />
              <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
              <Badge className="bg-red-600">Admin</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => setCurrentView("home")}>
                Back to Home
              </Button>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          <AdminDashboard />
        </div>
      </div>
    );
  }

  if (currentView === "superscout" && currentRole === "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Star className="h-8 w-8 text-yellow-600" />
              <h1 className="text-2xl font-bold text-foreground">Super Scout</h1>
              <Badge className="bg-yellow-600">Admin</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => setCurrentView("home")}>
                Back to Home
              </Button>
              <Button variant="ghost" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
          <SuperScoutForm />
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
          <div className="flex items-center justify-center space-x-2 mt-4">
            <Badge variant="secondary">2024 Season Ready</Badge>
            <Badge className={currentRole === 'admin' ? 'bg-red-600' : 'bg-blue-600'}>
              {currentRole === 'admin' ? 'Admin Access' : 'Scouter Access'}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Switch Role
            </Button>
          </div>
        </div>

        {/* Main Action Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCurrentView("match-scout")}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Users className="h-12 w-12 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Match Scouting</CardTitle>
              <CardDescription>
                Quick form to scout robots during matches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                Start Match Scouting
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCurrentView("pit-scout")}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Wrench className="h-12 w-12 text-orange-600" />
              </div>
              <CardTitle className="text-xl">Pit Scouting</CardTitle>
              <CardDescription>
                Detailed robot analysis in the pit area
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-orange-600 hover:bg-orange-700" size="lg">
                Start Pit Scouting
              </Button>
            </CardContent>
          </Card>

          {currentRole === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCurrentView("superscout")}>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <Star className="h-12 w-12 text-yellow-600" />
                </div>
                <CardTitle className="text-xl">Super Scout</CardTitle>
                <CardDescription>
                  Strategic notes and picklist priorities
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-yellow-600 hover:bg-yellow-700" size="lg">
                  Add Strategic Notes
                </Button>
              </CardContent>
            </Card>
          )}

          {currentRole === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCurrentView("admin")}>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <BarChart3 className="h-12 w-12 text-red-600" />
                </div>
                <CardTitle className="text-xl">Data Analysis</CardTitle>
                <CardDescription>
                  Analyze data and generate alliance picklists
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-red-600 hover:bg-red-700" size="lg">
                  View Dashboard
                </Button>
              </CardContent>
            </Card>
          )}

          {currentRole === "scouter" && (
            <Card className="border-gray-200 bg-gray-50 opacity-60">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <Settings className="h-12 w-12 text-gray-400" />
                </div>
                <CardTitle className="text-xl text-gray-500">Admin Features</CardTitle>
                <CardDescription className="text-gray-400">
                  Requires admin access
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button disabled className="w-full" size="lg">
                  Access Restricted
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
