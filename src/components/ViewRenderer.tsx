
import ScoutingForm from "@/components/ScoutingForm";
import AdminDashboard from "@/components/AdminDashboard";
import SuperScoutForm from "@/components/SuperScoutForm";
import PitScoutingForm from "@/components/PitScoutingForm";
import FormConfiguration from "@/components/FormConfiguration";
import MatchSchedule from "@/components/MatchSchedule";

type ViewType = "home" | "match-scout" | "pit-scout" | "admin" | "superscout" | "form-config" | "schedule";

interface ViewRendererProps {
  currentView: ViewType;
  userRole: 'admin' | 'scouter';
}

const ViewRenderer = ({ currentView, userRole }: ViewRendererProps) => {
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
      return <MatchSchedule />;
    default:
      return null;
  }
};

export default ViewRenderer;
