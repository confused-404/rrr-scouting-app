import React, { useState } from 'react';
import { Settings, FileText, BarChart } from 'lucide-react';
import { CompetitionManager } from './CompetitionManager';
import { FormManager } from './FormManager';
import { ResponseViewer } from './ResponseViewer';

type AdminTab = 'competitions' | 'forms' | 'responses';

export const AdminMode: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('competitions');
  const [selectedCompId, setSelectedCompId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-2 border border-gray-100 flex gap-2">
        <button 
          onClick={() => setActiveTab('competitions')} 
          className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'competitions' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <Settings size={18} /> Competitions
        </button>
        <button 
          onClick={() => setActiveTab('forms')} 
          className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'forms' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <FileText size={18} /> Forms
        </button>
        <button 
          onClick={() => setActiveTab('responses')} 
          className={`flex-1 px-4 py-2 rounded-md flex items-center justify-center gap-2 font-bold text-sm transition-all ${activeTab === 'responses' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <BarChart size={18} /> Responses
        </button>
      </div>

      {activeTab === 'competitions' && (
        <CompetitionManager onSelect={(id: string) => {
          setSelectedCompId(id);
          setActiveTab('responses'); // Optional: auto-jump to responses on selection
        }} />
      )}
      
      {activeTab === 'forms' && <FormManager />}
      
      {activeTab === 'responses' && (
        <ResponseViewer competitionId={selectedCompId || undefined} />
      )}
    </div>
  );
};