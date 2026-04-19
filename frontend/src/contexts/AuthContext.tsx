import React, { useCallback, useEffect, useState } from 'react';
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

  const syncUserProfile = useCallback(async (user: User, options: { forceRefresh?: boolean } = {}) => {
    try {
      const tokenResult = await user.getIdTokenResult(Boolean(options.forceRefresh));
      const tokenIsAdmin = !!tokenResult.claims.admin;
      const tokenIsDrive = !!tokenResult.claims.driveTeam;

      const profile = await authApi.getCurrentUser({ bypassCache: Boolean(options.forceRefresh) }) as {
        role?: 'admin' | 'drive' | 'user';
        scouterName?: string | null;
      };
      const nextRole = profile.role ?? (tokenIsAdmin ? 'admin' : (tokenIsDrive ? 'drive' : 'user'));

      setRole(nextRole);
      setIsAdmin(nextRole === 'admin');
      setIsDriveTeam(nextRole === 'drive');
      setScouterName(profile.scouterName ?? null);

      authLogger.info('User profile synchronized', {
        uid: user.uid,
        role: nextRole,
        tokenIsAdmin,
        tokenIsDrive,
      });
    } catch (error) {
      authLogger.error('Failed to synchronize auth profile', {
        uid: user.uid,
        error: formatErrorForLogging(error),
      });
      setIsAdmin(false);
      setIsDriveTeam(false);
      setRole('user');
      setScouterName(null);
    }
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
      setLoading(true);
      setCurrentUser(user);
      authLogger.info('Auth state changed', {
        uid: user?.uid,
        email: user?.email,
      });
      
      if (user) {
        await syncUserProfile(user, { forceRefresh: true });
      } else {
        setIsAdmin(false);
        setIsDriveTeam(false);
        setRole('user');
        setScouterName(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, [syncUserProfile]);

  useEffect(() => {
    if (!currentUser) return undefined;

    const refreshProfile = () => {
      void syncUserProfile(currentUser, { forceRefresh: true });
    };

    const intervalId = window.setInterval(refreshProfile, 60_000);
    window.addEventListener('focus', refreshProfile);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshProfile);
    };
  }, [currentUser, syncUserProfile]);

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
