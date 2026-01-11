import { useState } from 'react';
import { Edit2, Eye } from 'lucide-react';
import { AdminMode } from './components/AdminMode';
import { UserMode } from './components/UserMode';
import './App.css';

function App() {
  const [mode, setMode] = useState<'admin' | 'user'>('user');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Form Builder</h1>
            <div className="flex gap-2">
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