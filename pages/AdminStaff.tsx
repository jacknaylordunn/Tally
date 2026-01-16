
import React, { useEffect, useState } from 'react';
import { getCompanyStaff, updateUserProfile, removeUserFromCompany, getCompany } from '../services/api';
import { User, Company, UserRole } from '../types';
import { Search, Save, Edit2, X, DollarSign, Briefcase, Trash2, Download, ArrowRightLeft, Users, ShieldCheck, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TableRowSkeleton } from '../components/Skeleton';
import { deleteField } from 'firebase/firestore';

export const AdminStaff = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<User[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRate, setEditRate] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [saving, setSaving] = useState(false);

  // Bulk Update Modal
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkOldRate, setBulkOldRate] = useState('');
  const [bulkNewRate, setBulkNewRate] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user || !user.currentCompanyId) return;
    setLoading(true);
    const [staffData, companyData] = await Promise.all([
        getCompanyStaff(user.currentCompanyId),
        getCompany(user.currentCompanyId)
    ]);
    setStaff(staffData);
    setCompany(companyData);
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
          const updates: any = {
              position: editPosition
          };

          // Handle Custom Rate (Set or Unset)
          if (editRate && editRate.trim() !== '' && !isNaN(parseFloat(editRate))) {
              updates.customHourlyRate = parseFloat(editRate);
          } else {
              // If empty, remove the field to revert to company default
              updates.customHourlyRate = deleteField();
          }

          await updateUserProfile(editingUser.id, updates);
          await loadData();
          setEditingUser(null);
      } catch (e) {
          console.error(e);
          alert("Failed to update staff member.");
      } finally {
          setSaving(false);
      }
  };

  const handleDelete = async () => {
      if (!editingUser) return;
      if (confirm(`Are you sure you want to remove ${editingUser.name} from the company? They will keep their account but lose access to this team.`)) {
          setSaving(true);
          try {
            await removeUserFromCompany(editingUser.id);
            await loadData();
            setEditingUser(null);
          } catch (e) {
            console.error(e);
            alert("Failed to remove staff.");
          } finally {
            setSaving(false);
          }
      }
  };

  const handleApprove = async () => {
      if (!editingUser) return;
      setSaving(true);
      try {
          await updateUserProfile(editingUser.id, { isApproved: true });
          await loadData();
          setEditingUser(null);
      } catch (e) {
          console.error(e);
      } finally {
          setSaving(false);
      }
  };

  const handlePromote = async () => {
      if (!editingUser) return;
      if (!confirm(`Are you sure you want to make ${editingUser.name} an Admin? They will have full access to company settings.`)) return;
      
      setSaving(true);
      try {
          await updateUserProfile(editingUser.id, { 
              role: UserRole.ADMIN,
              isApproved: true // Implicit approval
          });
          await loadData();
          setEditingUser(null);
      } catch (e) {
          console.error(e);
          alert("Failed to promote user.");
      } finally {
          setSaving(false);
      }
  };

  const handleBulkUpdate = async () => {
      if (!bulkOldRate || !bulkNewRate || !company) return;
      
      const oldR = parseFloat(bulkOldRate);
      const newR = parseFloat(bulkNewRate);
      
      // Find affected users (match effective rate)
      const affectedUsers = staff.filter(u => {
          const effectiveRate = u.customHourlyRate ?? company.settings.defaultHourlyRate ?? 0;
          return Math.abs(effectiveRate - oldR) < 0.01;
      });

      if (affectedUsers.length === 0) {
          alert("No staff members found with that rate.");
          return;
      }

      if (!confirm(`This will update the hourly rate for ${affectedUsers.length} staff members from ${oldR} to ${newR}. Continue?`)) return;

      setSaving(true);
      try {
          await Promise.all(affectedUsers.map(u => 
             updateUserProfile(u.id, { customHourlyRate: newR })
          ));
          await loadData();
          setIsBulkOpen(false);
          setBulkOldRate('');
          setBulkNewRate('');
      } catch (e) {
          console.error(e);
          alert("Failed to update rates.");
      } finally {
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

  const currency = company?.settings.currency || '£';

  return (
    <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Staff Management</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage employees, roles, and pay rates.</p>
            </div>
            <button 
                id="staff-bulk-btn"
                onClick={() => setIsBulkOpen(true)}
                className="glass-panel text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg flex items-center space-x-2 font-medium hover:bg-slate-100 dark:hover:bg-white/10 transition"
            >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Bulk Adjust Rates</span>
            </button>
        </header>

        {/* Search */}
        <div className="glass-panel p-4 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search name or email..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
            </div>
        </div>

        {/* Table */}
        <div className="glass-panel rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-white/5 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-6 py-4">Employee</th>
                            <th className="px-6 py-4">Position</th>
                            <th className="px-6 py-4">Hourly Rate</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {loading ? (
                            <>
                                <TableRowSkeleton />
                                <TableRowSkeleton />
                            </>
                        ) : filteredStaff.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">No staff found. Share your invite code to get started.</td></tr>
                        ) : filteredStaff.map((u) => {
                            const effectiveRate = u.customHourlyRate ?? company?.settings.defaultHourlyRate ?? 0;
                            const isCustom = u.customHourlyRate !== undefined;
                            const isPending = u.isApproved === false;
                            
                            return (
                                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400' : 'bg-brand-50 text-brand-600 dark:bg-brand-900/50 dark:text-brand-400'}`}>
                                                {u.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-1">
                                                    <p className="font-medium text-slate-900 dark:text-white">{u.name}</p>
                                                    {u.role === 'admin' && <ShieldCheck className="w-3 h-3 text-purple-500" />}
                                                </div>
                                                <p className="text-xs text-slate-500">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {u.position || <span className="text-slate-400 italic">None</span>}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">
                                        {currency}{effectiveRate.toFixed(2)}
                                        {!isCustom && (
                                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                Default
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isPending ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50">
                                                <Clock className="w-3 h-3 mr-1" /> Pending
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/50">
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => handleEdit(u)}
                                            className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
             </div>
        </div>

        {/* Edit Modal */}
        {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Staff</h2>
                        <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500">Employee</p>
                                <p className="font-bold text-lg text-slate-900 dark:text-white">{editingUser.name}</p>
                            </div>
                            {editingUser.role !== 'admin' && (
                                <button 
                                    onClick={handlePromote}
                                    className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 hover:bg-purple-200 dark:hover:bg-purple-900/50 px-3 py-1.5 rounded-lg transition flex items-center space-x-1 border border-purple-200 dark:border-purple-500/20"
                                >
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Make Admin</span>
                                </button>
                            )}
                        </div>

                        {editingUser.isApproved === false && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 p-4 rounded-xl flex items-center justify-between">
                                <div className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">Account Pending</div>
                                <button 
                                    onClick={handleApprove}
                                    className="bg-yellow-600 dark:bg-yellow-800 text-white dark:text-yellow-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-yellow-700 transition"
                                >
                                    Approve Now
                                </button>
                            </div>
                        )}
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Position / Title</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text"
                                    value={editPosition}
                                    onChange={(e) => setEditPosition(e.target.value)}
                                    placeholder="e.g. Senior Medic"
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Hourly Rate</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">{currency}</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={editRate}
                                    onChange={(e) => setEditRate(e.target.value)}
                                    placeholder={`Default: ${company?.settings.defaultHourlyRate}`}
                                    className="w-full pl-8 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Leave empty to use company default ({currency}{company?.settings.defaultHourlyRate})</p>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-white/5 flex justify-between">
                             <button onClick={exportUserData} className="text-xs text-brand-600 dark:text-brand-400 font-medium flex items-center space-x-1 hover:underline">
                                <Download className="w-3 h-3" />
                                <span>Export Data (GDPR)</span>
                             </button>
                             <button onClick={handleDelete} className="text-xs text-red-500 dark:text-red-400 font-medium flex items-center space-x-1 hover:underline">
                                <Trash2 className="w-3 h-3" />
                                <span>Remove Staff</span>
                             </button>
                        </div>
                    </div>

                     <div className="flex gap-3">
                         <button 
                            onClick={() => setEditingUser(null)}
                            className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition"
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

        {/* Bulk Update Modal */}
        {isBulkOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div id="bulk-update-container" className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Bulk Adjust Rates</h2>
                        <button id="bulk-close-btn" onClick={() => setIsBulkOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4 mb-6">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Find staff on a specific rate and update them all at once.</p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Find Rate</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">{currency}</span>
                                    <input 
                                        type="number" step="0.01"
                                        value={bulkOldRate} onChange={(e) => setBulkOldRate(e.target.value)}
                                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                        placeholder="12.21"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Replace With</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">{currency}</span>
                                    <input 
                                        type="number" step="0.01"
                                        value={bulkNewRate} onChange={(e) => setBulkNewRate(e.target.value)}
                                        className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                        placeholder="12.56"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl flex items-start space-x-3 border border-slate-200 dark:border-white/5">
                            <Users className="w-5 h-5 text-brand-500 mt-0.5" />
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                                This will identify any staff members (including those on default rates) currently earning the <b>Find Rate</b>, and set their custom hourly rate to the <b>Replace With</b> rate.
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                         <button 
                            onClick={() => setIsBulkOpen(false)}
                            className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleBulkUpdate}
                            disabled={saving || !bulkOldRate || !bulkNewRate}
                            className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center space-x-2 disabled:opacity-70"
                        >
                            <ArrowRightLeft className="w-4 h-4" />
                            <span>{saving ? 'Updating...' : 'Update All'}</span>
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
