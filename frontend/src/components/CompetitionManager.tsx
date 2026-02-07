import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Calendar, CheckSquare, Plus, X, Save, AlertTriangle } from 'lucide-react';
import type { Competition, CompetitionStatus } from '../types/competition.types';
import { competitionApi } from '../services/api';

interface CompetitionManagerProps {
    onSelect?: (id: string) => void;
}

export const CompetitionManager: React.FC<CompetitionManagerProps> = ({ onSelect }) => {
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    const [formData, setFormData] = useState({
        name: '',
        season: new Date().getFullYear().toString(),
        status: 'draft' as CompetitionStatus,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });

    useEffect(() => {
        loadCompetitions();
    }, []);

    const loadCompetitions = async () => {
        try {
            const data = await competitionApi.getAll();
            setCompetitions(data);
        } catch (error) {
            console.error('Error loading competitions:', error);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            await competitionApi.delete(deleteConfirmId);
            setDeleteConfirmId(null);
            await loadCompetitions();
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await competitionApi.update(editingId, formData);
            } else {
                await competitionApi.create(formData);
            }
            setIsFormOpen(false);
            setEditingId(null);
            await loadCompetitions();
        } catch (error) {
            console.error('Save failed:', error);
        }
    };

    const getStatusColor = (status: CompetitionStatus) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'completed': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Manage Competitions</h2>
                <button 
                    onClick={() => { setEditingId(null); setIsFormOpen(true); }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold shadow-md"
                >
                    <Plus size={20} /> New Competition
                </button>
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-200">
                        <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="text-red-500" size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Are you sure?</h3>
                        <p className="text-gray-500 text-sm mb-6">
                            This action cannot be undone. All forms and scouting data for <b>{competitions.find(c => c.id === deleteConfirmId)?.name}</b> will be permanently removed.
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmDelete}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FORM MODAL (Restored logic) */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
                        <button onClick={() => setIsFormOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                            <X size={24} />
                        </button>
                        <h3 className="text-xl font-bold mb-6 text-gray-800">{editingId ? 'Edit Competition' : 'New Competition'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Competition Name</label>
                                <input 
                                    required
                                    className="w-full bg-gray-50 border-gray-200 rounded-lg px-3 py-2 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Season</label>
                                    <input 
                                        className="w-full bg-gray-50 border-gray-200 rounded-lg px-3 py-2 font-bold"
                                        value={formData.season}
                                        onChange={e => setFormData({...formData, season: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</label>
                                    <select 
                                        className="w-full bg-gray-50 border-gray-200 rounded-lg px-3 py-2 font-bold"
                                        value={formData.status}
                                        onChange={e => setFormData({...formData, status: e.target.value as CompetitionStatus})}
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2">
                                <Save size={18} /> {editingId ? 'Update' : 'Create'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* COMPETITION LIST */}
            <div className="grid gap-4">
                {competitions.map((comp) => (
                    <div key={comp.id} className="bg-white rounded-xl shadow-sm p-6 border border-transparent hover:border-blue-100 transition-all group">
                        <div className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-lg font-bold text-gray-800">{comp.name}</h3>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${getStatusColor(comp.status)}`}>
                                        {comp.status}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">{comp.season} SEASON</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onSelect?.(comp.id)}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-600 hover:text-white transition-all font-bold text-xs"
                                >
                                    <CheckSquare size={16} /> Select
                                </button>
                                <button onClick={() => { setEditingId(comp.id); setFormData(comp); setIsFormOpen(true); }} className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                    <Edit2 size={18} />
                                </button>
                                <button 
                                    onClick={() => setDeleteConfirmId(comp.id)} 
                                    className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};