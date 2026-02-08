import React, { useState } from 'react';
import { Settings, FileText, BarChart } from 'lucide-react';
import { CompetitionManager } from './CompetitionManager';
import { FormManager } from './FormManager';
import { ResponseViewer } from './ResponseViewer';

type AdminTab = 'competitions' | 'forms' | 'responses';

export const AdminMode: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('competitions');

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-2 border border-gray-100 flex gap-2">
        <button 
          onClick={() => setActiveTab('competitions')} 
          className={`flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'competitions' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Settings size={16} /> Competitions
        </button>
        <button 
          onClick={() => setActiveTab('forms')} 
          className={`flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'forms' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <FileText size={16} /> Forms
        </button>
        <button 
          onClick={() => setActiveTab('responses')} 
          className={`flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'responses' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <BarChart size={16} /> Responses
        </button>
      </div>

      {/* Tab Content - Props removed to match new component definitions */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'competitions' && <CompetitionManager />}
        {activeTab === 'forms' && <FormManager />}
        {activeTab === 'responses' && <ResponseViewer />}
      </div>
    </div>
  );
};