import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Calendar } from 'lucide-react';
import type { Competition, CompetitionStatus } from '../types/competition.types';
import { competitionApi } from '../services/api';

export const CompetitionManager: React.FC = () => {
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [showForm, setShowForm] = useState(false);
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
            // console.log('Loaded competitions:', data);
            setCompetitions(data);
        } catch (error) {
            console.error('Error loading competitions:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                // console.log('Updating competition:', editingId, formData);
                await competitionApi.update(editingId, formData);
            } else {
                // console.log('Creating competition:', formData);
                await competitionApi.create(formData);
            }
            await loadCompetitions();
            resetForm();
        } catch (error) {
            console.error('Error saving competition:', error);
            alert('Error saving competition: ' + (error as any).message);
        }
    };

    const handleEdit = (competition: Competition) => {
        // console.log('Editing competition:', competition);
        setEditingId(competition.id);

        // Parse dates properly
        const startDate = competition.startDate ? new Date(competition.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const endDate = competition.endDate ? new Date(competition.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

        setFormData({
            name: competition.name || '',
            season: competition.season || new Date().getFullYear().toString(),
            status: competition.status || 'draft',
            startDate: startDate,
            endDate: endDate,
        });
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this competition?')) return;

        try {
            await competitionApi.delete(id);
            await loadCompetitions();
        } catch (error) {
            console.error('Error deleting competition:', error);
            alert('Error deleting competition');
        }
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({
            name: '',
            season: new Date().getFullYear().toString(),
            status: 'draft',
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
        });
    };

    const getStatusColor = (status: CompetitionStatus) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'completed': return 'bg-blue-100 text-blue-800';
            case 'archived': return 'bg-gray-100 text-gray-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'No date';

        try {
            // For date-only strings (YYYY-MM-DD), parse as local date to avoid timezone issues
            const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
            const date = new Date(year, month - 1, day); // month is 0-indexed

            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.error('Invalid date:', dateString);
                return 'Invalid date';
            }

            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', dateString, error);
            return 'Invalid date';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Manage Competitions</h2>
                <button
                    onClick={() => {
                        resetForm();
                        setShowForm(!showForm);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                >
                    <Plus size={20} />
                    New Competition
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-xl font-semibold mb-4">
                        {editingId ? 'Edit Competition' : 'Create Competition'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Competition Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g., 2024 Utah Regional"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Season
                                </label>
                                <input
                                    type="text"
                                    value={formData.season}
                                    onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="2024"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as CompetitionStatus })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                            >
                                {editingId ? 'Update' : 'Create'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid gap-4">
                {competitions.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                        <Calendar size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No competitions yet. Create one to get started!</p>
                    </div>
                ) : (
                    competitions.map((competition) => {
                        // console.log('Competition dates:', {
                        //     id: competition.id,
                        //     startDate: competition.startDate,
                        //     endDate: competition.endDate,
                        //     startType: typeof competition.startDate,
                        //     endType: typeof competition.endDate
                        // });
                        return (
                            <div key={competition.id} className="bg-white rounded-lg shadow-sm p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-semibold">{competition.name}</h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(competition.status)}`}>
                                                {competition.status}
                                            </span>
                                        </div>
                                        <p className="text-gray-600 mb-2">Season: {competition.season}</p>
                                        <p className="text-sm text-gray-500">
                                            {formatDate(competition.startDate)} - {formatDate(competition.endDate)}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(competition)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                                        >
                                            <Edit2 size={20} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(competition.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}

            </div>
        </div>
    );
};