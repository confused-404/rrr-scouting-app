import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Calendar, CheckSquare, Plus } from 'lucide-react';
import type { Competition, CompetitionStatus } from '../types/competition.types';
import { competitionApi } from '../services/api';

interface CompetitionManagerProps {
    onSelect?: (id: string) => void;
}

export const CompetitionManager: React.FC<CompetitionManagerProps> = ({ onSelect }) => {
    const [competitions, setCompetitions] = useState<Competition[]>([]);

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

    const getStatusColor = (status: CompetitionStatus) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'completed': return 'bg-blue-100 text-blue-800';
            case 'archived': return 'bg-gray-100 text-gray-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Manage Competitions</h2>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2">
                    <Plus size={20} />
                    New Competition
                </button>
            </div>

            <div className="grid gap-4">
                {competitions.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                        <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No competitions yet.</p>
                    </div>
                ) : (
                    competitions.map((competition) => (
                        <div key={competition.id} className="bg-white rounded-lg shadow-sm p-6 border border-transparent hover:border-emerald-200 transition-colors">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-xl font-semibold">{competition.name}</h3>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(competition.status)}`}>
                                            {competition.status}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 mb-1 text-sm">Season: {competition.season}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => onSelect?.(competition.id)}
                                        className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition-colors border border-emerald-100"
                                    >
                                        <CheckSquare size={18} />
                                        <span className="text-sm font-medium">Select</span>
                                    </button>
                                    
                                    <div className="h-8 w-[1px] bg-gray-200 mx-1" />

                                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-md">
                                        <Edit2 size={20} />
                                    </button>
                                    <button className="p-2 text-red-600 hover:bg-red-50 rounded-md">
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};