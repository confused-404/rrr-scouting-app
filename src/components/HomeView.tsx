
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, BarChart3, Trophy, Target, Star, Wrench, Settings, LogOut, Calendar } from "lucide-react";

type ViewType = "home" | "match-scout" | "pit-scout" | "admin" | "superscout" | "form-config" | "schedule" | "team-lookup" | "match-strategy" | "scouting-teams";

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
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-3 mb-4">
            <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600" />
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">FRC Strategy Hub</h1>
          </div>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
            Scout robots, analyze performance, and build winning alliance strategies for FIRST Robotics Competition
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 px-4">
            <Badge variant="secondary" className="text-xs sm:text-sm">2024 Season Ready</Badge>
            <Badge className={`text-xs sm:text-sm ${currentUser.role === 'admin' ? 'bg-red-600' : 'bg-blue-600'}`}>
              {currentUser.role === 'admin' ? 'Admin Access' : 'Scouter Access'}
            </Badge>
            <Badge variant="outline" className="text-xs sm:text-sm">{currentUser.username}</Badge>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-xs sm:text-sm">
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Main Action Cards */}
        <div className={`grid gap-4 sm:gap-6 max-w-7xl mx-auto ${
          currentUser.role === 'scouter' 
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`}>
          <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full" onClick={() => onViewChange("match-scout")}>
            <CardHeader className="text-center flex-1">
              <div className="flex justify-center mb-4">
                <Users className="h-10 w-10 sm:h-12 sm:w-12 text-blue-600" />
              </div>
              <CardTitle className="text-lg sm:text-xl">Match Scouting</CardTitle>
              <CardDescription className="text-sm">
                Quick form to scout robots during matches
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full bg-blue-600 hover:bg-blue-700" size="lg">
                Start Match Scouting
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full" onClick={() => onViewChange("pit-scout")}>
            <CardHeader className="text-center flex-1">
              <div className="flex justify-center mb-4">
                <Wrench className="h-10 w-10 sm:h-12 sm:w-12 text-orange-600" />
              </div>
              <CardTitle className="text-lg sm:text-xl">Pit Scouting</CardTitle>
              <CardDescription className="text-sm">
                Detailed robot analysis in the pit area
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full bg-orange-600 hover:bg-orange-700" size="lg">
                Start Pit Scouting
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full" onClick={() => onViewChange("schedule")}>
            <CardHeader className="text-center flex-1">
              <div className="flex justify-center mb-4">
                <Calendar className="h-10 w-10 sm:h-12 sm:w-12 text-green-600" />
              </div>
              <CardTitle className="text-lg sm:text-xl">Match Schedule</CardTitle>
              <CardDescription className="text-sm">
                View match schedule and team history
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button className="w-full bg-green-600 hover:bg-green-700" size="lg">
                View Schedule
              </Button>
            </CardContent>
          </Card>

          {currentUser.role === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full" onClick={() => onViewChange("team-lookup")}>
              <CardHeader className="text-center flex-1">
                <div className="flex justify-center mb-4">
                  <Target className="h-10 w-10 sm:h-12 sm:w-12 text-indigo-600" />
                </div>
                <CardTitle className="text-lg sm:text-xl">Team Lookup</CardTitle>
                <CardDescription className="text-sm">
                  Search detailed team performance data
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700" size="lg">
                  Search Teams
                </Button>
              </CardContent>
            </Card>
          )}

          {currentUser.role === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full" onClick={() => onViewChange("match-strategy")}>
              <CardHeader className="text-center flex-1">
                <div className="flex justify-center mb-4">
                  <Users className="h-10 w-10 sm:h-12 sm:w-12 text-teal-600" />
                </div>
                <CardTitle className="text-lg sm:text-xl">Match Strategy</CardTitle>
                <CardDescription className="text-sm">
                  Compare 3 teams for alliance planning
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full bg-teal-600 hover:bg-teal-700" size="lg">
                  Plan Strategy
                </Button>
              </CardContent>
            </Card>
          )}

          {currentUser.role === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full" onClick={() => onViewChange("superscout")}>
              <CardHeader className="text-center flex-1">
                <div className="flex justify-center mb-4">
                  <Star className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-600" />
                </div>
                <CardTitle className="text-lg sm:text-xl">Super Scout</CardTitle>
                <CardDescription className="text-sm">
                  Strategic notes and picklist priorities
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full bg-yellow-600 hover:bg-yellow-700" size="lg">
                  Add Strategic Notes
                </Button>
              </CardContent>
            </Card>
          )}

          {currentUser.role === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full" onClick={() => onViewChange("admin")}>
              <CardHeader className="text-center flex-1">
                <div className="flex justify-center mb-4">
                  <BarChart3 className="h-10 w-10 sm:h-12 sm:w-12 text-red-600" />
                </div>
                <CardTitle className="text-lg sm:text-xl">Data Analysis</CardTitle>
                <CardDescription className="text-sm">
                  Analyze data and generate alliance picklists
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full bg-red-600 hover:bg-red-700" size="lg">
                  View Dashboard
                </Button>
              </CardContent>
            </Card>
          )}

          {currentUser.role === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full" onClick={() => onViewChange("form-config")}>
              <CardHeader className="text-center flex-1">
                <div className="flex justify-center mb-4">
                  <Settings className="h-10 w-10 sm:h-12 sm:w-12 text-purple-600" />
                </div>
                <CardTitle className="text-lg sm:text-xl">Form Configuration</CardTitle>
                <CardDescription className="text-sm">
                  Customize scouting form questions
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
                  Configure Forms
                </Button>
              </CardContent>
            </Card>
          )}

          {currentUser.role === "admin" && (
            <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full" onClick={() => onViewChange("scouting-teams")}>
              <CardHeader className="text-center flex-1">
                <div className="flex justify-center mb-4">
                  <Users className="h-10 w-10 sm:h-12 sm:w-12 text-cyan-600" />
                </div>
                <CardTitle className="text-lg sm:text-xl">Scouting Teams</CardTitle>
                <CardDescription className="text-sm">
                  Manage scouting shifts and assignments
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button className="w-full bg-cyan-600 hover:bg-cyan-700" size="lg">
                  Manage Teams
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
