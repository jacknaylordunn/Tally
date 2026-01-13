
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSchedule, createScheduleShift, updateScheduleShift, deleteScheduleShift, getCompanyStaff, getLocations, assignShiftToUser, getTimeOffRequests, updateTimeOffStatus, publishAllDrafts, createBatchScheduleShifts, copyScheduleWeek, getCompany, getShifts } from '../services/api';
import { ScheduleShift, User, Location, TimeOffRequest, Company, Shift } from '../types';
import { ChevronLeft, ChevronRight, Plus, MapPin, User as UserIcon, Calendar, X, Clock, AlertCircle, Send, Copy, Repeat, LayoutList, Grid, Lock, AlertTriangle, CalendarCheck, ArrowRight } from 'lucide-react';

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

  if (company && company.settings.rotaEnabled === false) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Rota System Disabled</h2>
              <p className="text-slate-500 max-w-md">The scheduling features are currently turned off for your company. Please enable them in Settings if you wish to use them.</p>
          </div>
      );
  }

  // --- ACTIONS ---

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
          // If finish times are disabled, set end time to 8 hours later purely for the backend validity
          // This ensures the shift appears on the correct calendar day
          endTs = new Date(startTs.getTime() + (8 * 60 * 60 * 1000));
      }

      const locationName = locations.find(l => l.id === shiftLocation)?.name;
      const userName = shiftUser === 'open' ? undefined : staff.find(u => u.id === shiftUser)?.name;

      return {
          companyId: user.currentCompanyId,
          locationId: shiftLocation,
          locationName,
          userId: shiftUser === 'open' ? null : shiftUser,
          userName,
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

    if (editingShift) {
        await updateScheduleShift(editingShift.id, shiftData);
    } else {
        shiftData.id = `sch_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
        await createScheduleShift(shiftData as ScheduleShift);
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

          newShifts.push({
              ...baseShiftData,
              id: `sch_${Date.now()}_${i}_${Math.random().toString(36).substr(2,5)}`,
              startTime: startTs.getTime(),
              endTime: endTs.getTime(),
          });
      }

      await createBatchScheduleShifts(newShifts);
      
      if (!editingShift) {
          baseShiftData.id = `sch_${Date.now()}_0`;
          await createScheduleShift(baseShiftData);
      } else {
          await updateScheduleShift(editingShift.id, baseShiftData);
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
          await assignShiftToUser(shift.id, bidder.id, bidder.name);
          loadData();
      }
  };

  const handleTimeOffAction = async (reqId: string, status: 'approved' | 'rejected') => {
      await updateTimeOffStatus(reqId, status);
      setTimeOffRequests(prev => prev.filter(r => r.id !== reqId));
  };

  // --- RENDER HELPERS ---

  const { start: weekStart } = getWeekRange(currentDate);
  const weekDates = Array.from({length: 7}, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
  });

  const getShiftsForDay = (date: Date) => {
      const startOfDay = new Date(date); startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(date); endOfDay.setHours(23,59,59,999);
      
      return schedule.filter(s => s.startTime >= startOfDay.getTime() && s.startTime <= endOfDay.getTime())
          .sort((a,b) => a.startTime - b.startTime);
  };

  const pendingRequestsCount = timeOffRequests.length;
  const draftCount = schedule.filter(s => s.status === 'draft').length;
  const showFinishTimes = company?.settings.rotaShowFinishTimes !== false;

  // --- SUB-COMPONENTS ---

  const ShiftCard: React.FC<{ shift: ScheduleShift }> = ({ shift }) => {
      const isOpen = !shift.userId;
      const hasBids = shift.bids && shift.bids.length > 0;
      
      // No Show Logic: 
      // 1. Shift is assigned (not open)
      // 2. Shift end time is in the past (Only relevant if finish times are active)
      // 3. No actual shift found that links to this schedule ID
      const isPast = showFinishTimes && Date.now() > shift.endTime;
      const matchingActual = !isOpen ? actualShifts.find(s => s.scheduleShiftId === shift.id) : null;
      const isNoShow = !isOpen && isPast && !matchingActual;

      // Robust Overnight Check (compare full date strings)
      const startD = new Date(shift.startTime);
      const endD = new Date(shift.endTime);
      const isOvernight = startD.toDateString() !== endD.toDateString();

      return (
        <div 
            onClick={(e) => handleEditShift(shift, e)}
            className={`
                group relative p-2 rounded-lg border text-left cursor-pointer transition shadow-sm hover:shadow-md mb-2
                ${shift.status === 'draft' 
                    ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 border-dashed opacity-80' 
                    : isOpen 
                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' 
                        : isNoShow
                            ? 'bg-red-50 dark:bg-red-900/10 border-red-300 dark:border-red-800'
                            : 'bg-white dark:bg-slate-800 border-l-4 border-l-brand-500 border-slate-200 dark:border-slate-700'
                }
            `}
        >
            <div className="flex justify-between items-start mb-1">
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate uppercase tracking-wider">{shift.role}</span>
                {shift.status === 'draft' && <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>}
                {isNoShow && <span title="No Show"><AlertTriangle className="w-3 h-3 text-red-500" /></span>}
            </div>
            <div className="text-[10px] text-slate-500 mb-1 flex items-center">
                {new Date(shift.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                {showFinishTimes ? (
                    <>
                        - {new Date(shift.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        {isOvernight && <span className="ml-1 text-[9px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/50 px-1 rounded">+1</span>}
                    </>
                ) : (
                    <span className="ml-1 opacity-50">→</span>
                )}
            </div>
            
            {isOpen ? (
                <div className="flex items-center space-x-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>{hasBids ? `${shift.bids?.length} Bids` : 'Open'}</span>
                </div>
            ) : (
                <div className="flex items-center space-x-1 text-[10px] text-slate-600 dark:text-slate-300">
                    <UserIcon className="w-3 h-3" />
                    <span className="truncate max-w-[100px]">{shift.userName?.split(' ')[0]}</span>
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Rota Management</h1>
                <p className="text-slate-500">Plan shifts and manage availability.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                 <button 
                    onClick={() => setIsTimeOffModalOpen(true)}
                    className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center space-x-2"
                >
                    <Clock className="w-4 h-4" />
                    <span className="hidden sm:inline">Time Off</span>
                    {pendingRequestsCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {pendingRequestsCount}
                        </span>
                    )}
                </button>
                <button 
                    onClick={handleCopyWeek}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center space-x-2"
                >
                    <Copy className="w-4 h-4" />
                    <span className="hidden sm:inline">Copy Previous Week</span>
                </button>
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
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
            <div className="flex items-center space-x-2">
                <button onClick={handlePrev} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={handleToday} className="px-3 py-1 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Today</button>
                <button onClick={handleNext} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><ChevronRight className="w-5 h-5" /></button>
                <div className="text-lg font-bold text-slate-900 dark:text-white px-2">
                    {viewMode === 'week' 
                        ? `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${new Date(weekStart.getTime() + 6*86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                        : currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
                    }
                </div>
            </div>
            
            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('week')}
                    className={`p-2 rounded-md transition ${viewMode === 'week' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Grid className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setViewMode('day')}
                    className={`p-2 rounded-md transition ${viewMode === 'day' ? 'bg-white dark:bg-slate-600 shadow-sm text-brand-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutList className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
            {viewMode === 'week' ? (
                // --- WEEK VIEW ---
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 min-h-full">
                    {weekDates.map((date, i) => {
                        const dayShifts = getShiftsForDay(date);
                        const isToday = new Date().toDateString() === date.toDateString();
                        
                        return (
                            <div key={i} className={`flex flex-col rounded-xl overflow-hidden border ${isToday ? 'border-brand-200 bg-brand-50/30 dark:border-brand-900/50' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                                {/* Header */}
                                <div className={`text-center p-3 border-b ${isToday ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-100' : 'bg-slate-50 dark:bg-slate-700/30 border-slate-100 dark:border-slate-700'}`}>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{WEEK_DAYS[i]}</div>
                                    <div className={`text-lg font-bold ${isToday ? 'text-brand-600 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>
                                        {date.getDate()}
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="flex-1 p-2 space-y-2 min-h-[10rem]">
                                    {dayShifts.map(shift => (
                                        <ShiftCard key={shift.id} shift={shift} />
                                    ))}
                                    <button 
                                        onClick={() => handleAddShift(date)}
                                        className="w-full py-3 border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-lg text-slate-300 hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition flex items-center justify-center"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                // --- DAY VIEW (Grouped by Role) ---
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 min-h-full">
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
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {currentDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </h2>
                                    <button 
                                        onClick={() => handleAddShift(currentDate)}
                                        className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition flex items-center space-x-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Add Shift</span>
                                    </button>
                                </div>

                                {roles.length === 0 ? (
                                    <div className="text-center py-20 text-slate-400">
                                        <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p>No shifts scheduled for this day.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {roles.map(role => (
                                            <div key={role} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                                                    <h3 className="font-bold text-slate-900 dark:text-white">{role}</h3>
                                                    <span className="bg-white dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-md p-6 rounded-2xl shadow-xl border dark:border-slate-700">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                            {editingShift ? 'Edit Shift' : `Add Shift`}
                        </h3>
                        <button onClick={() => setIsShiftModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                    </div>

                    <form onSubmit={handleSaveShift} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Role / Position</label>
                            <input 
                                type="text" required
                                value={shiftRole} onChange={e => setShiftRole(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white"
                                placeholder="e.g. Bar Staff"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Start Time</label>
                                <input 
                                    type="time" required
                                    value={shiftStart} onChange={e => setShiftStart(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white"
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">End Time</label>
                                {showFinishTimes ? (
                                    <input 
                                        type="time" required
                                        value={shiftEnd} onChange={e => setShiftEnd(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white"
                                    />
                                ) : (
                                    <div className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400 text-sm flex items-center">
                                        <ArrowRight className="w-4 h-4 mr-2" /> Till Finish
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Assign Staff</label>
                            <select 
                                value={shiftUser} onChange={e => setShiftUser(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="open">-- Open / Unassigned --</option>
                                {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.position || 'Staff'})</option>
                                ))}
                            </select>
                        </div>

                         <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Location</label>
                            <select 
                                value={shiftLocation} onChange={e => setShiftLocation(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="">-- No Specific Location --</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        {editingShift && !editingShift.userId && editingShift.bids && editingShift.bids.length > 0 && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200 mb-2">Staff Bids ({editingShift.bids.length})</h4>
                                <div className="space-y-2">
                                    {editingShift.bids.map(bidderId => {
                                        const b = staff.find(s => s.id === bidderId);
                                        if (!b) return null;
                                        return (
                                            <div key={bidderId} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded border border-amber-100 dark:border-amber-800">
                                                <span className="text-sm dark:text-slate-200">{b.name}</span>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleAssignBidder(editingShift, bidderId)}
                                                    className="text-xs bg-amber-200 dark:bg-amber-700 text-amber-900 dark:text-amber-100 px-2 py-1 rounded font-bold"
                                                >
                                                    Assign
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                             <button 
                                type="button" 
                                onClick={() => setIsRepeatModalOpen(true)}
                                className="flex-1 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 flex items-center justify-center space-x-1"
                            >
                                <Repeat className="w-3 h-3" />
                                <span>Repeat</span>
                            </button>
                        </div>

                        <div className="flex gap-3 pt-4">
                            {editingShift && (
                                <button type="button" onClick={handleDeleteShift} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg font-bold transition">Delete</button>
                            )}
                            <div className="flex-1"></div>
                            <button type="button" onClick={() => setIsShiftModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition">Cancel</button>
                            <button type="submit" className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {isRepeatModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                 <div className="bg-white dark:bg-slate-800 w-full max-w-sm p-6 rounded-2xl shadow-xl border dark:border-slate-700">
                     <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-4">Repeat Shift</h3>
                     <p className="text-sm text-slate-500 mb-4">Create copies of this shift for upcoming weeks.</p>
                     
                     <div className="space-y-2">
                        <button onClick={() => handleRepeatShift(4)} className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-left font-medium text-slate-700 dark:text-white transition">Repeat for 4 Weeks</button>
                        <button onClick={() => handleRepeatShift(8)} className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-left font-medium text-slate-700 dark:text-white transition">Repeat for 8 Weeks</button>
                        <button onClick={() => handleRepeatShift(12)} className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-left font-medium text-slate-700 dark:text-white transition">Repeat for 12 Weeks</button>
                     </div>
                     
                     <button onClick={() => setIsRepeatModalOpen(false)} className="mt-4 w-full py-2 text-slate-400 font-bold text-sm hover:text-slate-600 transition">Cancel</button>
                 </div>
            </div>
        )}

        {isTimeOffModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white dark:bg-slate-800 w-full max-w-lg p-6 rounded-2xl shadow-xl border dark:border-slate-700 h-[80vh] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Time Off Requests</h3>
                        <button onClick={() => setIsTimeOffModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {timeOffRequests.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">No pending requests.</div>
                        ) : (
                            timeOffRequests.map(req => (
                                <div key={req.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">{req.userName}</h4>
                                            <span className="text-xs font-bold uppercase text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{req.type}</span>
                                        </div>
                                        <div className="text-right text-xs text-slate-400">
                                            Requested {new Date(req.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                                        {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                        {req.reason && <p className="mt-1 italic">"{req.reason}"</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleTimeOffAction(req.id, 'rejected')}
                                            className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
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
