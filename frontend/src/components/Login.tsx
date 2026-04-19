import React, { useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { ForgotPassword } from './ForgotPassword';
import { createLogger, formatErrorForLogging } from '../utils/logger';

const loginLogger = createLogger('Login');

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const { signup, login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    loginLogger.info('Authentication form submitted', {
      email,
      mode: isSignup ? 'signup' : 'login',
    });

    try {
      if (isSignup) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
    } catch (err: unknown) {
      loginLogger.error('Authentication form failed', {
        email,
        mode: isSignup ? 'signup' : 'login',
        error: formatErrorForLogging(err),
      });
      setError(err instanceof Error ? err.message : 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  if (forgotMode) {
    return <ForgotPassword onBack={() => setForgotMode(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-center mb-6">
          {isSignup ? 'Create Account' : 'Login'}
        </h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {loading ? 'Processing...' : isSignup ? 'Sign Up' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
          {/* Sign Up / Login Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {isSignup
                ? 'Already have an account? Login'
                : "Don't have an account? Sign up"}
            </button>
          </div>

          {/* Forgot Password Toggle - Only shows on Login mode */}
          {!isSignup && (
            <div className="border-top pt-2">
              <button
                type="button"
                onClick={() => setForgotMode(true)}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Forgot password?
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
