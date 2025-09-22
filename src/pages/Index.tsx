
import { useState } from "react";
import LoginForm from "@/components/LoginForm";
import Navigation from "@/components/Navigation";
import ViewRenderer from "@/components/ViewRenderer";
import HomeView from "@/components/HomeView";

type UserRole = 'admin' | 'scouter' | null;
type ViewType = "home" | "match-scout" | "pit-scout" | "admin" | "superscout" | "form-config" | "schedule" | "team-lookup" | "match-strategy" | "scouting-teams";

interface User {
  role: UserRole;
  username: string;
}

const Index = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>("home");

  const handleLogin = (role: UserRole, username: string) => {
    setCurrentUser({ role, username });
    setCurrentView("home");
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView("home");
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  if (!currentUser) {
    return <LoginForm onLogin={handleLogin} />;
  }

  if (currentView === "home") {
    return (
      <HomeView 
        currentUser={currentUser}
        onViewChange={handleViewChange}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-red-50">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-6">
        <Navigation
          currentView={currentView}
          userRole={currentUser.role!}
          username={currentUser.username}
          onViewChange={handleViewChange}
          onLogout={handleLogout}
        />
        <ViewRenderer 
          currentView={currentView}
          userRole={currentUser.role!}
          username={currentUser.username}
        />
      </div>
    </div>
  );
};

export default Index;
