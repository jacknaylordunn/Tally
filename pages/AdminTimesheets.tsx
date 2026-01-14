
import React, { useEffect, useState } from 'react';
import { getShifts, updateShift, deleteShift, getCompany, getCompanyStaff, createManualShift } from '../services/api';
import { Shift, Company, User } from '../types';
import { Download, Edit2, Search, Calendar, ChevronDown, Plus, X, Save, Clock, Trash2, CheckCircle, CalendarCheck, HelpCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadShiftsCSV } from '../utils/csv';
import { TableRowSkeleton } from '../components/Skeleton';

type DateRange = 'today' | '7' | '14' | '30' | 'custom';

export const AdminTimesheets = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [staffList, setStaffList] = useState<User[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Filtering State
  const [dateRange, setDateRange] = useState<DateRange>('7');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Export State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Edit Modal State
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [saving, setSaving] = useState(false);

  // Add Shift Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newShiftUser, setNewShiftUser] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('');
  const [newShiftEnd, setNewShiftEnd] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user || !user.currentCompanyId) return;
    setLoading(true);
    const [shiftsData, companyData, staffData] = await Promise.all([
        getShifts(user.currentCompanyId),
        getCompany(user.currentCompanyId),
        getCompanyStaff(user.currentCompanyId)
    ]);
    setShifts(shiftsData);
    setCompany(companyData);
    setStaffList(staffData);
    setLoading(false);
  };

  // Date Filtering Logic
  const getFilteredShifts = () => {
      const now = new Date();
      let startFilterDate: number;
      let endFilterDate: number = now.getTime();

      if (dateRange === 'custom') {
          if (!customStart) return shifts;
          startFilterDate = new Date(customStart).getTime();
          endFilterDate = customEnd ? new Date(customEnd).getTime() : now.getTime();
      } else if (dateRange === 'today') {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          startFilterDate = start.getTime();
          
          const end = new Date();
          end.setHours(23, 59, 59, 999);
          endFilterDate = end.getTime();
      } else {
          const start = new Date();
          start.setDate(now.getDate() - parseInt(dateRange));
          start.setHours(0, 0, 0, 0);
          startFilterDate = start.getTime();
      }

      return shifts.filter(s => {
          const shiftStart = s.startTime;
          const nameMatch = s.userName.toLowerCase().includes(searchTerm.toLowerCase());
          
          if (dateRange === 'custom') {
              const isWithinStart = shiftStart >= startFilterDate;
              const isWithinEnd = s.endTime ? s.endTime <= endFilterDate : shiftStart <= endFilterDate;
              return nameMatch && isWithinStart && isWithinEnd;
          } else {
              return nameMatch && shiftStart >= startFilterDate && shiftStart <= endFilterDate;
          }
      });
  };

  const filteredShifts = getFilteredShifts();

  const calculateDuration = (start: number, end: number | null) => {
      if (!end) return 'Active';
      const hours = (end - start) / 3600000;
      return `${hours.toFixed(2)} hrs`;
  };

  const currency = company?.settings.currency || '£';

  const calculatePay = (start: number, end: number | null, rate: number) => {
      if (!end) return '-';
      const hours = (end - start) / 3600000;
      return `${currency}${(hours * rate).toFixed(2)}`;
  };

  // --- Audit Logic ---
  const getAuditFlags = (shift: Shift) => {
      if (!company) return [];
      
      const flags = [];
      const auditLateIn = company.settings.auditLateInThreshold || 15;
      const auditEarlyOut = company.settings.auditEarlyOutThreshold || 15;
      const auditLateOut = company.settings.auditLateOutThreshold || 15;
      const auditShortShift = company.settings.auditShortShiftThreshold || 5;
      const auditLongShift = company.settings.auditLongShiftThreshold || 14;

      // 1. Check Late In
      if (shift.scheduledStartTime) {
          const diffMins = (shift.startTime - shift.scheduledStartTime) / 60000;
          if (diffMins > auditLateIn) {
              flags.push({ type: 'amber', label: `Late In (+${Math.round(diffMins)}m)` });
          }
      }

      // 2. Check Early Out / Late Out
      if (shift.scheduledEndTime && shift.endTime) {
          const diffMins = (shift.endTime - shift.scheduledEndTime) / 60000;
          if (diffMins < -auditEarlyOut) {
              flags.push({ type: 'amber', label: `Early Out (${Math.round(diffMins)}m)` });
          } else if (diffMins > auditLateOut) {
              flags.push({ type: 'amber', label: `Late Out (+${Math.round(diffMins)}m)` });
          }
      }

      // 3. Short Shift (Accidental)
      if (shift.endTime) {
          const durationMins = (shift.endTime - shift.startTime) / 60000;
          if (durationMins < auditShortShift) {
              flags.push({ type: 'red', label: 'Short Shift' });
          }
          
          // 4. Long Shift (Forgotten)
          const durationHours = durationMins / 60;
          if (durationHours > auditLongShift) {
              flags.push({ type: 'red', label: `Over ${auditLongShift}h` });
          } else if (shift.scheduledEndTime && shift.scheduledStartTime) {
              // Check if significantly longer than planned (e.g. +4 hours)
              const plannedDuration = (shift.scheduledEndTime - shift.scheduledStartTime) / 3600000;
              if (durationHours > plannedDuration + 4) {
                  flags.push({ type: 'red', label: 'Overtime Check' });
              }
          }
      }

      return flags;
  };

  const handleExport = (groupByStaff: boolean) => {
    let rangeLabel = 'Custom Range';
    if (dateRange === 'today') {
        rangeLabel = 'Today';
    } else if (dateRange !== 'custom') {
        rangeLabel = `Last ${dateRange} Days`;
    } else if (customStart) {
        rangeLabel = `${new Date(customStart).toLocaleString()} - ${customEnd ? new Date(customEnd).toLocaleString() : 'Now'}`;
    }

    downloadShiftsCSV(filteredShifts, {
        filename: 'tally_timesheet', 
        currency,
        dateRangeLabel: rangeLabel,
        groupByStaff,
        holidayPayEnabled: company?.settings.holidayPayEnabled,
        holidayPayRate: company?.settings.holidayPayRate
    });
    setIsExportMenuOpen(false);
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

  const toLocalISO = (ts: number) => {
      const d = new Date(ts);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
  }

  const openEditModal = (shift: Shift) => {
      setEditingShift(shift);
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
          loadData(); 
      } catch (e) {
          console.error(e);
          alert("Failed to update shift");
      } finally {
          setSaving(false);
      }
  };

  const handleAddShift = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user?.currentCompanyId || !newShiftUser || !newShiftStart || !newShiftEnd) return;
      
      setSaving(true);
      const selectedStaff = staffList.find(u => u.id === newShiftUser);
      if (!selectedStaff) return;

      const startTs = new Date(newShiftStart).getTime();
      const endTs = new Date(newShiftEnd).getTime();
      const rate = selectedStaff.customHourlyRate || company?.settings.defaultHourlyRate || 0;

      try {
          await createManualShift(
              user.currentCompanyId,
              selectedStaff.id,
              selectedStaff.name,
              startTs,
              endTs,
              rate
          );
          setIsAddModalOpen(false);
          setNewShiftUser('');
          setNewShiftStart('');
          setNewShiftEnd('');
          loadData();
      } catch (e) {
          console.error(e);
          alert("Failed to create shift");
      } finally {
          setSaving(false);
      }
  };

  return (
    <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white">Timesheets</h1>
                <p className="text-slate-400">Review and manage staff hours.</p>
            </div>
            <div className="flex space-x-3">
                 <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition flex items-center space-x-2"
                 >
                    <Plus className="w-4 h-4" />
                    <span>Add Shift</span>
                 </button>
                 
                 <div className="relative">
                     <button 
                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                        className="glass-panel text-slate-300 border border-white/10 px-4 py-2 rounded-lg flex items-center space-x-2 font-medium hover:bg-white/10 transition"
                     >
                        <Download className="w-4 h-4" />
                        <span>Export</span>
                        <ChevronDown className="w-4 h-4" />
                     </button>
                     
                     {isExportMenuOpen && (
                         <div className="absolute right-0 mt-2 w-48 bg-slate-900 rounded-xl shadow-xl border border-white/10 z-20 overflow-hidden animate-fade-in">
                             <button 
                                onClick={() => handleExport(false)} 
                                className="w-full text-left px-4 py-3 hover:bg-white/5 text-slate-300 text-sm font-medium"
                             >
                                 Detailed CSV
                             </button>
                             <button 
                                onClick={() => handleExport(true)} 
                                className="w-full text-left px-4 py-3 hover:bg-white/5 text-slate-300 text-sm font-medium border-t border-white/5"
                             >
                                 Grouped by Staff
                             </button>
                         </div>
                     )}
                 </div>
            </div>
        </header>

        {/* Filters Bar */}
        <div className="glass-panel p-4 rounded-xl shadow-sm border border-white/10 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select 
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as DateRange)}
                        className="pl-10 pr-8 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm appearance-none cursor-pointer hover:bg-slate-800 transition"
                    >
                        <option value="today">Today</option>
                        <option value="7">Past 7 Days</option>
                        <option value="14">Past 14 Days</option>
                        <option value="30">Past 30 Days</option>
                        <option value="custom">Custom Range</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                </div>

                {dateRange === 'custom' && (
                    <div className="flex flex-col sm:flex-row items-center gap-2 animate-fade-in">
                        <input 
                            type="datetime-local" 
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white text-sm w-full sm:w-auto"
                        />
                        <span className="text-slate-400 hidden sm:inline">-</span>
                        <input 
                            type="datetime-local" 
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white text-sm w-full sm:w-auto"
                        />
                    </div>
                )}
            </div>

            <div className="relative w-full lg:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search staff..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-900 text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none placeholder:text-slate-500"
                />
            </div>
        </div>

        {/* Table */}
        <div className="glass-panel rounded-2xl shadow-sm border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-white/5 text-xs uppercase font-semibold text-slate-500">
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
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            <>
                                <TableRowSkeleton />
                                <TableRowSkeleton />
                                <TableRowSkeleton />
                            </>
                        ) : filteredShifts.length === 0 ? (
                            <tr><td colSpan={7} className="p-8 text-center text-slate-500">No shifts found for this period.</td></tr>
                        ) : filteredShifts.map((shift) => {
                            const flags = getAuditFlags(shift);
                            
                            return (
                                <tr key={shift.id} className="hover:bg-white/5 transition group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2">
                                            <span>{new Date(shift.startTime).toLocaleDateString()}</span>
                                            {/* Visual Link for Rota Integration */}
                                            {shift.scheduleShiftId && (
                                                <div className="group/tooltip relative">
                                                    <CalendarCheck className="w-3.5 h-3.5 text-blue-400 cursor-help" />
                                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover/tooltip:opacity-100 transition whitespace-nowrap pointer-events-none z-10">
                                                        Matched to Rota
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-white">
                                        {shift.userName}
                                        {flags.map((f, i) => (
                                            <span key={i} className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${f.type === 'red' ? 'bg-red-900/30 text-red-400' : 'bg-amber-900/30 text-amber-400'}`}>
                                                {f.label}
                                            </span>
                                        ))}
                                    </td>
                                    <td className="px-6 py-4 font-mono">
                                        <div className="text-emerald-400">
                                            {new Date(shift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                        {shift.scheduledStartTime && (
                                            <div className="text-[10px] text-slate-500">
                                                Plan: {new Date(shift.scheduledStartTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-mono">
                                        <div className="text-slate-400">
                                            {shift.endTime ? new Date(shift.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                                        </div>
                                        {shift.scheduledEndTime && (
                                            <div className="text-[10px] text-slate-500">
                                                Plan: {new Date(shift.scheduledEndTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-slate-300">
                                        {calculateDuration(shift.startTime, shift.endTime)}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">
                                        {calculatePay(shift.startTime, shift.endTime, shift.hourlyRate)}
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end space-x-1">
                                        <button 
                                            onClick={() => openEditModal(shift)}
                                            className="p-2 text-slate-500 hover:text-brand-400 hover:bg-white/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                         <button 
                                            onClick={() => handleDelete(shift.id)}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
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
        {editingShift && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-xl border border-white/10 bg-slate-900">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Edit Shift</h2>
                        <button onClick={() => setEditingShift(null)} className="text-slate-400 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4 mb-8">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Staff Member</p>
                            <p className="font-bold text-lg text-white">{editingShift.userName}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Start Time</label>
                                <input 
                                    type="datetime-local"
                                    value={editStartTime}
                                    onChange={(e) => setEditStartTime(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">End Time</label>
                                <input 
                                    type="datetime-local"
                                    value={editEndTime}
                                    onChange={(e) => setEditEndTime(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-brand-400 bg-brand-900/20 p-3 rounded-lg border border-brand-900/30">
                            <Clock className="w-4 h-4" />
                            <span>This overrides the logged data.</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                         <button 
                            onClick={() => setEditingShift(null)}
                            className="flex-1 py-3 text-slate-400 font-bold hover:bg-white/5 rounded-xl transition"
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

        {/* Add Shift Modal */}
        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-xl border border-white/10 bg-slate-900">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Add Timesheet Entry</h2>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleAddShift} className="space-y-4 mb-8">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Select Staff</label>
                            <select 
                                required
                                value={newShiftUser} 
                                onChange={(e) => setNewShiftUser(e.target.value)}
                                className="w-full px-3 py-3 rounded-lg border border-slate-700 bg-slate-800 text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                                <option value="">Select an employee...</option>
                                {staffList.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Start Time</label>
                                <input 
                                    type="datetime-local"
                                    required
                                    value={newShiftStart}
                                    onChange={(e) => setNewShiftStart(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">End Time</label>
                                <input 
                                    type="datetime-local"
                                    required
                                    value={newShiftEnd}
                                    onChange={(e) => setNewShiftEnd(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white text-sm"
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                             <button 
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="flex-1 py-3 text-slate-400 font-bold hover:bg-white/5 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center space-x-2"
                            >
                                <CheckCircle className="w-4 h-4" />
                                <span>{saving ? 'Creating...' : 'Create Entry'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};
