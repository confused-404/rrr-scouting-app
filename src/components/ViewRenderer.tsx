
import ScoutingForm from "@/components/ScoutingForm";
import AdminDashboard from "@/components/AdminDashboard";
import SuperScoutForm from "@/components/SuperScoutForm";
import PitScoutingForm from "@/components/PitScoutingForm";
import FormConfiguration from "@/components/FormConfiguration";
import MatchSchedule from "@/components/MatchSchedule";
import TeamLookup from "@/components/TeamLookup";
import MatchStrategy from "@/components/MatchStrategy";
import ScoutingTeams from "@/components/ScoutingTeams";

type ViewType = "home" | "match-scout" | "pit-scout" | "admin" | "superscout" | "form-config" | "schedule" | "team-lookup" | "match-strategy" | "scouting-teams";

interface ViewRendererProps {
  currentView: ViewType;
  userRole: 'admin' | 'scouter';
  username: string;
}

const ViewRenderer = ({ currentView, userRole, username }: ViewRendererProps) => {
  switch (currentView) {
    case "match-scout":
      return <ScoutingForm />;
    case "pit-scout":
      return <PitScoutingForm />;
    case "admin":
      if (userRole === "admin") {
        return <AdminDashboard />;
      }
      return null;
    case "superscout":
      if (userRole === "admin") {
        return <SuperScoutForm />;
      }
      return null;
    case "form-config":
      if (userRole === "admin") {
        return <FormConfiguration />;
      }
      return null;
    case "schedule":
      return <MatchSchedule userRole={userRole} username={username} />;
    case "team-lookup":
      if (userRole === "admin") {
        return <TeamLookup />;
      }
      return null;
    case "match-strategy":
      if (userRole === "admin") {
        return <MatchStrategy />;
      }
      return null;
    case "scouting-teams":
      if (userRole === "admin") {
        return <ScoutingTeams />;
      }
      return null;
    default:
      return null;
  }
};

export default ViewRenderer;
