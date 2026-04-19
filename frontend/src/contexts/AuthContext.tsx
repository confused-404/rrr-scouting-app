import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { authApi } from '../services/api';
import { createLogger, formatErrorForLogging } from '../utils/logger';
import { AuthContext } from './auth-context';
const authLogger = createLogger('AuthContext');

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDriveTeam, setIsDriveTeam] = useState(false);
  const [role, setRole] = useState<'admin' | 'drive' | 'user'>('user');
  const [scouterName, setScouterName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const authSessionVersionRef = useRef(0);
  const profileSyncRequestRef = useRef(0);
  const isMountedRef = useRef(true);

  const clearProfileState = useCallback(() => {
    setIsAdmin(false);
    setIsDriveTeam(false);
    setRole('user');
    setScouterName(null);
  }, []);

  const syncUserProfile = useCallback(async (user: User, options: { forceRefresh?: boolean } = {}) => {
    try {
      const tokenResult = await user.getIdTokenResult(Boolean(options.forceRefresh));
      const tokenIsAdmin = !!tokenResult.claims.admin;
      const tokenIsDrive = !!tokenResult.claims.driveTeam;

      const profile = await authApi.getCurrentUser({ bypassCache: Boolean(options.forceRefresh) }) as {
        role?: 'admin' | 'drive' | 'user';
        scouterName?: string | null;
      };
      return {
        uid: user.uid,
        role: profile.role ?? (tokenIsAdmin ? 'admin' : (tokenIsDrive ? 'drive' : 'user')),
        scouterName: profile.scouterName ?? null,
        tokenIsAdmin,
        tokenIsDrive,
      };
    } catch (error) {
      authLogger.error('Failed to synchronize auth profile', {
        uid: user.uid,
        error: formatErrorForLogging(error),
      });
      return {
        uid: user.uid,
        role: 'user' as const,
        scouterName: null,
        tokenIsAdmin: false,
        tokenIsDrive: false,
      };
    }
  }, []);

  const runProfileSync = useCallback(async (
    user: User,
    sessionVersion: number,
    options: { forceRefresh?: boolean } = {},
  ) => {
    const requestId = profileSyncRequestRef.current + 1;
    profileSyncRequestRef.current = requestId;

    const result = await syncUserProfile(user, options);
    const requestIsStale = (
      !isMountedRef.current
      || authSessionVersionRef.current !== sessionVersion
      || profileSyncRequestRef.current !== requestId
      || auth.currentUser?.uid !== result.uid
    );

    if (requestIsStale) {
      authLogger.debug('Discarded stale auth profile sync result', {
        uid: result.uid,
        sessionVersion,
        activeSessionVersion: authSessionVersionRef.current,
        requestId,
        activeRequestId: profileSyncRequestRef.current,
        currentAuthUid: auth.currentUser?.uid,
      });
      return false;
    }

    setRole(result.role);
    setIsAdmin(result.role === 'admin');
    setIsDriveTeam(result.role === 'drive');
    setScouterName(result.scouterName);

    authLogger.info('User profile synchronized', {
      uid: result.uid,
      role: result.role,
      tokenIsAdmin: result.tokenIsAdmin,
      tokenIsDrive: result.tokenIsDrive,
      requestId,
    });

    return true;
  }, [syncUserProfile]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      authSessionVersionRef.current += 1;
      profileSyncRequestRef.current += 1;
    };
  }, []);

  const signup = async (email: string, password: string) => {
    authLogger.info('Signup requested', { email });

    try {
      await authApi.signup(email, password);
      await signInWithEmailAndPassword(auth, email, password);
      authLogger.info('Signup completed', { email });
    } catch (error) {
      authLogger.error('Signup failed', {
        email,
        error: formatErrorForLogging(error),
      });
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    authLogger.info('Login requested', { email });

    try {
      await signInWithEmailAndPassword(auth, email, password);
      authLogger.info('Login completed', { email });
    } catch (error) {
      authLogger.error('Login failed', {
        email,
        error: formatErrorForLogging(error),
      });
      throw error;
    }
  };

  const logout = async () => {
    authLogger.info('Logout requested', {
      uid: auth.currentUser?.uid,
    });

    try {
      await signOut(auth);
      authLogger.info('Logout completed');
    } catch (error) {
      authLogger.error('Logout failed', {
        error: formatErrorForLogging(error),
      });
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const sessionVersion = authSessionVersionRef.current + 1;
      authSessionVersionRef.current = sessionVersion;
      setLoading(true);
      setCurrentUser(user);
      authLogger.info('Auth state changed', {
        uid: user?.uid,
        email: user?.email,
      });
      
      if (user) {
        await runProfileSync(user, sessionVersion, { forceRefresh: true });
      } else {
        clearProfileState();
      }

      if (isMountedRef.current && authSessionVersionRef.current === sessionVersion) {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [clearProfileState, runProfileSync]);

  useEffect(() => {
    if (!currentUser) return undefined;
    const sessionVersion = authSessionVersionRef.current;

    const refreshProfile = () => {
      void runProfileSync(currentUser, sessionVersion, { forceRefresh: true });
    };

    const intervalId = window.setInterval(refreshProfile, 60_000);
    window.addEventListener('focus', refreshProfile);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshProfile);
    };
  }, [currentUser, runProfileSync]);

  const value = {
    currentUser,
    isAdmin,
    isDriveTeam,
    role,
    scouterName,
    loading,
    signup,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
