import { useState, useEffect } from 'react';
import { Edit2, Eye, LogOut, Calendar, Settings } from 'lucide-react';
import { AdminMode } from './components/AdminMode';
import { UserMode } from './components/UserMode';
import { Login } from './components/Login';
import { CompetitionManager } from './components/CompetitionManager';
import { useAuth } from './contexts/AuthContext';
import type { Competition } from './types/competition.types';
import { competitionApi } from './services/api';
import './App.css';

type AppMode = 'admin' | 'user' | 'competitions';

function App() {
  const [mode, setMode] = useState<AppMode>('user');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    if (currentUser) {
      loadCompetitions();
    }
  }, [currentUser]);

  // Reload competitions when switching to admin or user mode
  useEffect(() => {
    if (currentUser && (mode === 'admin' || mode === 'user')) {
      loadCompetitions();
    }
  }, [mode]);

  const loadCompetitions = async () => {
    try {
      const data = await competitionApi.getActive();
      console.log('Active competitions:', data);
      setCompetitions(data);
      
      // If no competition is selected, or selected one is no longer in the list, select the first one
      if (data.length > 0) {
        const stillExists = selectedCompetition && data.find(c => c.id === selectedCompetition.id);
        if (!stillExists) {
          setSelectedCompetition(data[0]);
        }
      } else {
        setSelectedCompetition(null);
      }
    } catch (error) {
      console.error('Error loading competitions:', error);
    }
  };

  if (!currentUser) {
    return <Login />;
  }

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">Form Builder</h1>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600 mr-2">
                {currentUser.email}
              </span>
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
              <button
                onClick={() => setMode('user')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                  mode === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Eye size={16} />
                User
              </button>
              <button
                onClick={() => setMode('competitions')}
                className={`px-4 py-2 rounded-md flex items-center gap-2 ${
                  mode === 'competitions'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Settings size={16} />
                Competitions
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

          {mode !== 'competitions' && (
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-500" />
              <select
                value={selectedCompetition?.id || ''}
                onChange={(e) => {
                  const comp = competitions.find(c => c.id === e.target.value);
                  setSelectedCompetition(comp || null);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {competitions.length === 0 ? (
                  <option value="">No active competitions</option>
                ) : (
                  competitions.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name} ({comp.season})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {mode === 'competitions' ? (
          <CompetitionManager />
        ) : mode === 'admin' ? (
          <AdminMode selectedCompetition={selectedCompetition} />
        ) : (
          <UserMode selectedCompetition={selectedCompetition} />
        )}
      </div>
    </div>
  );
}

export default App;