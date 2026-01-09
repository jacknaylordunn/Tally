
import React, { useEffect, useState } from 'react';
import { getCompanyStaff, updateUserProfile, deleteUser } from '../services/api';
import { User } from '../types';
import { Search, Save, Edit2, X, DollarSign, Briefcase, Trash2, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TableRowSkeleton } from '../components/Skeleton';

export const AdminStaff = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRate, setEditRate] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user || !user.currentCompanyId) return;
    setLoading(true);
    const data = await getCompanyStaff(user.currentCompanyId);
    setStaff(data);
    setLoading(false);
  };

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (u: User) => {
      setEditingUser(u);
      setEditRate(u.customHourlyRate?.toString() || '');
      setEditPosition(u.position || '');
  };

  const handleSave = async () => {
      if (!editingUser) return;
      setSaving(true);
      try {
          await updateUserProfile(editingUser.id, {
              customHourlyRate: parseFloat(editRate) || undefined,
              position: editPosition
          });
          await loadData();
          setEditingUser(null);
      } catch (e) {
          console.error(e);
      } finally {
          setSaving(false);
      }
  };

  const handleDelete = async () => {
      if (!editingUser) return;
      if (confirm(`Are you sure you want to remove ${editingUser.name} from the company? This cannot be undone.`)) {
          setSaving(true);
          await deleteUser(editingUser.id);
          await loadData();
          setEditingUser(null);
          setSaving(false);
      }
  };

  const exportUserData = () => {
     if(!editingUser) return;
     const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(editingUser, null, 2));
     const downloadAnchorNode = document.createElement('a');
     downloadAnchorNode.setAttribute("href", dataStr);
     downloadAnchorNode.setAttribute("download", `${editingUser.name.replace(' ', '_')}_data.json`);
     document.body.appendChild(downloadAnchorNode);
     downloadAnchorNode.click();
     downloadAnchorNode.remove();
  }

  return (
    <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Staff Management</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage employees, roles, and pay rates.</p>
            </div>
        </header>

        {/* Search */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search name or email..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                />
            </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500">
                        <tr>
                            <th className="px-6 py-4">Employee</th>
                            <th className="px-6 py-4">Position</th>
                            <th className="px-6 py-4">Hourly Rate</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {loading ? (
                            <>
                                <TableRowSkeleton />
                                <TableRowSkeleton />
                            </>
                        ) : filteredStaff.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center">No staff found. Share your invite code to get started.</td></tr>
                        ) : filteredStaff.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 flex items-center justify-center font-bold">
                                            {u.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900 dark:text-white">{u.name}</p>
                                            <p className="text-xs text-slate-500">{u.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {u.position || <span className="text-slate-400 italic">None</span>}
                                </td>
                                <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">
                                    {u.customHourlyRate ? `$${u.customHourlyRate.toFixed(2)}` : <span className="text-slate-400 text-xs">Default</span>}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button 
                                        onClick={() => handleEdit(u)}
                                        className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
             </div>
        </div>

        {/* Modal */}
        {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border dark:border-slate-700">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Staff</h2>
                        <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Employee</p>
                            <p className="font-bold text-lg text-slate-900 dark:text-white">{editingUser.name}</p>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Position / Title</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text"
                                    value={editPosition}
                                    onChange={(e) => setEditPosition(e.target.value)}
                                    placeholder="e.g. Senior Medic"
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Hourly Rate</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={editRate}
                                    onChange={(e) => setEditRate(e.target.value)}
                                    placeholder="Leave empty for default"
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between">
                             <button onClick={exportUserData} className="text-xs text-brand-600 font-medium flex items-center space-x-1 hover:underline">
                                <Download className="w-3 h-3" />
                                <span>Export Data (GDPR)</span>
                             </button>
                             <button onClick={handleDelete} className="text-xs text-red-500 font-medium flex items-center space-x-1 hover:underline">
                                <Trash2 className="w-3 h-3" />
                                <span>Remove Staff</span>
                             </button>
                        </div>
                    </div>

                     <div className="flex gap-3">
                         <button 
                            onClick={() => setEditingUser(null)}
                            className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center space-x-2"
                        >
                            <Save className="w-4 h-4" />
                            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
