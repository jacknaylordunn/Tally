
import React, { useEffect, useState } from 'react';
import { getShifts, updateShift, deleteShift, getCompany } from '../services/api';
import { Shift, Company } from '../types';
import { Download, Edit2, Search, Calendar, ChevronLeft, ChevronRight, X, Save, Clock, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadShiftsCSV } from '../utils/csv';
import { TableRowSkeleton } from '../components/Skeleton';

export const AdminTimesheets = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit Modal State
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user || !user.currentCompanyId) return;
    setLoading(true);
    const [shiftsData, companyData] = await Promise.all([
        getShifts(user.currentCompanyId),
        getCompany(user.currentCompanyId)
    ]);
    setShifts(shiftsData);
    setCompany(companyData);
    setLoading(false);
  };

  const filteredShifts = shifts.filter(s => 
    s.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateDuration = (start: number, end: number | null) => {
      if (!end) return 'Active';
      const hours = (end - start) / 3600000;
      return `${hours.toFixed(2)} hrs`;
  };

  const currency = company?.settings.currency || '$';

  const calculatePay = (start: number, end: number | null, rate: number) => {
      if (!end) return '-';
      const hours = (end - start) / 3600000;
      return `${currency}${(hours * rate).toFixed(2)}`;
  };

  const handleExport = () => {
    downloadShiftsCSV(filteredShifts, 'tally_timesheet', currency);
  };

  const handleDelete = async (shiftId: string) => {
      if (window.confirm("Are you sure you want to delete this shift entry? This cannot be undone.")) {
          try {
              await deleteShift(shiftId);
              setShifts(prev => prev.filter(s => s.id !== shiftId));
          } catch (e) {
              console.error(e);
              alert("Failed to delete shift.");
          }
      }
  };

  // --- EDIT LOGIC ---

  const openEditModal = (shift: Shift) => {
      setEditingShift(shift);
      // Format timestamps for datetime-local input (YYYY-MM-DDTHH:mm)
      // Note: This needs local timezone handling properly, simpler for demo
      const toLocalISO = (ts: number) => {
          const d = new Date(ts);
          d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
          return d.toISOString().slice(0, 16);
      }
      
      setEditStartTime(toLocalISO(shift.startTime));
      setEditEndTime(shift.endTime ? toLocalISO(shift.endTime) : '');
  };

  const handleSaveEdit = async () => {
      if (!editingShift) return;
      setSaving(true);
      
      const startTs = new Date(editStartTime).getTime();
      const endTs = editEndTime ? new Date(editEndTime).getTime() : null;

      try {
          await updateShift(editingShift.id, {
              startTime: startTs,
              endTime: endTs
          });
          setEditingShift(null);
          loadData(); // Reload to show changes
      } catch (e) {
          console.error(e);
          alert("Failed to update shift");
      } finally {
          setSaving(false);
      }
  };

  return (
    <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Timesheets</h1>
                <p className="text-slate-500 dark:text-slate-400">Review and manage staff hours.</p>
            </div>
            <div className="flex space-x-3">
                 <button 
                    onClick={handleExport}
                    className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg flex items-center space-x-2 font-medium hover:bg-slate-50 transition"
                 >
                    <Download className="w-4 h-4" />
                    <span>Download CSV</span>
                 </button>
            </div>
        </header>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center space-x-2 w-full md:w-auto">
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronLeft className="w-5 h-5 text-slate-500" />
                </button>
                <div className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-lg">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium">All Time</span>
                </div>
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <ChevronRight className="w-5 h-5 text-slate-500" />
                </button>
            </div>

            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search staff..." 
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
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Staff</th>
                            <th className="px-6 py-4">Time In</th>
                            <th className="px-6 py-4">Time Out</th>
                            <th className="px-6 py-4">Total</th>
                            <th className="px-6 py-4">Est. Pay</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {loading ? (
                            <>
                                <TableRowSkeleton />
                                <TableRowSkeleton />
                                <TableRowSkeleton />
                            </>
                        ) : filteredShifts.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center">No shifts recorded.</td></tr>
                        ) : filteredShifts.map((shift) => (
                            <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition group">
                                <td className="px-6 py-4">
                                    {new Date(shift.startTime).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                    {shift.userName}
                                </td>
                                <td className="px-6 py-4 text-success font-mono">
                                    {new Date(shift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </td>
                                <td className="px-6 py-4 text-slate-500 font-mono">
                                    {shift.endTime ? new Date(shift.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                                </td>
                                <td className="px-6 py-4 font-semibold">
                                    {calculateDuration(shift.startTime, shift.endTime)}
                                </td>
                                <td className="px-6 py-4">
                                    {calculatePay(shift.startTime, shift.endTime, shift.hourlyRate)}
                                </td>
                                <td className="px-6 py-4 text-right flex justify-end space-x-1">
                                    <button 
                                        onClick={() => openEditModal(shift)}
                                        className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                     <button 
                                        onClick={() => handleDelete(shift.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Edit Modal */}
        {editingShift && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border dark:border-slate-700">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Shift</h2>
                        <button onClick={() => setEditingShift(null)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Staff Member</p>
                            <p className="font-bold text-lg text-slate-900 dark:text-white">{editingShift.userName}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Start Time</label>
                                <input 
                                    type="datetime-local"
                                    value={editStartTime}
                                    onChange={(e) => setEditStartTime(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">End Time</label>
                                <input 
                                    type="datetime-local"
                                    value={editEndTime}
                                    onChange={(e) => setEditEndTime(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-brand-600 bg-brand-50 p-3 rounded-lg">
                            <Clock className="w-4 h-4" />
                            <span>This overrides the logged data.</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                         <button 
                            onClick={() => setEditingShift(null)}
                            className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveEdit}
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
