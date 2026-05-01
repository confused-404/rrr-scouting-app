import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Calendar, Plus, X, Save, AlertTriangle, Upload, Image as ImageIcon } from 'lucide-react';
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import type { Competition, CompetitionStatus } from '../types/competition.types';
import { competitionApi } from '../services/api';
import { auth, storage } from '../config/firebase';
import { compressImageFile } from '../utils/imageUpload';
import { createLogger, formatErrorForLogging } from '../utils/logger';

const sanitizeFileName = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'pit-map.jpg';

const competitionManagerLogger = createLogger('CompetitionManager');

export const CompetitionManager: React.FC<{ onCompetitionUpdate?: () => void }> = ({ onCompetitionUpdate }) => {
    const [competitions, setCompetitions] = useState<Competition[]>([]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isUploadingPitMap, setIsUploadingPitMap] = useState(false);
    const [isWarmingCache, setIsWarmingCache] = useState(false);
    const [cacheWarmMessage, setCacheWarmMessage] = useState('');
    
    const [formData, setFormData] = useState({
        name: '',
        season: new Date().getFullYear().toString(),
        status: 'draft' as CompetitionStatus,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        eventKey: '',
        pitMapImageUrl: '',
        pitMapImagePath: '',
    });

    const loadCompetitions = async () => {
        try {
            const data = await competitionApi.getAll();

            if (!Array.isArray(data)) {
                console.warn('Expected competitions to be an array, got:', data);
                setCompetitions([]);
                return;
            }

            setCompetitions(data);
        } catch (error) {
            console.error('Error loading competitions:', error);
            setCompetitions([]);
        }
    };

    useEffect(() => {
        loadCompetitions();
    }, []);

    const handleConfirmDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            await competitionApi.delete(deleteConfirmId);
            setDeleteConfirmId(null);
            await loadCompetitions();
            if (onCompetitionUpdate) onCompetitionUpdate();
        } catch (error) {
            console.error('Delete failed:', error);
        }
    };

    const handleWarmCache = async () => {
        const activeCompetition = competitions.find((competition) => competition.status === 'active');
        if (!activeCompetition) {
            setCacheWarmMessage('No active competition to warm.');
            return;
        }

        setIsWarmingCache(true);
        setCacheWarmMessage('');

        try {
            const result = await competitionApi.warmCache(activeCompetition.id);
            setCacheWarmMessage(
                result.message || `Warm cache job started for ${activeCompetition.eventKey || activeCompetition.name}.`,
            );
        } catch (error) {
            competitionManagerLogger.error('Competition cache warm failed', {
                competitionId: activeCompetition.id,
                error: formatErrorForLogging(error),
            });
            setCacheWarmMessage('Could not warm the cache.');
        } finally {
            setIsWarmingCache(false);
        }
    };

    const handleEdit = (comp: Competition) => {
        setEditingId(comp.id);
        setFormData({
            name: comp.name,
            season: comp.season,
            status: comp.status,
            startDate: comp.startDate,
            endDate: comp.endDate,
            eventKey: comp.eventKey || '',
            pitMapImageUrl: comp.pitMapImageUrl || '',
            pitMapImagePath: comp.pitMapImagePath || '',
        });
        setIsFormOpen(true);
    };

    const handlePitMapUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please choose an image file.');
            event.target.value = '';
            return;
        }

        setIsUploadingPitMap(true);
        try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                alert('You must be logged in before uploading a pit map.');
                return;
            }

            const compressedFile = await compressImageFile(file, {
                maxDimension: 2000,
                quality: 0.82,
                outputType: 'image/jpeg',
            });
            const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}`;
            const storagePath = [
                'competition-pit-maps',
                currentUser.uid,
                `${Date.now()}-${uniqueId}-${sanitizeFileName(compressedFile.name)}`,
            ].join('/');
            const storageRef = ref(storage, storagePath);

            await new Promise<void>((resolve, reject) => {
                const uploadTask = uploadBytesResumable(storageRef, compressedFile, {
                    contentType: compressedFile.type,
                    customMetadata: {
                        ownerUid: currentUser.uid,
                    },
                });

                uploadTask.on('state_changed', undefined, reject, () => resolve());
            });

            const pitMapImageUrl = await getDownloadURL(storageRef);
            setFormData((prev) => ({ ...prev, pitMapImageUrl, pitMapImagePath: storagePath }));
        } catch (error) {
            console.error('Pit map upload failed:', error);
            alert('Could not process this image. Please try another file.');
        } finally {
            setIsUploadingPitMap(false);
            event.target.value = '';
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
            setFormData({
                name: '',
                season: new Date().getFullYear().toString(),
                status: 'draft',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
                eventKey: '',
                pitMapImageUrl: '',
                pitMapImagePath: '',
            });
            await loadCompetitions();
            if (onCompetitionUpdate) onCompetitionUpdate();
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
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Competition Settings</h2>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleWarmCache}
                        disabled={isWarmingCache}
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-black flex items-center gap-2 font-bold shadow-md transition-all active:scale-95 disabled:opacity-60"
                    >
                        {isWarmingCache ? 'Warming cache...' : 'Warm Active Cache'}
                    </button>
                    <button 
                        onClick={() => { setEditingId(null); setIsFormOpen(true); }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold shadow-md transition-all active:scale-95"
                    >
                        <Plus size={20} /> New Event
                    </button>
                </div>
            </div>
            {cacheWarmMessage && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    {cacheWarmMessage}
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteConfirmId && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in duration-200">
                        <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="text-red-500" size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Deletion</h3>
                        <p className="text-gray-500 text-sm mb-6">
                            Are you sure? This will permanently delete all associated scouting forms and records. This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancel</button>
                            <button onClick={handleConfirmDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200">Delete Forever</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE/EDIT FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
                        <button onClick={() => setIsFormOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={24} /></button>
                        <h3 className="text-xl font-bold mb-6 text-gray-800">{editingId ? 'Edit Competition' : 'New Competition'}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Name</label>
                                <input required className="w-full bg-gray-50 border-gray-200 rounded-lg px-3 py-2 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Season</label>
                                    <input className="w-full bg-gray-50 border-gray-200 rounded-lg px-3 py-2 font-bold" value={formData.season} onChange={e => setFormData({...formData, season: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Event Key</label>
                                    <input className="w-full bg-gray-50 border-gray-200 rounded-lg px-3 py-2 font-bold" value={formData.eventKey} onChange={e => setFormData({...formData, eventKey: e.target.value})} placeholder="e.g. 2024cmptx" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</label>
                                <select className="w-full bg-gray-50 border-gray-200 rounded-lg px-3 py-2 font-bold" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as CompetitionStatus})}>
                                    <option value="draft">Draft</option>
                                    <option value="active">Active</option>
                                    <option value="completed">Completed</option>
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Pit Map Image</label>
                                <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer font-bold text-sm text-gray-700">
                                    <Upload size={16} />
                                    {isUploadingPitMap ? 'Processing image...' : 'Upload Pit Map'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePitMapUpload}
                                        disabled={isUploadingPitMap}
                                    />
                                </label>

                                {formData.pitMapImageUrl ? (
                                    <div className="border border-gray-200 rounded-xl p-2 bg-white">
                                        <img
                                            src={formData.pitMapImageUrl}
                                            alt="Pit map preview"
                                            className="w-full max-h-48 object-contain rounded-lg bg-gray-50"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const previousPath = formData.pitMapImagePath;
                                                setFormData({ ...formData, pitMapImageUrl: '', pitMapImagePath: '' });
                                                if (previousPath) {
                                                    void deleteObject(ref(storage, previousPath)).catch(() => {});
                                                }
                                            }}
                                            className="mt-2 w-full py-2 text-sm font-bold rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                                        >
                                            Remove Pit Map
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
                                        <ImageIcon size={14} />
                                        No pit map uploaded yet.
                                    </div>
                                )}
                            </div>

                            <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-2">
                                <Save size={18} /> {editingId ? 'Update Changes' : 'Create Event'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* LIST VIEW */}
            <div className="grid gap-4">
                {competitions.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center border-2 border-dashed border-gray-100">
                        <Calendar size={48} className="mx-auto mb-4 opacity-10" />
                        <p className="text-gray-400 font-medium italic">No competitions found. Create one to get started.</p>
                    </div>
                ) : (
                    competitions.map((comp) => (
                        <div key={comp.id} className="bg-white rounded-xl shadow-sm p-6 border border-transparent hover:border-blue-100 transition-all flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="text-lg font-bold text-gray-800">{comp.name}</h3>
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${getStatusColor(comp.status)}`}>
                                        {comp.status}
                                    </span>
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{comp.season} Season</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleEdit(comp)} className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors">
                                    <Edit2 size={20} />
                                </button>
                                <button onClick={() => setDeleteConfirmId(comp.id)} className="p-2.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
