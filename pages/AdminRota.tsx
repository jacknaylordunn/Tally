
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSchedule, createScheduleShift, updateScheduleShift, deleteScheduleShift, getCompanyStaff, getLocations, assignShiftToUser, getTimeOffRequests, updateTimeOffStatus, publishAllDrafts, createBatchScheduleShifts, copyScheduleWeek, getCompany, getShifts } from '../services/api';
import { ScheduleShift, User, Location, TimeOffRequest, Company, Shift } from '../types';
import { ChevronLeft, ChevronRight, Plus, MapPin, User as UserIcon, Calendar, X, Clock, AlertCircle, Send, Copy, Repeat, LayoutList, Grid, Lock, AlertTriangle, CalendarCheck, ArrowRight, ClipboardCopy, ClipboardPaste, Trash2, Move, ArrowRightLeft } from 'lucide-react';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const AdminRota = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [company, setCompany] = useState<Company | null>(null);
  
  const [schedule, setSchedule] = useState<ScheduleShift[]>([]);
  const [actualShifts, setActualShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Clipboard State
  const [clipboardShift, setClipboardShift] = useState<ScheduleShift | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Modal States
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [isRepeatModalOpen, setIsRepeatModalOpen] = useState(false);
  
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null);

  // Form States
  const [shiftRole, setShiftRole] = useState('Staff');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [shiftUser, setShiftUser] = useState<string>('open'); 
  const [shiftLocation, setShiftLocation] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [user, currentDate]);

  const getWeekRange = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay() || 7; 
    if (day !== 1) start.setHours(-24 * (day - 1)); // Monday
    start.setHours(0,0,0,0);
    
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23,59,59,999);
    
    return { start, end };
  };

  const loadData = async () => {
    if (!user?.currentCompanyId) return;
    setLoading(true);
    
    const { start, end } = getWeekRange(currentDate);

    const [schedData, staffData, locData, timeOffData, companyData, actualsData] = await Promise.all([
        getSchedule(user.currentCompanyId, start.getTime(), end.getTime()),
        getCompanyStaff(user.currentCompanyId),
        getLocations(user.currentCompanyId),
        getTimeOffRequests(user.currentCompanyId),
        getCompany(user.currentCompanyId),
        getShifts(user.currentCompanyId) // Fetch recent actual shifts to check attendance
    ]);
    
    setSchedule(schedData);
    setStaff(staffData);
    setLocations(locData);
    setTimeOffRequests(timeOffData.filter(r => r.status === 'pending'));
    setCompany(companyData);
    setActualShifts(actualsData); // Store actuals
    setLoading(false);
  };

  const getShiftsForDay = (date: Date) => {
    const start = new Date(date);
    start.setHours(0,0,0,0);
    const end = new Date(date);
    end.setHours(23,59,59,999);
    return schedule.filter(s => s.startTime >= start.getTime() && s.startTime <= end.getTime()).sort((a,b) => a.startTime - b.startTime);
  };

  if (company && company.settings.rotaEnabled === false) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                  <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-white">Rota System Disabled</h2>
              <p className="text-slate-400 max-w-md">The scheduling features are currently turned off for your company. Please enable them in Settings if you wish to use them.</p>
          </div>
      );
  }

  // --- ACTIONS ---

  const handleTimeOffAction = async (requestId: string, status: 'approved' | 'rejected') => {
      if (!user?.currentCompanyId) return;
      try {
          await updateTimeOffStatus(requestId, status);
          // Refresh list
          const timeOffData = await getTimeOffRequests(user.currentCompanyId);
          setTimeOffRequests(timeOffData.filter(r => r.status === 'pending'));
      } catch (e) {
          console.error("Error updating time off request", e);
      }
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
      setCurrentDate(new Date());
  };

  const handleCopyWeek = async () => {
      if (!user?.currentCompanyId) return;
      if (!confirm("This will copy shifts from the previous week to the current week displayed. Continue?")) return;
      
      const { start } = getWeekRange(currentDate);
      const prevWeekStart = new Date(start);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      
      setLoading(true);
      await copyScheduleWeek(user.currentCompanyId, prevWeekStart.getTime(), start.getTime());
      loadData();
  };

  const handleClearDrafts = async () => {
      if (!confirm("Are you sure you want to delete ALL 'Draft' shifts for this week? This cannot be undone.")) return;
      
      // Filter visible drafts
      const drafts = schedule.filter(s => s.status === 'draft');
      if (drafts.length === 0) return;

      setLoading(true);
      // Process serially or parallel batch if needed (using existing individual delete for simplicity in this context)
      // In a real app, adding a batch delete endpoint is better.
      await Promise.all(drafts.map(s => deleteScheduleShift(s.id)));
      loadData();
  };

  const handleAddShift = (dayDate: Date) => {
    setSelectedDay(dayDate);
    setEditingShift(null);
    setShiftRole('Staff');
    setShiftStart('09:00');
    setShiftEnd('17:00');
    setShiftUser('open');
    setShiftLocation(locations[0]?.id || '');
    setIsShiftModalOpen(true);
  };

  const handleEditShift = (shift: ScheduleShift, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingShift(shift);
    setSelectedDay(new Date(shift.startTime));
    setShiftRole(shift.role);
    
    const s = new Date(shift.startTime);
    const eTime = new Date(shift.endTime);
    
    setShiftStart(s.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}));
    setShiftEnd(eTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}));
    setShiftUser(shift.userId || 'open');
    setShiftLocation(shift.locationId || '');
    setIsShiftModalOpen(true);
  };

  // --- COPY / PASTE / DUPLICATE LOGIC ---

  const handleQuickDuplicate = async (e: React.MouseEvent, shift: ScheduleShift) => {
      e.stopPropagation();
      const newId = `sch_${Date.now()}_dup_${Math.random().toString(36).substr(2,5)}`;
      const newShift = { ...shift, id: newId, status: 'draft' as const, bids: [] };
      
      // Optimistic update
      setSchedule([...schedule, newShift]);
      await createScheduleShift(newShift);
      loadData(); // Sync
  };

  const handleCopyToClipboard = (e: React.MouseEvent, shift: ScheduleShift) => {
      e.stopPropagation();
      setClipboardShift(shift);
  };

  const handlePasteToDay = async (date: Date) => {
      if (!clipboardShift) return;
      
      const startOfDay = new Date(date);
      const originalStart = new Date(clipboardShift.startTime);
      const originalEnd = new Date(clipboardShift.endTime);
      
      // Calculate duration
      const duration = originalEnd.getTime() - originalStart.getTime();
      
      // Set new start time (keep original hours/minutes)
      const newStartTime = new Date(startOfDay);
      newStartTime.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
      
      const newEndTime = new Date(newStartTime.getTime() + duration);

      const newShift: ScheduleShift = {
          ...clipboardShift,
          id: `sch_${Date.now()}_paste_${Math.random().toString(36).substr(2,5)}`,
          startTime: newStartTime.getTime(),
          endTime: newEndTime.getTime(),
          status: 'draft',
          bids: [], // Reset bids
          isOffered: false // Reset offers
          // Keep user assignment? Generally when copying to a new day, we might keep it or reset it.
          // Let's keep it for now as "Repeated Shift".
      };

      setSchedule([...schedule, newShift]);
      await createScheduleShift(newShift);
      loadData();
  };

  // --- DRAG AND DROP LOGIC ---

  const handleDragStart = (e: React.DragEvent, shift: ScheduleShift) => {
      setIsDragging(true);
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', JSON.stringify(shift));
      // Create a clean drag image if possible, or browser default
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
      e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
      e.preventDefault();
      setIsDragging(false);
      const data = e.dataTransfer.getData('text/plain');
      if (!data) return;

      const srcShift = JSON.parse(data) as ScheduleShift;
      
      // Calculate Time Difference
      const oldStart = new Date(srcShift.startTime);
      const oldEnd = new Date(srcShift.endTime);
      
      const newStart = new Date(targetDate);
      newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
      
      const duration = oldEnd.getTime() - oldStart.getTime();
      const newEnd = new Date(newStart.getTime() + duration);

      // Check if COPY (Alt Key) or MOVE
      if (e.altKey) {
          // COPY
          const newShift: ScheduleShift = {
              ...srcShift,
              id: `sch_${Date.now()}_copy_${Math.random().toString(36).substr(2,5)}`,
              startTime: newStart.getTime(),
              endTime: newEnd.getTime(),
              status: 'draft',
              bids: [],
              isOffered: false
          };
          setSchedule([...schedule, newShift]);
          await createScheduleShift(newShift);
      } else {
          // MOVE (Update)
          // Optimistic UI Update
          setSchedule(prev => prev.map(s => s.id === srcShift.id ? { ...s, startTime: newStart.getTime(), endTime: newEnd.getTime() } : s));
          await updateScheduleShift(srcShift.id, {
              startTime: newStart.getTime(),
              endTime: newEnd.getTime()
          });
      }
      loadData();
  };

  // --- END DRAG AND DROP ---

  const getShiftDataFromForm = (overrideDay?: Date): any => {
      if (!user?.currentCompanyId) return null;
      const targetDay = overrideDay || selectedDay;
      if (!targetDay) return null;

      const [sH, sM] = shiftStart.split(':').map(Number);
      
      const startTs = new Date(targetDay);
      startTs.setHours(sH, sM, 0, 0);
      
      let endTs;
      const showFinish = company?.settings.rotaShowFinishTimes !== false;

      if (showFinish) {
          const [eH, eM] = shiftEnd.split(':').map(Number);
          endTs = new Date(targetDay);
          endTs.setHours(eH, eM, 0, 0);
          
          // Auto-adjust for overnight shifts
          if (endTs <= startTs) {
              endTs.setDate(endTs.getDate() + 1);
          }
      } else {
          endTs = new Date(startTs.getTime() + (8 * 60 * 60 * 1000));
      }

      const locationName = locations.find(l => l.id === shiftLocation)?.name || null;
      
      let userName: string | null = null;
      if (shiftUser !== 'open') {
          const u = staff.find(s => s.id === shiftUser);
          if (u) userName = u.name || 'Staff'; // Ensure never undefined
      }

      return {
          companyId: user.currentCompanyId,
          locationId: shiftLocation || null,
          locationName,
          userId: shiftUser === 'open' ? null : shiftUser,
          userName: userName, 
          role: shiftRole,
          startTime: startTs.getTime(),
          endTime: endTs.getTime(),
          status: 'draft', 
      };
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const shiftData = getShiftDataFromForm();
    if (!shiftData) return;

    // Sanitize to remove undefined if any crept in (redundant safety)
    const sanitizedShift = JSON.parse(JSON.stringify(shiftData));

    if (editingShift) {
        await updateScheduleShift(editingShift.id, sanitizedShift);
    } else {
        sanitizedShift.id = `sch_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
        await createScheduleShift(sanitizedShift as ScheduleShift);
    }

    setIsShiftModalOpen(false);
    loadData();
  };

  const handleRepeatShift = async (weeks: number) => {
      if (!selectedDay || !user?.currentCompanyId) return;
      const baseShiftData = getShiftDataFromForm();
      if (!baseShiftData) return;

      const showFinish = company?.settings.rotaShowFinishTimes !== false;
      const newShifts: ScheduleShift[] = [];
      
      for (let i = 1; i <= weeks; i++) {
          const nextDate = new Date(selectedDay);
          nextDate.setDate(nextDate.getDate() + (i * 7));
          
          const [sH, sM] = shiftStart.split(':').map(Number);
          const startTs = new Date(nextDate);
          startTs.setHours(sH, sM, 0, 0);
          
          let endTs;
          if (showFinish) {
              const [eH, eM] = shiftEnd.split(':').map(Number);
              endTs = new Date(nextDate);
              endTs.setHours(eH, eM, 0, 0);
              if (endTs <= startTs) endTs.setDate(endTs.getDate() + 1);
          } else {
              endTs = new Date(startTs.getTime() + (8 * 60 * 60 * 1000));
          }

          const shiftCopy = JSON.parse(JSON.stringify(baseShiftData)); // deep copy & sanitize
          newShifts.push({
              ...shiftCopy,
              id: `sch_${Date.now()}_${i}_${Math.random().toString(36).substr(2,5)}`,
              startTime: startTs.getTime(),
              endTime: endTs.getTime(),
          });
      }

      await createBatchScheduleShifts(newShifts);
      
      const sanitizedBase = JSON.parse(JSON.stringify(baseShiftData));
      if (!editingShift) {
          sanitizedBase.id = `sch_${Date.now()}_0`;
          await createScheduleShift(sanitizedBase);
      } else {
          await updateScheduleShift(editingShift.id, sanitizedBase);
      }

      setIsRepeatModalOpen(false);
      setIsShiftModalOpen(false);
      loadData();
  };

  const handleDeleteShift = async () => {
    if (!editingShift) return;
    if (confirm("Delete this shift?")) {
        await deleteScheduleShift(editingShift.id);
        setIsShiftModalOpen(false);
        loadData();
    }
  };

  const handlePublish = async () => {
    if (!user?.currentCompanyId) return;
    if (confirm("Publish all draft shifts? Staff will be able to see them.")) {
        await publishAllDrafts(user.currentCompanyId);
        loadData();
    }
  };

  const handleAssignBidder = async (shift: ScheduleShift, bidderId: string) => {
      const bidder = staff.find(s => s.id === bidderId);
      if (bidder) {
          // Confirm assignment
          if(!confirm(`Assign ${bidder.name} to this shift?`)) return;

          const safeUserName = bidder.name || 'Staff';
          await assignShiftToUser(shift.id, bidder.id, safeUserName);
          
          // Close modal to prevent state conflicts
          setIsShiftModalOpen(false);
          setEditingShift(null);
          loadData();
      }
  };

  // --- SUB-COMPONENTS ---

  const ShiftCard: React.FC<{ shift: ScheduleShift }> = ({ shift }) => {
      const isOpen = !shift.userId;
      const hasBids = shift.bids && shift.bids.length > 0;
      const showFinishTimes = company?.settings.rotaShowFinishTimes !== false;
      const isNoShow = !isOpen && showFinishTimes && Date.now() > shift.endTime && !actualShifts.find(s => s.scheduleShiftId === shift.id);
      const isOffered = shift.isOffered;

      return (
        <div 
            draggable
            onDragStart={(e) => handleDragStart(e, shift)}
            onClick={(e) => handleEditShift(shift, e)}
            className={`
                group relative p-2.5 rounded-xl border text-left cursor-grab active:cursor-grabbing transition-all shadow-sm hover:shadow-lg hover:scale-[1.02] mb-2
                ${shift.status === 'draft' 
                    ? 'bg-slate-800/40 border-slate-700 border-dashed opacity-80 hover:opacity-100' 
                    : isOpen 
                        ? 'bg-amber-900/10 border-amber-800/30 hover:bg-amber-900/20' 
                        : isOffered
                            ? 'bg-purple-900/10 border-purple-800/30 hover:bg-purple-900/20'
                            : isNoShow
                                ? 'bg-red-900/10 border-red-800/30'
                                : 'bg-slate-800 hover:bg-slate-700 border-l-4 border-l-brand-500 border-t-0 border-r-0 border-b-0'
                }
            `}
        >
            <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-bold text-slate-200 truncate uppercase tracking-wider">{shift.role}</span>
                {/* Status Indicator */}
                {shift.status === 'draft' && <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>}
                {isNoShow && !isOffered && <span title="No Show"><AlertTriangle className="w-3 h-3 text-red-500" /></span>}
                {isOffered && <span title="Up for Grabs"><ArrowRightLeft className="w-3 h-3 text-purple-400" /></span>}
                
                {/* Hover Actions */}
                <div className="absolute top-1 right-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/80 rounded p-0.5 backdrop-blur-sm">
                    <button 
                        onClick={(e) => handleQuickDuplicate(e, shift)}
                        className="p-1 text-slate-400 hover:text-white" title="Duplicate (Same Day)"
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                    <button 
                        onClick={(e) => handleCopyToClipboard(e, shift)}
                        className="p-1 text-slate-400 hover:text-brand-400" title="Copy to Clipboard"
                    >
                        <ClipboardCopy className="w-3 h-3" />
                    </button>
                </div>
            </div>

            <div className="text-[11px] text-slate-400 mb-2 flex items-center font-mono">
                {new Date(shift.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                {showFinishTimes ? (
                    <> - {new Date(shift.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</>
                ) : <span className="ml-1 opacity-50">→</span>}
            </div>
            
            {/* Show Bids badge if there are any bids, regardless of assigned status (allows swaps) */}
            {hasBids ? (
                <div className={`flex items-center space-x-1 text-[10px] font-medium ${isOpen ? 'text-amber-400' : 'text-purple-400'}`}>
                    <AlertCircle className="w-3 h-3" />
                    <span>{shift.bids?.length} Bids {isOpen ? '' : '(Swap)'}</span>
                </div>
            ) : isOpen ? (
                <div className="flex items-center space-x-1 text-[10px] font-medium text-amber-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>Open</span>
                </div>
            ) : (
                <div className="flex items-center space-x-2 text-xs text-white">
                    <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold">{shift.userName?.charAt(0)}</div>
                    <span className="truncate max-w-[100px]">{shift.userName?.split(' ')[0]}</span>
                </div>
            )}
        </div>
      );
  };

  const { start: weekStart } = getWeekRange(currentDate);
  const weekDates = Array.from({length: 7}, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
  });

  const pendingRequestsCount = timeOffRequests.length;
  const draftCount = schedule.filter(s => s.status === 'draft').length;

  return (
    <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
            <div>
                <h1 className="text-3xl font-bold text-white">Rota Management</h1>
                <p className="text-slate-400">Drag to move. Alt+Drag to copy.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                 <button 
                    onClick={() => setIsTimeOffModalOpen(true)}
                    className="relative glass-panel hover:bg-white/10 text-white px-4 py-2.5 rounded-xl font-medium transition flex items-center space-x-2 border border-white/10"
                >
                    <Clock className="w-4 h-4" />
                    <span className="hidden sm:inline">Time Off</span>
                    {pendingRequestsCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {pendingRequestsCount}
                        </span>
                    )}
                </button>
                <div className="flex rounded-xl glass-panel border border-white/10 p-1">
                    <button 
                        onClick={handleCopyWeek}
                        className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
                    >
                        Copy Previous
                    </button>
                    <div className="w-px bg-white/10 mx-1"></div>
                    <button 
                        onClick={handleClearDrafts}
                        className="px-3 py-1.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition flex items-center gap-1"
                    >
                        <Trash2 className="w-3 h-3" /> Clear Drafts
                    </button>
                </div>
                <button 
                    onClick={handlePublish}
                    disabled={draftCount === 0}
                    className="bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition disabled:opacity-50 flex items-center space-x-2"
                >
                    <Send className="w-4 h-4" />
                    <span>Publish ({draftCount})</span>
                </button>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between glass-panel p-2 rounded-xl border border-white/10 shrink-0">
            <div className="flex items-center space-x-2">
                <button onClick={handlePrev} className="p-2 hover:bg-white/10 rounded-lg text-white"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={handleToday} className="px-3 py-1 text-sm font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-lg">Today</button>
                <button onClick={handleNext} className="p-2 hover:bg-white/10 rounded-lg text-white"><ChevronRight className="w-5 h-5" /></button>
                <div className="text-lg font-bold text-white px-2">
                    {viewMode === 'week' 
                        ? `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${new Date(weekStart.getTime() + 6*86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                        : currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
                    }
                </div>
            </div>
            
            {clipboardShift && (
                <div className="hidden md:flex items-center space-x-2 bg-brand-900/30 px-3 py-1.5 rounded-lg border border-brand-500/30 animate-fade-in">
                    <ClipboardCopy className="w-4 h-4 text-brand-400" />
                    <span className="text-xs font-bold text-brand-200">Copied: {clipboardShift.role}</span>
                    <button onClick={() => setClipboardShift(null)} className="ml-2 text-brand-400 hover:text-white"><X className="w-3 h-3" /></button>
                </div>
            )}

            <div className="flex bg-slate-800 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('week')}
                    className={`p-2 rounded-md transition ${viewMode === 'week' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Grid className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setViewMode('day')}
                    className={`p-2 rounded-md transition ${viewMode === 'day' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <LayoutList className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {viewMode === 'week' ? (
                // --- WEEK VIEW ---
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 min-h-full">
                    {weekDates.map((date, i) => {
                        const dayShifts = getShiftsForDay(date);
                        const isToday = new Date().toDateString() === date.toDateString();
                        
                        return (
                            <div 
                                key={i} 
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, date)}
                                className={`flex flex-col rounded-xl overflow-hidden border transition-colors ${
                                    isToday ? 'border-brand-500/50 bg-brand-900/10' : 'border-white/5 bg-white/5'
                                } ${isDragging ? 'hover:bg-brand-500/5 hover:border-brand-500/30' : ''}`}
                            >
                                {/* Header */}
                                <div className={`text-center p-3 border-b group relative ${isToday ? 'bg-brand-900/20 border-brand-500/30' : 'bg-white/5 border-white/5'}`}>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{WEEK_DAYS[i]}</div>
                                    <div className={`text-lg font-bold ${isToday ? 'text-brand-400' : 'text-white'}`}>
                                        {date.getDate()}
                                    </div>
                                    
                                    {/* Paste Button in Header */}
                                    {clipboardShift && (
                                        <button 
                                            onClick={() => handlePasteToDay(date)}
                                            className="absolute right-2 top-2 p-1.5 bg-brand-600 text-white rounded shadow-lg hover:bg-brand-500 transition opacity-0 group-hover:opacity-100"
                                            title="Paste Shift Here"
                                        >
                                            <ClipboardPaste className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Body */}
                                <div className="flex-1 p-2 space-y-2 min-h-[10rem]">
                                    {dayShifts.map(shift => (
                                        <ShiftCard key={shift.id} shift={shift} />
                                    ))}
                                    <button 
                                        onClick={() => handleAddShift(date)}
                                        className="w-full py-3 border-2 border-dashed border-white/10 rounded-lg text-slate-500 hover:border-brand-500/50 hover:text-brand-400 hover:bg-brand-500/10 transition flex items-center justify-center group"
                                    >
                                        <Plus className="w-4 h-4 group-hover:scale-125 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                // --- DAY VIEW (Grouped by Role) ---
                <div className="glass-panel rounded-xl p-6 min-h-full border border-white/10">
                    {(() => {
                        const dayShifts = getShiftsForDay(currentDate);
                        const grouped: Record<string, ScheduleShift[]> = {};
                        dayShifts.forEach(s => {
                            const key = s.role || 'Unassigned';
                            if (!grouped[key]) grouped[key] = [];
                            grouped[key].push(s);
                        });

                        const roles = Object.keys(grouped).sort();

                        return (
                            <div className="space-y-8">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-white">
                                        {currentDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </h2>
                                    <div className="flex gap-2">
                                        {clipboardShift && (
                                            <button 
                                                onClick={() => handlePasteToDay(currentDate)}
                                                className="bg-slate-700 text-slate-200 px-4 py-2 rounded-lg font-bold hover:bg-slate-600 transition flex items-center space-x-2"
                                            >
                                                <ClipboardPaste className="w-4 h-4" />
                                                <span>Paste</span>
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleAddShift(currentDate)}
                                            className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition flex items-center space-x-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add Shift</span>
                                        </button>
                                    </div>
                                </div>

                                {roles.length === 0 ? (
                                    <div className="text-center py-20 text-slate-500">
                                        <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p>No shifts scheduled for this day.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {roles.map(role => (
                                            <div key={role} className="bg-slate-800/50 rounded-xl p-4 border border-white/5">
                                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                                                    <h3 className="font-bold text-white">{role}</h3>
                                                    <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
                                                        {grouped[role].length}
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {grouped[role].map(shift => (
                                                        <ShiftCard key={shift.id} shift={shift} />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>

        {/* --- MODALS --- */}
        {isShiftModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-2xl border border-white/10 bg-slate-900">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-white">
                            {editingShift ? 'Edit Shift' : `Add Shift`}
                        </h3>
                        <button onClick={() => setIsShiftModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                    </div>

                    <form onSubmit={handleSaveShift} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Role / Position</label>
                            <input 
                                type="text" required
                                value={shiftRole} onChange={e => setShiftRole(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none placeholder:text-slate-600"
                                placeholder="e.g. Bar Staff"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Start Time</label>
                                <input 
                                    type="time" required
                                    value={shiftStart} onChange={e => setShiftStart(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">End Time</label>
                                {company?.settings.rotaShowFinishTimes !== false ? (
                                    <input 
                                        type="time" required
                                        value={shiftEnd} onChange={e => setShiftEnd(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                ) : (
                                    <div className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 text-sm flex items-center">
                                        <ArrowRight className="w-4 h-4 mr-2" /> Till Finish
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Assign Staff</label>
                            <select 
                                value={shiftUser} onChange={e => setShiftUser(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                                <option value="open">-- Open / Unassigned --</option>
                                {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.position || 'Staff'})</option>
                                ))}
                            </select>
                        </div>

                         <div>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Location</label>
                            <select 
                                value={shiftLocation} onChange={e => setShiftLocation(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                                <option value="">-- No Specific Location --</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Bids Section: Show for both Unassigned AND Assigned (for swaps) */}
                        {editingShift && editingShift.bids && editingShift.bids.length > 0 && (
                            <div className="bg-amber-900/20 p-4 rounded-lg border border-amber-900/30 animate-fade-in">
                                <h4 className="text-sm font-bold text-amber-400 mb-2">
                                    {editingShift.userId ? 'Swap Requests' : 'Staff Bids'} ({editingShift.bids.length})
                                </h4>
                                <div className="space-y-2">
                                    {editingShift.bids.map(bidderId => {
                                        const b = staff.find(s => s.id === bidderId);
                                        if (!b) return null;
                                        return (
                                            <div key={bidderId} className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700">
                                                <span className="text-sm text-slate-200">{b.name}</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleAssignBidder(editingShift, bidderId)}
                                                    className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded font-bold hover:bg-amber-500 transition"
                                                >
                                                    {editingShift.userId ? 'Approve Swap' : 'Assign'}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-white/5">
                             <button 
                                type="button" 
                                onClick={() => setIsRepeatModalOpen(true)}
                                className="flex-1 py-2 text-xs font-bold text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600 flex items-center justify-center space-x-1"
                            >
                                <Repeat className="w-3 h-3" />
                                <span>Repeat</span>
                            </button>
                        </div>

                        <div className="flex gap-3 pt-4">
                            {editingShift && (
                                <button type="button" onClick={handleDeleteShift} className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg font-bold transition">Delete</button>
                            )}
                            <div className="flex-1"></div>
                            <button type="button" onClick={() => setIsShiftModalOpen(false)} className="px-4 py-2 text-slate-400 font-bold hover:text-white transition">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {isRepeatModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                 <div className="glass-panel w-full max-w-sm p-6 rounded-2xl shadow-xl border border-white/10 bg-slate-900">
                     <h3 className="font-bold text-lg text-white mb-4">Repeat Shift</h3>
                     <p className="text-sm text-slate-400 mb-4">Create copies of this shift for upcoming weeks.</p>
                     
                     <div className="space-y-2">
                        <button onClick={() => handleRepeatShift(4)} className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-left font-medium text-white transition border border-white/5">Repeat for 4 Weeks</button>
                        <button onClick={() => handleRepeatShift(8)} className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-left font-medium text-white transition border border-white/5">Repeat for 8 Weeks</button>
                        <button onClick={() => handleRepeatShift(12)} className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-left font-medium text-white transition border border-white/5">Repeat for 12 Weeks</button>
                     </div>
                     
                     <button onClick={() => setIsRepeatModalOpen(false)} className="mt-4 w-full py-2 text-slate-400 font-bold text-sm hover:text-white transition">Cancel</button>
                 </div>
            </div>
        )}

        {isTimeOffModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-lg p-6 rounded-2xl shadow-xl border border-white/10 bg-slate-900 h-[80vh] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-white">Time Off Requests</h3>
                        <button onClick={() => setIsTimeOffModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {timeOffRequests.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">No pending requests.</div>
                        ) : (
                            timeOffRequests.map(req => (
                                <div key={req.id} className="border border-white/10 bg-white/5 rounded-xl p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-white">{req.userName}</h4>
                                            <span className="text-xs font-bold uppercase text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{req.type}</span>
                                        </div>
                                        <div className="text-right text-xs text-slate-500">
                                            Requested {new Date(req.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-300 mb-4">
                                        {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                        {req.reason && <p className="mt-1 italic text-slate-400">"{req.reason}"</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleTimeOffAction(req.id, 'rejected')}
                                            className="flex-1 py-2 border border-slate-700 rounded-lg text-slate-300 font-medium hover:bg-slate-800 transition"
                                        >
                                            Deny
                                        </button>
                                        <button 
                                            onClick={() => handleTimeOffAction(req.id, 'approved')}
                                            className="flex-1 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition"
                                        >
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
