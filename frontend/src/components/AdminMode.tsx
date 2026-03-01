import React, { useState } from 'react';
import { Settings, FileText, BarChart } from 'lucide-react';
import { CompetitionManager } from './CompetitionManager';
import { FormManager } from './FormManager';
import { ResponseViewer } from './ResponseViewer';
import { TeamLookup } from './TeamLookup';

type AdminTab = 'competitions' | 'forms' | 'analytics';

// analytics subtabs
type AnalyticsTab = 'responses' | 'teamLookup';

export const AdminMode: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('competitions');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('responses');

  return (
    <div className="space-y-6">
      {/* Main Navigation Tabs */}
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
          onClick={() => setActiveTab('analytics')} 
          className={`flex-1 px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${
            activeTab === 'analytics' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          <BarChart size={16} /> Analytics
        </button>
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'competitions' && <CompetitionManager />}
        {activeTab === 'forms' && <FormManager />}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            {/* Analytics Sub-navigation */}
            <div className="bg-gray-100 rounded-lg p-2 flex gap-2">
              <button
                onClick={() => setAnalyticsTab('responses')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  analyticsTab === 'responses'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Responses
              </button>
              <button
                onClick={() => setAnalyticsTab('teamLookup')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  analyticsTab === 'teamLookup'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Team Lookup
              </button>
            </div>

            {/* Analytics content */}
            <div>
              {analyticsTab === 'responses' && <ResponseViewer />}
              {analyticsTab === 'teamLookup' && <TeamLookup />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};