import { useState, useEffect } from 'react';
import { Edit2, Eye, LogOut, Calendar } from 'lucide-react';
import { AdminMode } from './components/AdminMode';
import { AdminTeamMatches } from './components/AdminTeamMatches';
import { UserMode } from './components/UserMode';
import { Login } from './components/Login';
import { useAuth } from './contexts/AuthContext';
import type { Competition } from './types/competition.types';
import { competitionApi } from './services/api';
import { createLogger, formatErrorForLogging } from './utils/logger';
import './App.css';

type AppMode = 'admin' | 'adminTeamMatches' | 'user';

const appLogger = createLogger('App');

function App() {
  const [mode, setMode] = useState<AppMode>('user');
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [userModeKey, setUserModeKey] = useState(0);
  const [modeInitializedForUid, setModeInitializedForUid] = useState<string | null>(null);
  
  // isAdmin is now pulled from our updated AuthContext
  const { currentUser, logout, isAdmin } = useAuth();

  const loadCompetitions = async () => {
    appLogger.debug('Loading active competition', {
      currentUserId: currentUser?.uid,
    });

    try {
      const data = await competitionApi.getActive();

      if (data) {
        setSelectedCompetition(data);
        appLogger.info('Active competition loaded', {
          competitionId: data.id,
          competitionName: data.name,
        });
      } else {
        setSelectedCompetition(null);
        appLogger.warn('No active competition returned from API');
      }
    } catch (error) {
      appLogger.error('Failed to load active competition', {
        error: formatErrorForLogging(error),
      });
      setSelectedCompetition(null);
    }
  };

  useEffect(() => {
    if (currentUser) {
      appLogger.info('Authenticated user detected', {
        email: currentUser.email,
        uid: currentUser.uid,
      });
      loadCompetitions();

      // Default each signed-in user to their expected landing mode after refresh/login.
      if (isAdmin && mode !== 'admin') {
        setMode('admin');
        setModeInitializedForUid(currentUser.uid);
      } else if (!isAdmin && modeInitializedForUid !== currentUser.uid) {
        setMode('user');
        setModeInitializedForUid(currentUser.uid);
      }
    } else {
      appLogger.info('No authenticated user, rendering login screen');
      setModeInitializedForUid(null);
    }
  }, [currentUser, isAdmin, modeInitializedForUid]);

  // Security check: if a user is not an admin but somehow set mode to admin, kick them back to user mode
  useEffect(() => {
    if (!isAdmin && (mode === 'admin' || mode === 'adminTeamMatches')) {
      appLogger.warn('Non-admin attempted to access admin mode; reverting to scout mode', {
        uid: currentUser?.uid,
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('user');
    }
  }, [mode, isAdmin, currentUser?.uid]);

  // Reload competitions when switching to user mode
  useEffect(() => {
    if (currentUser && mode === 'user') {
      loadCompetitions();
      setUserModeKey(prev => prev + 1);
    }
  }, [mode, currentUser]);

  useEffect(() => {
    appLogger.info('App mode changed', {
      mode,
      isAdmin,
    });
  }, [mode, isAdmin]);

  const handleLogout = async () => {
    appLogger.info('Logout requested', {
      uid: currentUser?.uid,
    });

    try {
      await logout();
    } catch (error) {
      appLogger.error('Logout failed', {
        error: formatErrorForLogging(error),
      });
    }
  };

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:gap-4 mb-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Scouting App</h1>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs sm:text-sm text-gray-600 sm:mr-2 break-all">
                {currentUser.email} {isAdmin && <span className="text-xs font-bold text-blue-600 ml-1">(ADMIN)</span>}
              </span>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                {isAdmin && (
                  <button
                    onClick={() => setMode('admin')}
                    className={`px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm ${
                      mode === 'admin'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Edit2 size={16} />
                    Admin
                  </button>
                )}

                {isAdmin && (
                  <button
                    onClick={() => setMode('adminTeamMatches')}
                    className={`px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm ${
                      mode === 'adminTeamMatches'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <Calendar size={16} />
                    Drive Team
                  </button>
                )}

                <button
                  onClick={() => setMode('user')}
                  className={`px-3 py-2 rounded-md flex items-center justify-center gap-2 text-sm ${
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
                  className="px-3 py-2 rounded-md flex items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-700 text-sm"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </div>
          </div>

          {mode === 'user' && selectedCompetition && (
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-gray-500" />
              <span className="text-xs sm:text-sm text-gray-700 font-medium">
                {selectedCompetition.name} ({selectedCompetition.season})
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        {mode === 'admin' && isAdmin ? (
          <AdminMode onCompetitionUpdate={loadCompetitions} />
        ) : mode === 'adminTeamMatches' && isAdmin ? (
          <AdminTeamMatches selectedCompetition={selectedCompetition} />
        ) : (
          <UserMode key={userModeKey} selectedCompetition={selectedCompetition} />
        )}
      </div>
    </div>
  );
}

export default App;
