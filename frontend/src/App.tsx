import { useState, useEffect } from 'react';
import { Edit2, Eye, LogOut, Calendar } from 'lucide-react';
import { AdminMode } from './components/AdminMode';
import { UserMode } from './components/UserMode';
import { Login } from './components/Login';
import { useAuth } from './contexts/AuthContext';
import type { Competition } from './types/competition.types';
import { competitionApi } from './services/api';
import './App.css';

type AppMode = 'admin' | 'user';

function App() {
  const [mode, setMode] = useState<AppMode>('user');
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [userModeKey, setUserModeKey] = useState(0);
  
  // isAdmin is now pulled from our updated AuthContext
  const { currentUser, logout, isAdmin } = useAuth();

  const loadCompetitions = async () => {
    try {
      const data = await competitionApi.getActive();

      if (data) {
        setSelectedCompetition(data);
      } else {
        setSelectedCompetition(null);
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
      setSelectedCompetition(null);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadCompetitions();
    }
  }, [currentUser]);

  // Security check: if a user is not an admin but somehow set mode to admin, kick them back to user mode
  useEffect(() => {
    if (!isAdmin && mode === 'admin') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('user');
    }
  }, [mode, isAdmin]);

  // Reload competitions when switching to user mode
  useEffect(() => {
    if (currentUser && mode === 'user') {
      loadCompetitions();
      setUserModeKey(prev => prev + 1);
    }
  }, [mode, currentUser]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Scouting App</h1>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600 mr-2">
                {currentUser.email} {isAdmin && <span className="text-xs font-bold text-blue-600 ml-1">(ADMIN)</span>}
              </span>
              
              {isAdmin && (
                <button
                  onClick={() => setMode('admin')}
                  className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                    mode === 'admin'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Edit2 size={16} />
                  Admin
                </button>
              )}

              <button
                onClick={() => setMode('user')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                  mode === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Eye size={16} />
                Scout
              </button>
              
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-md flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>

          {mode === 'user' && selectedCompetition && (
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-500" />
              <span className="text-sm text-gray-700 font-medium">
                {selectedCompetition.name} ({selectedCompetition.season})
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {mode === 'admin' && isAdmin ? (
          <AdminMode onCompetitionUpdate={() => loadCompetitions()} />
        ) : (
          <UserMode key={userModeKey} selectedCompetition={selectedCompetition} />
        )}
      </div>
    </div>
  );
}

export default App;
