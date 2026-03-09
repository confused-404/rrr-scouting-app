import React, { useState, useEffect } from 'react';
import { Settings, FileText, BarChart, Users, ClipboardList, Edit3, Save, Search, X } from 'lucide-react';
import { CompetitionManager } from './CompetitionManager';
import { FormManager } from './FormManager';
import { ResponseViewer } from './ResponseViewer';
import { TeamLookup } from './TeamLookup';
import { MatchSchedule } from './MatchSchedule';
import { ScoutingTeams } from './ScoutingTeams';
import { PickListManager } from './PickListManager';
import { competitionApi } from '../services/api';
import type { Competition } from '../types/competition.types';

type AdminTab = 'competitions' | 'forms' | 'scoutingTeams' | 'analytics' | 'superscout' | 'picklists';
type AnalyticsTab = 'responses' | 'teamLookup' | 'schedule';

export const AdminMode: React.FC<{ onCompetitionUpdate?: () => void }> = ({ onCompetitionUpdate }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('competitions');
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('responses');
  const [activeCompetition, setActiveCompetition] = useState<Competition | null>(null);

  // --- Superscouter State ---
  const [targetTeam, setTargetTeam] = useState('');
  const [scouterNotes, setScouterNotes] = useState(''); // The LIVE notes (shown in Team Lookup)
  const [draftNotes, setDraftNotes] = useState('');    // The WORKSPACE (only shown while editing)
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadActiveCompetition = async () => {
      try {
        const comp = await competitionApi.getActive();
        setActiveCompetition(comp);
      } catch (error) {
        console.error('Error loading active competition:', error);
      }
    };
    loadActiveCompetition();
  }, []);

  // When user toggles Edit ON, we sync the draft to the current saved notes
  const handleEditToggle = () => {
    if (!isEditing) {
      setDraftNotes(scouterNotes);
    }
    setIsEditing(!isEditing);
  };

  // Load notes when target team changes
  useEffect(() => {
    const loadNotes = async () => {
      if (!targetTeam || !activeCompetition) return;
      
      try {
        const data = await competitionApi.getSuperscouterNotes(activeCompetition.id, targetTeam);
        setScouterNotes(data.notes);
        setDraftNotes(data.notes);
      } catch (error) {
        console.error('Error loading notes:', error);
      }
    };

    loadNotes();
  }, [targetTeam, activeCompetition?.id]);

  const handleSaveNotes = async () => {
    if (!targetTeam) {
      alert("Please enter a team number before saving.");
      return;
    }
    if (!activeCompetition) {
      alert("No active competition selected.");
      return;
    }
    setIsSaving(true);
    try {
      await competitionApi.saveSuperscouterNotes(activeCompetition.id, targetTeam, draftNotes);
      
      setScouterNotes(draftNotes); // "Commits" the draft to the live state
      setIsEditing(false);
      alert(`Saved notes for Team ${targetTeam}`);
    } catch (error) {
      console.error('Save error:', error);
      alert('Error saving notes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setDraftNotes(scouterNotes); // Discard changes
    setIsEditing(false);
  };

  const handleCompetitionUpdate = () => {
    const loadActiveCompetition = async () => {
      try {
        const comp = await competitionApi.getActive();
        setActiveCompetition(comp);
      } catch (error) {
        console.error('Error loading active competition:', error);
      }
    };
    loadActiveCompetition();
    if (onCompetitionUpdate) onCompetitionUpdate();
  };

  return (
    <div className="space-y-6">
      {/* Main Navigation */}
      <div className="bg-white rounded-xl shadow-sm p-2 border border-gray-100 flex gap-2 overflow-x-auto">
        <button onClick={() => setActiveTab('competitions')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'competitions' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
          <Settings size={16} /> Competitions
        </button>
        <button onClick={() => setActiveTab('forms')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'forms' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
          <FileText size={16} /> Forms
        </button>
        <button onClick={() => setActiveTab('scoutingTeams')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'scoutingTeams' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
          <Users size={16} /> Scouting Teams
        </button>
        <button onClick={() => setActiveTab('analytics')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'analytics' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
          <BarChart size={16} /> Analytics
        </button>
        <button onClick={() => setActiveTab('superscout')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'superscout' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
          <ClipboardList size={16} /> Superscouter
        </button>
        <button onClick={() => setActiveTab('picklists')} className={`flex-1 min-w-[120px] px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'picklists' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
          <ClipboardList size={16} /> Pick Lists
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'competitions' && <CompetitionManager />}
        {activeTab === 'forms' && <FormManager selectedCompetition={activeCompetition} onCompetitionUpdate={handleCompetitionUpdate} />}
        {activeTab === 'scoutingTeams' && <ScoutingTeams selectedCompetition={activeCompetition} />}
        {activeTab === 'picklists' && <PickListManager selectedCompetition={activeCompetition} onCompetitionUpdate={handleCompetitionUpdate} />}

        {/* --- SUPERSCOUTER TAB --- */}
        {activeTab === 'superscout' && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-xl font-bold text-gray-900">Superscouter Master Notes</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Team Number..." 
                  value={targetTeam}
                  onChange={(e) => setTargetTeam(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-48 font-bold text-blue-600"
                />
              </div>
            </div>

            <div className="relative group">
              {isEditing ? (
                <textarea
                  value={draftNotes} // Typing into draft, not scouterNotes
                  onChange={(e) => setDraftNotes(e.target.value)}
                  className="w-full h-96 p-4 border-2 border-blue-100 rounded-xl focus:border-blue-500 outline-none resize-none bg-blue-50/20 transition-all font-medium text-sm leading-relaxed"
                  placeholder={`Drafting notes for Team ${targetTeam}... (Not visible in Analytics yet)`}
                />
              ) : (
                <div className="w-full h-96 p-6 border border-gray-200 rounded-xl bg-gray-50 overflow-y-auto text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {scouterNotes || <span className="text-gray-400 italic">No saved notes. Click Edit to begin.</span>}
                </div>
              )}

              <div className="absolute bottom-4 right-4 flex gap-2">
                {isEditing && (
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest bg-white text-red-600 border border-red-100 hover:bg-red-50 transition-all shadow-md"
                  >
                    <X size={14} /> Cancel
                  </button>
                )}
                
                <button
                  onClick={handleEditToggle}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all shadow-md ${
                    isEditing ? 'bg-gray-800 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Edit3 size={14} />
                  {isEditing ? 'Editing Mode' : 'Edit'}
                </button>
                
                <button
                  onClick={handleSaveNotes}
                  disabled={isSaving || !targetTeam}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all shadow-md ${
                    isSaving || !targetTeam 
                      ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Save size={14} />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- ANALYTICS TAB --- */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="bg-gray-100 rounded-lg p-2 flex gap-2">
              <button onClick={() => setAnalyticsTab('responses')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsTab === 'responses' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}>
                Responses
              </button>
              <button onClick={() => setAnalyticsTab('teamLookup')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsTab === 'teamLookup' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}>
                Team Lookup
              </button>
              <button onClick={() => setAnalyticsTab('schedule')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${analyticsTab === 'schedule' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-700 hover:bg-gray-200'}`}>
                Schedule
              </button>
            </div>

            <div>
              {analyticsTab === 'responses' && <ResponseViewer selectedCompetition={activeCompetition} />}
              
              {analyticsTab === 'teamLookup' && (
                <TeamLookup 
                  selectedCompetition={activeCompetition} 
                  superscoutNotes={scouterNotes} // Only passes what has been SAVED
                  targetTeam={targetTeam} 
                />
              )}
              
              {analyticsTab === 'schedule' && <MatchSchedule selectedCompetition={activeCompetition} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};