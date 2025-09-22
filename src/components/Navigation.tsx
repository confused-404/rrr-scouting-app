
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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6 gap-3 px-2 sm:px-0">
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <div className="flex-shrink-0">
          {getViewIcon()}
        </div>
        <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{getViewTitle()}</h1>
        <div className="hidden sm:flex items-center space-x-2">
          <Badge className={userRole === 'admin' ? 'bg-red-600' : 'bg-blue-600'}>
            {userRole === 'admin' ? 'Admin' : 'Scouter'}
          </Badge>
          <Badge variant="outline">{username}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-2 flex-shrink-0">
        <div className="flex sm:hidden items-center space-x-1">
          <Badge className={`text-xs ${userRole === 'admin' ? 'bg-red-600' : 'bg-blue-600'}`}>
            {userRole === 'admin' ? 'Admin' : 'Scouter'}
          </Badge>
          <Badge variant="outline" className="text-xs">{username}</Badge>
        </div>
        <Button variant="outline" onClick={() => onViewChange("home")} size="sm" className="text-xs whitespace-nowrap">
          <span className="hidden sm:inline">Back to Home</span>
          <span className="sm:hidden">Home</span>
        </Button>
        <Button variant="ghost" onClick={onLogout} size="sm" className="text-xs whitespace-nowrap">
          <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Logout</span>
          <span className="sm:hidden">Exit</span>
        </Button>
      </div>
    </div>
  );
};

export default Navigation;
