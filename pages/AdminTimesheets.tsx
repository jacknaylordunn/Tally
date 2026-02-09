
import React, { useEffect, useState, useMemo } from 'react';
import { getShifts, updateShift, deleteShift, getCompany, getCompanyStaff, createManualShift } from '../services/api';
import { Shift, Company, User } from '../types';
import { Download, Edit2, Search, Calendar, ChevronsUpDown, Plus, X, Save, Trash2, CalendarCheck, Coffee, FileSpreadsheet, List, Users, ArrowRight, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadPayrollReport } from '../utils/csv';
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

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'matrix' | 'detailed' | 'grouped'>('matrix');
  const [exportFileType, setExportFileType] = useState<'xlsx' | 'csv' | 'sheets'>('xlsx');
  
  const [exportOptions, setExportOptions] = useState({
      showTimes: true,
      includeDeductions: false,
      separateHoliday: false,
      includeInactiveStaff: false,
      includeEmployeeId: false, 
      timeFormat: '12h' as '12h' | '24h_dot'
  });

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

  const sortByLastName = (a: User, b: User) => {
      const nameA = a.lastName ? a.lastName.toLowerCase() : a.name.trim().split(' ').pop()?.toLowerCase() || '';
      const nameB = b.lastName ? b.lastName.toLowerCase() : b.name.trim().split(' ').pop()?.toLowerCase() || '';
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
  };

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
    setStaffList(staffData.sort(sortByLastName));
    
    if (companyData) {
        setExportOptions(prev => ({
            ...prev,
            showTimes: companyData.settings.exportShowShiftTimesWeekly !== false,
            includeDeductions: !!companyData.settings.exportIncludeDeductions,
            separateHoliday: !!companyData.settings.holidayPayEnabled
        }));
    }
    setLoading(false);
  };

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

  const filteredShifts = useMemo(() => getFilteredShifts(), [shifts, dateRange, customStart, customEnd, searchTerm]);

  // --- CORE CALCULATION LOGIC ---

  const calculateShiftStats = (shift: Shift) => {
      const now = Date.now();
      const endTime = shift.endTime || now;
      const rawDurationMs = endTime - shift.startTime;
      
      let totalBreakMs = 0;
      if (shift.breaks && shift.breaks.length > 0) {
          shift.breaks.forEach(b => {
              if (b.endTime) {
                  totalBreakMs += (b.endTime - b.startTime);
              } else {
                  totalBreakMs += (now - b.startTime);
              }
          });
      }

      const isUnpaidBreak = company?.settings.breakType === 'unpaid';
      const paidDurationMs = isUnpaidBreak ? Math.max(0, rawDurationMs - totalBreakMs) : rawDurationMs;
      
      const paidHours = paidDurationMs / 3600000;
      const breakMinutes = Math.round(totalBreakMs / 60000);
      const rawHours = rawDurationMs / 3600000;

      return {
          rawDurationMs,
          paidDurationMs,
          paidHours,
          rawHours,
          breakMinutes,
          totalBreakMs,
          isActive: !shift.endTime
      };
  };

  const calculatePay = (shift: Shift, paidHours: number) => {
      if (!shift.endTime && !company?.settings.showStaffEarnings) return '-'; 
      const rate = shift.hourlyRate || 0;
      return (paidHours * rate).toFixed(2);
  };

  // --- COMPLIANCE STYLING ---

  const getComplianceStatus = (actual: number, scheduled: number | undefined, type: 'start' | 'end') => {
      if (!scheduled) return { className: 'text-slate-900 dark:text-white', message: null };
      
      const diffMins = (actual - scheduled) / 60000;
      
      const lateIn = company?.settings.auditLateInThreshold || 15;
      const earlyIn = company?.settings.auditEarlyInThreshold || 30;
      const earlyOut = company?.settings.auditEarlyOutThreshold || 15;
      const lateOut = company?.settings.auditLateOutThreshold || 15;

      if (type === 'start') {
          if (diffMins > lateIn) return { className: 'text-red-600 dark:text-red-400 font-bold', message: `Late In (+${Math.round(diffMins)}m)` };
          if (diffMins < -earlyIn) return { className: 'text-amber-600 dark:text-amber-400 font-bold', message: `Early In (${Math.round(Math.abs(diffMins))}m)` };
      } else {
          if (diffMins < -earlyOut) return { className: 'text-red-600 dark:text-red-400 font-bold', message: `Early Out (${Math.round(Math.abs(diffMins))}m)` };
          if (diffMins > lateOut) return { className: 'text-amber-600 dark:text-amber-400 font-bold', message: `Overtime (+${Math.round(diffMins)}m)` };
      }
      return { className: 'text-emerald-600 dark:text-emerald-400 font-medium', message: 'On Time' };
  };

  const currency = company?.settings.currency || '£';

  // --- HANDLERS ---

  const handleGenerateExport = () => {
    // Calculate precise date label
    let rangeLabel = '';
    const now = new Date();
    
    if (dateRange === 'custom') {
        const start = customStart ? new Date(customStart) : now;
        const end = customEnd ? new Date(customEnd) : now;
        rangeLabel = `${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}`;
    } else if (dateRange === 'today') {
        rangeLabel = now.toLocaleDateString('en-GB');
    } else {
        const past = new Date();
        past.setDate(now.getDate() - parseInt(dateRange));
        rangeLabel = `${past.toLocaleDateString('en-GB')} - ${now.toLocaleDateString('en-GB')}`;
    }

    downloadPayrollReport(filteredShifts, staffList, {
        filename: `tally_payroll_${exportFormat}_${new Date().toISOString().slice(0,10)}`, 
        currency,
        dateRangeLabel: rangeLabel,
        groupByStaff: exportFormat === 'grouped',
        matrixView: exportFormat === 'matrix',
        showTimesInMatrix: exportOptions.showTimes,
        includeDeductions: exportOptions.includeDeductions,
        holidayPayEnabled: exportOptions.separateHoliday,
        holidayPayRate: company?.settings.holidayPayRate,
        includeInactiveStaff: exportOptions.includeInactiveStaff,
        includeEmployeeId: exportOptions.includeEmployeeId,
        companyName: company?.name,
        brandColor: company?.settings.primaryColor,
        timeFormat: exportOptions.timeFormat,
        fileType: exportFileType
    });
    setIsExportModalOpen(false);
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
          await createManualShift(user.currentCompanyId, selectedStaff.id, selectedStaff.name, startTs, endTs, rate, user.name, user.id);
          setIsAddModalOpen(false); setNewShiftUser(''); setNewShiftStart(''); setNewShiftEnd('');
          loadData();
      } catch (e) { console.error(e); alert("Failed to create shift"); } finally { setSaving(false); }
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
      if (!editingShift || !user) return;
      setSaving(true);
      const startTs = new Date(editStartTime).getTime();
      const endTs = editEndTime ? new Date(editEndTime).getTime() : null;
      try {
          await updateShift(editingShift.id, {
              startTime: startTs,
              endTime: endTs,
              startMethod: 'manual_entry', 
              editedByName: user.name,
              editedById: user.id,
              editedAt: Date.now()
          });
          setEditingShift(null);
          loadData(); 
      } catch (e) { console.error(e); alert("Failed to update shift"); } finally { setSaving(false); }
  };

  const handleDelete = async (shiftId: string) => {
      if (window.confirm("Are you sure you want to delete this shift entry? This cannot be undone.")) {
          try {
              await deleteShift(shiftId);
              setShifts(prev => prev.filter(s => s.id !== shiftId));
          } catch (e) { console.error(e); alert("Failed to delete shift."); }
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
                 <button onClick={() => setIsAddModalOpen(true)} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition flex items-center space-x-2">
                    <Plus className="w-4 h-4" /><span>Add Shift</span>
                 </button>
                 <button onClick={() => setIsExportModalOpen(true)} className="glass-panel text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg flex items-center space-x-2 font-medium hover:bg-slate-100 dark:hover:bg-white/10 transition">
                    <Download className="w-4 h-4" /><span>Export</span>
                 </button>
            </div>
        </header>

        {/* Filters */}
        <div className="glass-panel p-4 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRange)} className="pl-10 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm cursor-pointer appearance-none">
                        <option value="today">Today</option>
                        <option value="7">Past 7 Days</option>
                        <option value="14">Past 14 Days</option>
                        <option value="30">Past 30 Days</option>
                        <option value="custom">Custom Range</option>
                    </select>
                    <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                </div>
                {dateRange === 'custom' && (
                    <div className="flex flex-col sm:flex-row items-center gap-2 animate-fade-in">
                        <input type="datetime-local" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm w-full sm:w-auto"/>
                        <span className="text-slate-400 hidden sm:inline">-</span>
                        <input type="datetime-local" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm w-full sm:w-auto"/>
                    </div>
                )}
            </div>
            <div className="relative w-full lg:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input type="text" placeholder="Search staff..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none" />
            </div>
        </div>

        {/* Table */}
        <div className="glass-panel rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
            <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-white/5 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Staff</th>
                            <th className="px-6 py-4">Time In</th>
                            <th className="px-6 py-4">Time Out</th>
                            <th className="px-6 py-4">Breaks</th>
                            <th className="px-6 py-4">Paid Hrs</th>
                            <th className="px-6 py-4">Est. Pay</th>
                            <th className="px-6 py-4">Method</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {loading ? ( <><TableRowSkeleton /><TableRowSkeleton /><TableRowSkeleton /></> ) : filteredShifts.length === 0 ? ( <tr><td colSpan={9} className="p-8 text-center text-slate-500">No shifts found for this period.</td></tr> ) : filteredShifts.map((shift) => {
                            const { paidHours, breakMinutes } = calculateShiftStats(shift);
                            const startStatus = getComplianceStatus(shift.startTime, shift.scheduledStartTime, 'start');
                            const endStatus = getComplianceStatus(shift.endTime || 0, shift.scheduledEndTime, 'end');
                            
                            const isEdited = shift.editedAt || shift.startMethod === 'manual_entry';
                            const editorName = shift.editedByName || shift.createdByName || 'Admin';
                            const editTime = shift.editedAt ? new Date(shift.editedAt).toLocaleDateString() : 'Manual Creation';

                            return (
                                <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
                                            <span>{new Date(shift.startTime).toLocaleDateString()}</span>
                                            {shift.scheduleShiftId && (
                                                <CalendarCheck className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" title="Linked to Rota" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        {shift.userName}
                                    </td>
                                    
                                    {/* TIME IN */}
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className={`text-base font-mono relative group w-fit`}>
                                                <span className={`${startStatus.message && startStatus.message !== 'On Time' ? 'cursor-help decoration-dotted underline underline-offset-4 decoration-slate-300' : ''} ${startStatus.className}`}>
                                                    {new Date(shift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                                {startStatus.message && startStatus.message !== 'On Time' && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg hidden group-hover:block z-50 animate-fade-in">
                                                        {startStatus.message}
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                                    </div>
                                                )}
                                            </div>
                                            {shift.scheduledStartTime && (
                                                <span className="text-[10px] text-slate-400 mt-0.5">
                                                    Plan: {new Date(shift.scheduledStartTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* TIME OUT */}
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            {shift.endTime ? (
                                                <>
                                                    <div className={`text-base font-mono relative group w-fit`}>
                                                        <span className={`${endStatus.message && endStatus.message !== 'On Time' ? 'cursor-help decoration-dotted underline underline-offset-4 decoration-slate-300' : ''} ${endStatus.className}`}>
                                                            {new Date(shift.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                        {endStatus.message && endStatus.message !== 'On Time' && (
                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg hidden group-hover:block z-50 animate-fade-in">
                                                                {endStatus.message}
                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {shift.scheduledEndTime && (
                                                        <span className="text-[10px] text-slate-400 mt-0.5">
                                                            Plan: {new Date(shift.scheduledEndTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-emerald-500 font-bold animate-pulse">Active</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* BREAKS COLUMN */}
                                    <td className="px-6 py-4">
                                        {breakMinutes > 0 ? (
                                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-mono text-sm">
                                                <Coffee className="w-3.5 h-3.5 text-amber-500" />
                                                <span>{breakMinutes}m</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 dark:text-slate-600">-</span>
                                        )}
                                    </td>

                                    <td className="px-6 py-4">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{paidHours.toFixed(2)} hrs</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-mono text-slate-900 dark:text-slate-100">
                                            {currency}{calculatePay(shift, paidHours)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isEdited ? (
                                            <div className="group relative inline-block">
                                                <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded border border-amber-200 dark:border-amber-800 cursor-help">
                                                    Manual
                                                </span>
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs rounded-lg shadow-xl border border-slate-200 dark:border-white/10 hidden group-hover:block z-50 animate-fade-in">
                                                    <p className="font-bold">Modified by {editorName}</p>
                                                    <p className="text-[10px] opacity-75">{editTime}</p>
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-slate-800"></div>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded border border-blue-200 dark:border-blue-800">
                                                GPS
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end space-x-1">
                                        <button onClick={() => openEditModal(shift)} className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition opacity-0 group-hover:opacity-100" title="Edit"><Edit2 className="w-4 h-4" /></button>
                                         <button onClick={() => handleDelete(shift.id)} className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>

        {/* FULL EXPORT CONFIGURATION MODAL */}
        {isExportModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-lg p-6 rounded-2xl shadow-xl bg-white dark:bg-slate-900">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-xl text-slate-900 dark:text-white">Export Timesheets</h3>
                        <button onClick={() => setIsExportModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                    </div>
                    
                    <div className="space-y-6">
                        {/* Format Selection */}
                        <div className="grid grid-cols-3 gap-3">
                            <button 
                                onClick={() => setExportFormat('matrix')}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${exportFormat === 'matrix' ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-500'}`}
                            >
                                <FileSpreadsheet className="w-6 h-6" />
                                <span className="text-xs font-bold">Matrix View</span>
                            </button>
                            <button 
                                onClick={() => setExportFormat('detailed')}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${exportFormat === 'detailed' ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-500'}`}
                            >
                                <List className="w-6 h-6" />
                                <span className="text-xs font-bold">Detailed Rows</span>
                            </button>
                            <button 
                                onClick={() => setExportFormat('grouped')}
                                className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${exportFormat === 'grouped' ? 'bg-brand-50 border-brand-500 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-500'}`}
                            >
                                <Users className="w-6 h-6" />
                                <span className="text-xs font-bold">Staff Totals</span>
                            </button>
                        </div>

                        {/* File Type Selection */}
                        <div className="flex items-center space-x-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                            <span className="text-xs font-bold text-slate-500 uppercase">Format:</span>
                            <div className="flex gap-2">
                                <button onClick={() => setExportFileType('xlsx')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${exportFileType === 'xlsx' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Excel (.xlsx)</button>
                                <button onClick={() => setExportFileType('csv')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${exportFileType === 'csv' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>CSV</button>
                                <button onClick={() => setExportFileType('sheets')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${exportFileType === 'sheets' ? 'bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}>Google Sheets</button>
                            </div>
                        </div>

                        {/* Options */}
                        <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-2">Configurations</p>
                            
                            {exportFormat === 'matrix' && (
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input type="checkbox" checked={exportOptions.showTimes} onChange={e => setExportOptions({...exportOptions, showTimes: e.target.checked})} className="rounded text-brand-600 focus:ring-brand-500" />
                                    <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-brand-600 transition">Show In/Out Times (3 Cols per Day)</span>
                                </label>
                            )}
                            
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={exportOptions.includeDeductions} onChange={e => setExportOptions({...exportOptions, includeDeductions: e.target.checked})} className="rounded text-brand-600 focus:ring-brand-500" />
                                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-brand-600 transition">Include deduction columns (Tax/NI)</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={exportOptions.separateHoliday} onChange={e => setExportOptions({...exportOptions, separateHoliday: e.target.checked})} className="rounded text-brand-600 focus:ring-brand-500" />
                                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-brand-600 transition">Separate Holiday Pay</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={exportOptions.includeEmployeeId} onChange={e => setExportOptions({...exportOptions, includeEmployeeId: e.target.checked})} className="rounded text-brand-600 focus:ring-brand-500" />
                                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-brand-600 transition">Include Employee ID</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={exportOptions.includeInactiveStaff} onChange={e => setExportOptions({...exportOptions, includeInactiveStaff: e.target.checked})} className="rounded text-brand-600 focus:ring-brand-500" />
                                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-brand-600 transition">Include 0-hour Staff</span>
                            </label>
                            
                            <div className="flex items-center gap-3 pt-2">
                                <span className="text-sm text-slate-500">Time Format:</span>
                                <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg p-1">
                                    <button onClick={() => setExportOptions({...exportOptions, timeFormat: '12h'})} className={`px-2 py-1 text-xs font-bold rounded ${exportOptions.timeFormat === '12h' ? 'bg-slate-100 dark:bg-white/20 text-slate-900 dark:text-white' : 'text-slate-400'}`}>12h (9pm)</button>
                                    <button onClick={() => setExportOptions({...exportOptions, timeFormat: '24h_dot'})} className={`px-2 py-1 text-xs font-bold rounded ${exportOptions.timeFormat === '24h_dot' ? 'bg-slate-100 dark:bg-white/20 text-slate-900 dark:text-white' : 'text-slate-400'}`}>24h (21.00)</button>
                                </div>
                            </div>
                        </div>

                        <button onClick={handleGenerateExport} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 transition">
                            <Download className="w-5 h-5" />
                            <span>Download Report</span>
                        </button>
                    </div>
                </div>
            </div>
        )}
        
        {/* Add Shift Modal */}
        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-xl bg-white dark:bg-slate-900">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Add Past Shift</h3>
                        <button onClick={() => setIsAddModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                    </div>
                    <form onSubmit={handleAddShift} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Staff Member</label>
                            <select value={newShiftUser} onChange={e => setNewShiftUser(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
                                <option value="">Select Staff...</option>
                                {staffList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Start Time</label>
                                <input type="datetime-local" value={newShiftStart} onChange={e => setNewShiftStart(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">End Time</label>
                                <input type="datetime-local" value={newShiftEnd} onChange={e => setNewShiftEnd(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" />
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition" disabled={saving}>
                            {saving ? 'Creating...' : 'Create Shift'}
                        </button>
                    </form>
                </div>
            </div>
        )}

        {/* Edit Shift Modal */}
        {editingShift && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-white/10">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Shift</h2>
                        <button onClick={() => setEditingShift(null)}><X className="w-6 h-6 text-slate-400" /></button>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Start Time</label>
                                <input type="datetime-local" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">End Time</label>
                                <input type="datetime-local" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setEditingShift(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition">Cancel</button>
                            <button onClick={handleSaveEdit} className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition shadow-lg">{saving ? 'Saving...' : 'Save Changes'}</button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
