import { useState } from 'react';
import { Edit2, Eye, LogOut } from 'lucide-react';
import { AdminMode } from './components/AdminMode';
import { UserMode } from './components/UserMode';
import { Login } from './components/Login';
import { useAuth } from './contexts/AuthContext';
import './App.css';

function App() {
  const [mode, setMode] = useState<'admin' | 'user'>('user');
  const { currentUser, logout } = useAuth();

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
          <div className="flex items-center justify-between">
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
                onClick={handleLogout}
                className="px-4 py-2 rounded-md flex items-center gap-2 bg-red-600 text-white hover:bg-red-700"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {mode === 'admin' ? <AdminMode /> : <UserMode />}
      </div>
    </div>
  );
}

export default App;