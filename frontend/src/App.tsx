import { useState, useEffect, useRef, useCallback } from 'react';
import { Edit2, Eye, LogOut, Calendar, RefreshCw } from 'lucide-react';
import { AdminMode } from './components/AdminMode';
import { AdminTeamMatches } from './components/AdminTeamMatches';
import { UserMode } from './components/UserMode';
import { Login } from './components/Login';
import { useAuth } from './contexts/useAuth';
import type { Competition } from './types/competition.types';
import { competitionApi, forceApiRefresh } from './services/api';
import { createLogger, formatErrorForLogging } from './utils/logger';
import './App.css';

type AppMode = 'admin' | 'adminTeamMatches' | 'user';

const appLogger = createLogger('App');
const APP_MODE_LANDING_KEY_PREFIX = 'scoutingAppLandingMode:';
const APP_MODE_SESSION_KEY_PREFIX = 'scoutingAppSessionMode:';

const isAppMode = (value: unknown): value is AppMode => (
  value === 'admin' || value === 'adminTeamMatches' || value === 'user'
);

const isAdminLandingMode = (value: unknown): value is 'admin' | 'adminTeamMatches' => (
  value === 'admin' || value === 'adminTeamMatches'
);

function App() {
  const [mode, setMode] = useState<AppMode>('user');
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null);
  const [modeInitializedForUid, setModeInitializedForUid] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pendingRestoredModeRef = useRef<AppMode | null>(null);
  
  // Roles are pulled from AuthContext custom claims
  const { currentUser, logout, isAdmin, isDriveTeam } = useAuth();

  const loadCompetitions = useCallback(async () => {
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
  }, [currentUser?.uid]);

  useEffect(() => {
    if (currentUser) {
      appLogger.info('Authenticated user detected', {
        email: currentUser.email,
        uid: currentUser.uid,
      });
      loadCompetitions();

      // Use session mode for reload continuity; fall back to admin landing mode for fresh app opens.
      const sessionKey = `${APP_MODE_SESSION_KEY_PREFIX}${currentUser.uid}`;
      const landingKey = `${APP_MODE_LANDING_KEY_PREFIX}${currentUser.uid}`;

      let sessionMode: AppMode | null = null;
      let landingMode: 'admin' | 'adminTeamMatches' | null = null;
      try {
        const rawSessionMode = sessionStorage.getItem(sessionKey);
        if (isAppMode(rawSessionMode)) sessionMode = rawSessionMode;

        const rawLandingMode = localStorage.getItem(landingKey);
        if (isAdminLandingMode(rawLandingMode)) landingMode = rawLandingMode;
      } catch {
        sessionMode = null;
        landingMode = null;
      }

      const desiredMode: AppMode = isAdmin
        ? (sessionMode ?? landingMode ?? 'admin')
        : (isDriveTeam ? 'adminTeamMatches' : 'user');

      const needsHydration = modeInitializedForUid !== currentUser.uid;
      if (needsHydration || mode !== desiredMode) {
        pendingRestoredModeRef.current = desiredMode;
        setMode(desiredMode);
        if (needsHydration) {
          setModeInitializedForUid(currentUser.uid);
        }
      }
    } else {
      appLogger.info('No authenticated user, rendering login screen');
      setModeInitializedForUid(null);
      pendingRestoredModeRef.current = null;
    }
  }, [currentUser, isAdmin, isDriveTeam, modeInitializedForUid, mode, loadCompetitions]);

  const persistModeSelection = useCallback((nextMode: AppMode) => {
    if (!currentUser) return;
    const sessionKey = `${APP_MODE_SESSION_KEY_PREFIX}${currentUser.uid}`;
    const landingKey = `${APP_MODE_LANDING_KEY_PREFIX}${currentUser.uid}`;
    try {
      sessionStorage.setItem(sessionKey, nextMode);

      // Persist only admin landing destinations across app closes.
      if ((isAdmin || isDriveTeam) && (nextMode === 'admin' || nextMode === 'adminTeamMatches')) {
        localStorage.setItem(landingKey, nextMode);
      }
    } catch {
      // Ignore storage failures; app mode still works in-memory.
    }
  }, [currentUser, isAdmin, isDriveTeam]);

  const handleModeChange = (nextMode: AppMode) => {
    setMode(nextMode);
    persistModeSelection(nextMode);
  };

  // Security check based on role claims.
  useEffect(() => {
    if (isAdmin) return;

    if (isDriveTeam && mode !== 'adminTeamMatches' && mode !== 'user') {
      appLogger.warn('Drive-team user attempted restricted mode; reverting to drive team mode', {
        uid: currentUser?.uid,
        mode,
      });
      setMode('adminTeamMatches');
      persistModeSelection('adminTeamMatches');
      return;
    }

    if (!isDriveTeam && mode !== 'user') {
      appLogger.warn('Scout user attempted restricted mode; reverting to scout mode', {
        uid: currentUser?.uid,
        mode,
      });
      setMode('user');
      persistModeSelection('user');
    }
  }, [mode, isAdmin, isDriveTeam, currentUser?.uid, persistModeSelection]);

  // Reload competitions when switching to user mode
  useEffect(() => {
    if (currentUser && mode === 'user') {
      loadCompetitions();
    }
  }, [mode, currentUser, loadCompetitions]);

  useEffect(() => {
    appLogger.info('App mode changed', {
      mode,
      isAdmin,
      isDriveTeam,
    });
  }, [mode, isAdmin, isDriveTeam]);

  const handleLogout = async () => {
    appLogger.info('Logout requested', {
      uid: currentUser?.uid,
    });

    try {
      if (currentUser) {
        const sessionKey = `${APP_MODE_SESSION_KEY_PREFIX}${currentUser.uid}`;
        const landingKey = `${APP_MODE_LANDING_KEY_PREFIX}${currentUser.uid}`;
        try {
          sessionStorage.removeItem(sessionKey);

          // On explicit app exit/logout, route admins back to an admin front page next time.
          if (isAdmin || isDriveTeam) {
            localStorage.setItem(landingKey, mode === 'adminTeamMatches' ? 'adminTeamMatches' : 'admin');
          }
        } catch {
          // Ignore storage errors on logout.
        }
      }

      await logout();
    } catch (error) {
      appLogger.error('Logout failed', {
        error: formatErrorForLogging(error),
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    forceApiRefresh();

    try {
      await loadCompetitions();
      setRefreshVersion((current) => current + 1);
    } finally {
      setRefreshing(false);
    }
  };

  if (!currentUser) {
    return <Login />;
  }

  const modeReady = modeInitializedForUid === currentUser.uid;
  const isDriveTeamPage = mode === 'adminTeamMatches' && (isAdmin || isDriveTeam);

  if (!modeReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`${isDriveTeamPage ? 'sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur' : 'bg-white border-b border-gray-200'}`}>
        <div className={`max-w-4xl mx-auto px-4 ${isDriveTeamPage ? 'py-2 sm:py-2.5' : 'py-3 sm:py-4'}`}>
          <div className={`flex flex-col ${isDriveTeamPage ? 'gap-2 sm:gap-2.5 mb-1 sm:mb-1.5' : 'gap-3 sm:gap-4 mb-3 sm:mb-4'} sm:flex-row sm:items-center sm:justify-between`}>
            <h1 className={`${isDriveTeamPage ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'} font-semibold text-gray-900`}>Scouting App</h1>
            <div className={`flex flex-col ${isDriveTeamPage ? 'gap-1.5 sm:flex-row sm:items-center sm:gap-1.5' : 'gap-2 sm:flex-row sm:items-center sm:gap-2'}`}>
              <span className="text-xs sm:text-sm text-gray-600 sm:mr-2 break-all">
                {currentUser.email}{' '}
                {isAdmin && <span className="text-xs font-bold text-blue-600 ml-1">(ADMIN)</span>}
                {!isAdmin && isDriveTeam && <span className="text-xs font-bold text-emerald-600 ml-1">(DRIVE TEAM)</span>}
              </span>
              <div className={`grid grid-cols-2 ${isDriveTeamPage ? 'gap-1.5 sm:gap-1.5' : 'gap-2'} sm:flex sm:flex-wrap`}>
                {isAdmin && (
                  <button
                    onClick={() => handleModeChange('admin')}
                    className={`${isDriveTeamPage ? 'px-2.5 py-1.5 text-xs sm:text-sm' : 'px-3 py-2 text-sm'} rounded-md flex items-center justify-center gap-2 ${
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
                    onClick={() => handleModeChange('adminTeamMatches')}
                    className={`${isDriveTeamPage ? 'px-2.5 py-1.5 text-xs sm:text-sm' : 'px-3 py-2 text-sm'} rounded-md flex items-center justify-center gap-2 ${
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
                  onClick={() => handleModeChange('user')}
                  className={`${isDriveTeamPage ? 'px-2.5 py-1.5 text-xs sm:text-sm' : 'px-3 py-2 text-sm'} rounded-md flex items-center justify-center gap-2 ${
                    mode === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Eye size={16} />
                  Scout
                </button>

                {!isAdmin && isDriveTeam && (
                  <button
                    onClick={() => handleModeChange('adminTeamMatches')}
                    className={`${isDriveTeamPage ? 'px-2.5 py-1.5 text-xs sm:text-sm' : 'px-3 py-2 text-sm'} rounded-md flex items-center justify-center gap-2 ${
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
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={`${isDriveTeamPage ? 'px-2.5 py-1.5 text-xs sm:text-sm' : 'px-3 py-2 text-sm'} rounded-md flex items-center justify-center gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>

                <button
                  onClick={handleLogout}
                  className={`${isDriveTeamPage ? 'px-2.5 py-1.5 text-xs sm:text-sm' : 'px-3 py-2 text-sm'} rounded-md flex items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-700`}
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

      <div className={`max-w-4xl mx-auto px-3 sm:px-4 ${isDriveTeamPage ? 'pt-2 pb-5 sm:pt-2 sm:pb-8' : 'py-5 sm:py-8'}`}>
        {mode === 'admin' && isAdmin ? (
          <AdminMode key={`admin-${refreshVersion}`} onCompetitionUpdate={loadCompetitions} />
        ) : mode === 'adminTeamMatches' && (isAdmin || isDriveTeam) ? (
          <AdminTeamMatches key={`admin-team-${refreshVersion}`} selectedCompetition={selectedCompetition} />
        ) : (
          <UserMode key={`user-${refreshVersion}`} selectedCompetition={selectedCompetition} />
        )}
      </div>
    </div>
  );
}

export default App;
