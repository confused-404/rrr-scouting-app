
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, BarChart3, Trophy, Target, Star, Wrench, Settings, LogOut, Calendar } from "lucide-react";

type ViewType = "home" | "match-scout" | "pit-scout" | "admin" | "superscout" | "form-config" | "schedule";

interface HomeViewProps {
  currentUser: { role: 'admin' | 'scouter'; username: string };
  onViewChange: (view: ViewType) => void;
  onLogout: () => void;
}

const HomeView = ({ currentUser, onViewChange, onLogout }: HomeViewProps) => {
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
            <Badge className={currentUser.role === 'admin' ? 'bg-red-600' : 'bg-blue-600'}>
              {currentUser.role === 'admin' ? 'Admin Access' : 'Scouter Access'}
            </Badge>
            <Badge variant="outline">{currentUser.username}</Badge>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main Action Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onViewChange("match-scout")}>
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onViewChange("pit-scout")}>
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onViewChange("schedule")}>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Calendar className="h-12 w-12 text-green-600" />
              </div>
              <CardTitle className="text-xl">Match Schedule</CardTitle>
              <CardDescription>
                View match schedule and team history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-green-600 hover:bg-green-700" size="lg">
                View Schedule
              </Button>
            </CardContent>
          </Card>

          {currentUser.role === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onViewChange("superscout")}>
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

          {currentUser.role === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onViewChange("admin")}>
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

          {currentUser.role === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onViewChange("form-config")}>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <Settings className="h-12 w-12 text-purple-600" />
                </div>
                <CardTitle className="text-xl">Form Configuration</CardTitle>
                <CardDescription>
                  Customize scouting form questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
                  Configure Forms
                </Button>
              </CardContent>
            </Card>
          )}

          {currentUser.role === "scouter" && (
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

export default HomeView;
