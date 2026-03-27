import React, { useState, useEffect, useMemo } from 'react';
import { UserCog, Save, RefreshCw, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Competition } from '../types/competition.types';

interface UserRecord {
  uid: string;
  email: string;
  role: string;
  scouterName: string | null;
}

interface ManageUsersProps {
  selectedCompetition: Competition | null;
}

export const ManageUsers: React.FC<ManageUsersProps> = ({ selectedCompetition }) => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});

  const availableScouterNames = useMemo(() => {
    const names = new Set<string>();
    (selectedCompetition?.scoutingTeams ?? []).forEach(team => {
      team.members.forEach(m => { if (m.name.trim()) names.add(m.name.trim()); });
    });
    (selectedCompetition?.scoutingAssignments ?? []).forEach(a => {
      a.scouts.forEach(s => { if (s.trim()) names.add(s.trim()); });
    });
    return Array.from(names).sort();
  }, [selectedCompetition]);

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await authApi.getAllUsers();
      setUsers(data);
      const drafts: Record<string, string> = {};
      data.forEach(u => { drafts[u.uid] = u.scouterName ?? ''; });
      setDraftNames(drafts);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveScouterName = async (uid: string) => {
    setSaving(uid);
    try {
      const name = draftNames[uid]?.trim() || null;
      await authApi.updateScouterName(uid, name);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, scouterName: name } : u));
    } catch (err) {
      console.error('Error saving scouter name:', err);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const hasChanged = (uid: string) => {
    const user = users.find(u => u.uid === uid);
    if (!user) return false;
    return (draftNames[uid] ?? '') !== (user.scouterName ?? '');
  };

  const promoteUser = async (uid: string) => {
    setActionPending(uid);
    try {
      await authApi.promoteUser(uid);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: 'admin' } : u));
    } catch (err) {
      console.error('Error promoting user:', err);
      alert('Failed to promote user. Please try again.');
    } finally {
      setActionPending(null);
    }
  };

  const demoteUser = async (uid: string) => {
    setActionPending(uid);
    try {
      await authApi.demoteUser(uid);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, role: 'user' } : u));
    } catch (err) {
      console.error('Error demoting user:', err);
      alert('Failed to demote user. Please try again.');
    } finally {
      setActionPending(null);
    }
  };

  const deleteUser = async (uid: string, email: string) => {
    if (!window.confirm(`Delete account "${email}"? This cannot be undone.`)) return;
    setActionPending(uid);
    try {
      await authApi.deleteUser(uid);
      setUsers(prev => prev.filter(u => u.uid !== uid));
      setDraftNames(prev => { const next = { ...prev }; delete next[uid]; return next; });
    } catch (err) {
      console.error('Error deleting user:', err);
      alert('Failed to delete user. Please try again.');
    } finally {
      setActionPending(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <UserCog size={22} className="text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Manage Users</h2>
          </div>
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
        <p className="text-xs text-gray-400 ml-9">
          Link each account to a scouter name so My Assignments and Your Next Match work automatically.
        </p>
      </div>

      {!selectedCompetition && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          No active competition selected — scouter name suggestions are unavailable, but you can still type names manually.
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-300 animate-pulse font-black uppercase tracking-widest">Loading Users…</div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center text-gray-400">No users found.</div>
      ) : (
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.uid} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex-shrink-0 ${
                user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {user.role === 'admin' ? 'Admin' : 'User'}
              </span>
              <span className="font-medium text-gray-800 text-sm flex-1 min-w-0 truncate">{user.email}</span>
              {availableScouterNames.length > 0 ? (
                <select
                  value={draftNames[user.uid] ?? ''}
                  onChange={e => setDraftNames(prev => ({ ...prev, [user.uid]: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none min-w-[180px] flex-shrink-0"
                >
                  <option value="">-- No scouter linked --</option>
                  {availableScouterNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Scouter name…"
                  value={draftNames[user.uid] ?? ''}
                  onChange={e => setDraftNames(prev => ({ ...prev, [user.uid]: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none min-w-[180px] flex-shrink-0"
                />
              )}
              <button
                onClick={() => saveScouterName(user.uid)}
                disabled={saving === user.uid || !hasChanged(user.uid)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-all flex-shrink-0"
              >
                <Save size={13} />
                {saving === user.uid ? 'Saving…' : 'Save'}
              </button>

              {/* ── Role & delete actions (disabled for own account) ── */}
              {currentUser?.uid !== user.uid && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {user.role !== 'admin' ? (
                    <button
                      onClick={() => promoteUser(user.uid)}
                      disabled={actionPending === user.uid}
                      title="Promote to Admin"
                      className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ShieldCheck size={13} />
                      Promote
                    </button>
                  ) : (
                    <button
                      onClick={() => demoteUser(user.uid)}
                      disabled={actionPending === user.uid}
                      title="Demote to User"
                      className="px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ShieldOff size={13} />
                      Demote
                    </button>
                  )}
                  <button
                    onClick={() => deleteUser(user.uid, user.email)}
                    disabled={actionPending === user.uid}
                    title="Delete Account"
                    className="px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
