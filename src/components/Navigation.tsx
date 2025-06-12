
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Target, Wrench, Star, BarChart3, Settings, Calendar } from "lucide-react";

type ViewType = "home" | "match-scout" | "pit-scout" | "admin" | "superscout" | "form-config" | "schedule";

interface NavigationProps {
  currentView: ViewType;
  userRole: 'admin' | 'scouter';
  username: string;
  onViewChange: (view: ViewType) => void;
  onLogout: () => void;
}

const Navigation = ({ currentView, userRole, username, onViewChange, onLogout }: NavigationProps) => {
  const getViewTitle = () => {
    switch (currentView) {
      case "match-scout": return "Match Scouting";
      case "pit-scout": return "Pit Scouting";
      case "admin": return "Admin Dashboard";
      case "superscout": return "Super Scout";
      case "form-config": return "Form Configuration";
      case "schedule": return "Match Schedule";
      default: return "FRC Strategy Hub";
    }
  };

  const getViewIcon = () => {
    switch (currentView) {
      case "match-scout": return <Target className="h-8 w-8 text-blue-600" />;
      case "pit-scout": return <Wrench className="h-8 w-8 text-orange-600" />;
      case "admin": return <BarChart3 className="h-8 w-8 text-red-600" />;
      case "superscout": return <Star className="h-8 w-8 text-yellow-600" />;
      case "form-config": return <Settings className="h-8 w-8 text-purple-600" />;
      case "schedule": return <Calendar className="h-8 w-8 text-green-600" />;
      default: return null;
    }
  };

  if (currentView === "home") {
    return null;
  }

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-3">
        {getViewIcon()}
        <h1 className="text-2xl font-bold text-foreground">{getViewTitle()}</h1>
        <Badge className={userRole === 'admin' ? 'bg-red-600' : 'bg-blue-600'}>
          {userRole === 'admin' ? 'Admin' : 'Scouter'}
        </Badge>
        <Badge variant="outline">{username}</Badge>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="outline" onClick={() => onViewChange("home")}>
          Back to Home
        </Button>
        <Button variant="ghost" onClick={onLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Navigation;
