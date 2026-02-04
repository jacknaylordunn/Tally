
import React, { useEffect, useState, useMemo } from 'react';
import { getShifts, updateShift, deleteShift, getCompany, getCompanyStaff, createManualShift } from '../services/api';
import { Shift, Company, User } from '../types';
import { Download, Edit2, Search, Calendar, ChevronDown, Plus, X, Save, Clock, Trash2, CheckCircle, CalendarCheck, HelpCircle, AlertTriangle, ArrowRight, UserCog, FileSpreadsheet, FileText, Table, Info, Wand2, Layers } from 'lucide-react';
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
  const [exportOptions, setExportOptions] = useState({
      showTimes: true,
      includeDeductions: false,
      separateHoliday: false,
      includeInactiveStaff: false, // New: Include staff with no shifts
      includeEmployeeId: false, // New: Show employee numbers
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

  // Sort Helper
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
    
    // Sort Staff List for Dropdown
    setStaffList(staffData.sort(sortByLastName));
    
    // Initialize export defaults from settings
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

  const filteredShifts = useMemo(() => getFilteredShifts(), [shifts, dateRange, customStart, customEnd, searchTerm]);

  // --- Overlap Detection Logic ---
  const overlapIds = useMemo(() => {
      const ids = new Set<string>();
      // Group by User
      const userGroups: Record<string, Shift[]> = {};
      filteredShifts.forEach(s => {
          if (!s.endTime) return; // Skip active shifts for overlap check logic simplicity
          if (!userGroups[s.userId]) userGroups[s.userId] = [];
          userGroups[s.userId].push(s);
      });

      Object.values(userGroups).forEach(group => {
          // Sort by start time
          group.sort((a, b) => a.startTime - b.startTime);
          
          for (let i = 0; i < group.length - 1; i++) {
              const current = group[i];
              const next = group[i+1];
              
              // If current ends after next starts, overlap!
              // (Buffer of 1 minute to avoid flagging simple back-to-back errors)
              if (current.endTime! > (next.startTime + 60000)) {
                  ids.add(current.id);
                  ids.add(next.id);
              }
          }
      });
      return ids;
  }, [filteredShifts]);

  // Formatter for DD.MM.YY
  const formatDateLabel = (date: Date) => {
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '.');
  };

  // Derived Export Label
  const getExportRangeLabel = () => {
      const now = new Date();

      if (dateRange === 'custom') {
          if (!customStart) return 'All Time';
          const s = new Date(customStart);
          const e = customEnd ? new Date(customEnd) : now;
          return `${formatDateLabel(s)} - ${formatDateLabel(e)}`;
      } 
      
      if (dateRange === 'today') {
          return formatDateLabel(now);
      } 
      
      // Handle presets (7, 14, 30)
      const days = parseInt(dateRange);
      const start = new Date();
      start.setDate(now.getDate() - days);
      
      return `${formatDateLabel(start)} - ${formatDateLabel(now)}`;
  };

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

  // ... (Audit Logic & Color functions remain unchanged)
  const getAuditFlags = (shift: Shift) => {
      if (!company) return [];
      const flags = [];
      const auditLateIn = company.settings.auditLateInThreshold || 15;
      const auditEarlyIn = company.settings.auditEarlyInThreshold || 30;
      const auditEarlyOut = company.settings.auditEarlyOutThreshold || 15;
      const auditLateOut = company.settings.auditLateOutThreshold || 15;
      const auditShortShift = company.settings.auditShortShiftThreshold || 5;
      const auditLongShift = company.settings.auditLongShiftThreshold || 14;

      // Overlap Check
      if (overlapIds.has(shift.id)) {
          flags.push({ type: 'red', label: 'Overlap' });
      }

      if (shift.scheduledStartTime) {
          const diffMins = (shift.startTime - shift.scheduledStartTime) / 60000;
          if (diffMins > auditLateIn) {
              flags.push({ type: 'red', label: `Late In (+${Math.round(diffMins)}m)` });
          } else if (diffMins < -auditEarlyIn) {
              flags.push({ type: 'amber', label: `Early In (${Math.abs(Math.round(diffMins))}m)` });
          }
      }
      if (shift.scheduledEndTime && shift.endTime) {
          const diffMins = (shift.endTime - shift.scheduledEndTime) / 60000;
          if (diffMins < -auditEarlyOut) {
              flags.push({ type: 'amber', label: `Early Out (${Math.abs(Math.round(diffMins))}m)` });
          } else if (diffMins > auditLateOut) {
              flags.push({ type: 'amber', label: `Late Out (+${Math.round(diffMins)}m)` });
          }
      }
      if (shift.endTime) {
          const durationMins = (shift.endTime - shift.startTime) / 60000;
          if (durationMins < auditShortShift) flags.push({ type: 'red', label: 'Short Shift' });
          if ((durationMins / 60) > auditLongShift) flags.push({ type: 'red', label: `Over ${auditLongShift}h` });
      }
      return flags;
  };

  const getTimeInColorClass = (shift: Shift) => {
      if (!shift.scheduledStartTime) return 'text-slate-600 dark:text-slate-300';
      const diffMins = (shift.startTime - shift.scheduledStartTime) / 60000;
      if (diffMins > (company?.settings.auditLateInThreshold || 15)) return 'text-red-600 dark:text-red-400 font-bold';
      else if (diffMins < -(company?.settings.auditEarlyInThreshold || 30)) return 'text-amber-600 dark:text-amber-400 font-bold';
      else return 'text-emerald-600 dark:text-emerald-400';
  };

  const getTimeOutColorClass = (shift: Shift) => {
      if (!shift.scheduledEndTime || !shift.endTime) return 'text-slate-400';
      const diffMins = (shift.endTime - shift.scheduledEndTime) / 60000;
      if (diffMins < -(company?.settings.auditEarlyOutThreshold || 15)) return 'text-amber-600 dark:text-amber-400 font-bold';
      if (diffMins > (company?.settings.auditLateOutThreshold || 15)) return 'text-amber-600 dark:text-amber-400 font-bold';
      return 'text-emerald-600 dark:text-emerald-400';
  };

  const handleGenerateExport = () => {
    // Pass ALL staff to report generator so it can fill in 0-hour rows if enabled
    downloadPayrollReport(filteredShifts, staffList, {
        filename: `tally_payroll_${exportFormat}`, 
        currency,
        dateRangeLabel: getExportRangeLabel(),
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
        timeFormat: exportOptions.timeFormat
    });
    setIsExportModalOpen(false);
  };

  // ... (Edit/Delete/Add Shift Handlers unchanged)
  const handleDelete = async (shiftId: string) => {
      if (window.confirm("Are you sure you want to delete this shift entry? This cannot be undone.")) {
          try {
              await deleteShift(shiftId);
              setShifts(prev => prev.filter(s => s.id !== shiftId));
          } catch (e) { console.error(e); alert("Failed to delete shift."); }
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
                 
                 <button 
                    onClick={() => setIsExportModalOpen(true)}
                    className="glass-panel text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg flex items-center space-x-2 font-medium hover:bg-slate-100 dark:hover:bg-white/10 transition"
                 >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                 </button>
            </div>
        </header>

        {/* Filters Bar */}
        <div className="glass-panel p-4 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select 
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value as DateRange)}
                        className="pl-10 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none text-sm appearance-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition"
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
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm w-full sm:w-auto"
                        />
                        <span className="text-slate-400 hidden sm:inline">-</span>
                        <input 
                            type="datetime-local" 
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm w-full sm:w-auto"
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
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
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
                            <th className="px-6 py-4">Total</th>
                            <th className="px-6 py-4">Est. Pay</th>
                            <th className="px-6 py-4">Method</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {loading ? (
                            <>
                                <TableRowSkeleton />
                                <TableRowSkeleton />
                                <TableRowSkeleton />
                            </>
                        ) : filteredShifts.length === 0 ? (
                            <tr><td colSpan={8} className="p-8 text-center text-slate-500">No shifts found for this period.</td></tr>
                        ) : filteredShifts.map((shift) => {
                            const flags = getAuditFlags(shift);
                            const timeInColor = getTimeInColorClass(shift);
                            const timeOutColor = getTimeOutColorClass(shift);
                            
                            return (
                                <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-2">
                                            <span>{new Date(shift.startTime).toLocaleDateString()}</span>
                                            {shift.scheduleShiftId && (
                                                <div className="group/tooltip relative">
                                                    <CalendarCheck className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 cursor-help" />
                                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover/tooltip:opacity-100 transition whitespace-nowrap pointer-events-none z-10">
                                                        Matched to Rota
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                        <div className="flex flex-col">
                                            <span>{shift.userName}</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {flags.map((f, i) => (
                                                    <span key={i} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${f.type === 'red' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                                                        {f.type === 'red' && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                        {f.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono">
                                        <div className={timeInColor}>
                                            {new Date(shift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                        {shift.scheduledStartTime && (
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                                Plan: {new Date(shift.scheduledStartTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-mono">
                                        <div className={timeOutColor}>
                                            {shift.endTime ? new Date(shift.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                                        </div>
                                        {shift.scheduledEndTime && (
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                                Plan: {new Date(shift.scheduledEndTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                                        {calculateDuration(shift.startTime, shift.endTime)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-mono text-slate-900 dark:text-slate-100">
                                            {calculatePay(shift.startTime, shift.endTime, shift.hourlyRate)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="group/audit relative inline-block cursor-default">
                                            {/* Method Badge */}
                                            {shift.startMethod === 'manual_entry' ? (
                                                <span className="text-[10px] uppercase font-bold text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300 px-2 py-1 rounded-md flex items-center gap-1 w-fit">
                                                    <UserCog className="w-3 h-3" /> Manual
                                                </span>
                                            ) : shift.startMethod === 'static_gps' ? (
                                                <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded-md w-fit">GPS</span>
                                            ) : (
                                                <span className="text-[10px] uppercase font-bold text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-md w-fit">Kiosk</span>
                                            )}

                                            {/* Tooltip Content */}
                                            {(shift.editedByName || shift.createdByName) && (
                                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover/audit:opacity-100 transition-opacity pointer-events-none z-10">
                                                    {shift.startMethod === 'manual_entry' && shift.createdByName && (
                                                        <div className="mb-1">
                                                            <span className="opacity-70 block text-[9px] uppercase">Created By</span>
                                                            <span className="font-bold">{shift.createdByName}</span>
                                                        </div>
                                                    )}
                                                    {shift.editedByName && (
                                                        <div>
                                                            <span className="opacity-70 block text-[9px] uppercase">Edited By</span>
                                                            <span className="font-bold">{shift.editedByName}</span>
                                                            <span className="block opacity-50 text-[9px]">{new Date(shift.editedAt || 0).toLocaleDateString()}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end space-x-1">
                                        <button 
                                            onClick={() => openEditModal(shift)}
                                            className="p-2 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                         <button 
                                            onClick={() => handleDelete(shift.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
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

        {/* --- EXPORT MODAL --- */}
        {isExportModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-lg p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Export Data</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Download report for {filteredShifts.length} records</p>
                        </div>
                        <button onClick={() => setIsExportModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition"><X className="w-6 h-6" /></button>
                    </div>

                    {/* Info Warning for Date Range */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-xl flex items-start gap-3 mb-6">
                        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <span className="font-bold text-blue-800 dark:text-blue-200 block mb-1">Current Range: {getExportRangeLabel()}</span>
                            <p className="text-blue-700 dark:text-blue-300 opacity-90">
                                The export includes data for the selected date range.
                            </p>
                        </div>
                    </div>

                    {/* Format Selection */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Format</label>
                        <div className="grid grid-cols-3 gap-3">
                            <button 
                                onClick={() => setExportFormat('matrix')}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${exportFormat === 'matrix' ? 'border-brand-500 bg-brand-50 dark:bg-slate-900/20 text-brand-700 dark:text-brand-400' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 text-slate-600 dark:text-slate-400'}`}
                            >
                                <FileSpreadsheet className="w-6 h-6 mb-2" />
                                <span className="text-xs font-bold text-center">Payroll Matrix</span>
                            </button>
                            <button 
                                onClick={() => setExportFormat('detailed')}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${exportFormat === 'detailed' ? 'border-brand-500 bg-brand-50 dark:bg-slate-900/20 text-brand-700 dark:text-brand-400' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 text-slate-600 dark:text-slate-400'}`}
                            >
                                <FileText className="w-6 h-6 mb-2" />
                                <span className="text-xs font-bold text-center">Detailed List</span>
                            </button>
                            <button 
                                onClick={() => setExportFormat('grouped')}
                                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${exportFormat === 'grouped' ? 'border-brand-500 bg-brand-50 dark:bg-slate-900/20 text-brand-700 dark:text-brand-400' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 text-slate-600 dark:text-slate-400'}`}
                            >
                                <Table className="w-6 h-6 mb-2" />
                                <span className="text-xs font-bold text-center">Staff Summary</span>
                            </button>
                        </div>
                    </div>

                    {/* General Options */}
                    <div className="mt-6 space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-white/5 animate-fade-in">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">Data Options</label>
                        
                        {(exportFormat === 'matrix' || exportFormat === 'grouped') && (
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Include Staff with No Shifts</span>
                                <input type="checkbox" checked={exportOptions.includeInactiveStaff} onChange={e => setExportOptions({...exportOptions, includeInactiveStaff: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                            </label>
                        )}

                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Show Employee IDs</span>
                            <input type="checkbox" checked={exportOptions.includeEmployeeId} onChange={e => setExportOptions({...exportOptions, includeEmployeeId: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                        </label>

                        {/* Matrix Specific Options */}
                        {exportFormat === 'matrix' && (
                            <>
                                <div className="h-px bg-slate-200 dark:bg-white/10 my-2"></div>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Show Start/End Times</span>
                                    <input type="checkbox" checked={exportOptions.showTimes} onChange={e => setExportOptions({...exportOptions, showTimes: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                                </label>
                                
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Add Deduction Columns</span>
                                    </div>
                                    <input type="checkbox" checked={exportOptions.includeDeductions} onChange={e => setExportOptions({...exportOptions, includeDeductions: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                                </label>

                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Calculate Holiday Pay</span>
                                    <input type="checkbox" checked={exportOptions.separateHoliday} onChange={e => setExportOptions({...exportOptions, separateHoliday: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                                </label>
                            </>
                        )}
                    </div>

                    {/* Time Format Option */}
                    {(exportFormat === 'matrix' && exportOptions.showTimes) || exportFormat === 'detailed' ? (
                        <div className="mt-4">
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Time Format</label>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-white/5">
                                <button 
                                    onClick={() => setExportOptions(prev => ({ ...prev, timeFormat: '12h' }))}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${exportOptions.timeFormat === '12h' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                                >
                                    10:56 pm
                                </button>
                                <button 
                                    onClick={() => setExportOptions(prev => ({ ...prev, timeFormat: '24h_dot' }))}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${exportOptions.timeFormat === '24h_dot' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-600 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                                >
                                    22.56
                                </button>
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-8 flex gap-3">
                        <button 
                            onClick={() => setIsExportModalOpen(false)}
                            className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleGenerateExport}
                            className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition shadow-lg flex items-center justify-center gap-2"
                        >
                            <Download className="w-5 h-5" />
                            <span>Download Report</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ... (Edit Modal and Add Modal code remains unchanged) ... */}
        {editingShift && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Shift</h2>
                        <button onClick={() => setEditingShift(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
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
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                />
                                {editingShift.scheduledStartTime && (
                                    <button 
                                        type="button"
                                        onClick={() => setEditStartTime(toLocalISO(editingShift.scheduledStartTime!))}
                                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-1 flex items-center gap-1"
                                    >
                                        <Wand2 className="w-3 h-3" />
                                        Reset to Plan: {new Date(editingShift.scheduledStartTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </button>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">End Time</label>
                                <input 
                                    type="datetime-local"
                                    value={editEndTime}
                                    onChange={(e) => setEditEndTime(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                />
                                {editingShift.scheduledEndTime && (
                                    <button 
                                        type="button"
                                        onClick={() => setEditEndTime(toLocalISO(editingShift.scheduledEndTime!))}
                                        className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline mt-1 flex items-center gap-1"
                                    >
                                        <Wand2 className="w-3 h-3" />
                                        Reset to Plan: {new Date(editingShift.scheduledEndTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 p-3 rounded-lg border border-brand-200 dark:border-brand-900/30">
                            <Clock className="w-4 h-4" />
                            <span>This overrides the logged data.</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                         <button 
                            onClick={() => setEditingShift(null)}
                            className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition"
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
                <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Timesheet Entry</h2>
                        <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="w-6 h-6" /></button>
                    </div>
                    <form onSubmit={handleAddShift} className="space-y-4 mb-8">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Select Staff</label>
                            <select required value={newShiftUser} onChange={(e) => setNewShiftUser(e.target.value)} className="w-full px-3 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none">
                                <option value="">Select an employee...</option>
                                {staffList.map(u => (<option key={u.id} value={u.id}>{u.name}</option>))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">Start Time</label><input type="datetime-local" required value={newShiftStart} onChange={(e) => setNewShiftStart(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" /></div>
                            <div><label className="block text-xs font-bold uppercase text-slate-500 mb-1">End Time</label><input type="datetime-local" required value={newShiftEnd} onChange={(e) => setNewShiftEnd(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" /></div>
                        </div>
                        <div className="flex gap-3 pt-4">
                             <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition">Cancel</button>
                            <button type="submit" disabled={saving} className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center space-x-2"><CheckCircle className="w-4 h-4" /><span>{saving ? 'Creating...' : 'Create Entry'}</span></button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};
