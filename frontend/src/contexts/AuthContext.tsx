import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { createLogger, formatErrorForLogging } from '../utils/logger';

interface AuthContextType {
  currentUser: User | null;
  isAdmin: boolean; // Added isAdmin to the type
  loading: boolean;
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const authLogger = createLogger('AuthContext');

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false); // New state for admin status
  const [loading, setLoading] = useState(true);

  const signup = async (email: string, password: string) => {
    authLogger.info('Signup requested', { email });

    try {
      await createUserWithEmailAndPassword(auth, email, password);
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
      setCurrentUser(user);
      authLogger.info('Auth state changed', {
        uid: user?.uid,
        email: user?.email,
      });
      
      if (user) {
        try {
          // Get the ID Token Result to check for custom claims
          // Using true forces a refresh to ensure we get the latest claims
          const tokenResult = await user.getIdTokenResult(true);
          setIsAdmin(!!tokenResult.claims.admin);
          authLogger.info('User claims loaded', {
            uid: user.uid,
            isAdmin: !!tokenResult.claims.admin,
          });
        } catch (error) {
          authLogger.error('Failed to fetch auth claims', {
            uid: user.uid,
            error: formatErrorForLogging(error),
          });
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    isAdmin, // Exposed to the rest of the app
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