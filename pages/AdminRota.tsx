
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSchedule, createScheduleShift, updateScheduleShift, deleteScheduleShift, getCompanyStaff, getLocations, assignShiftToUser, getTimeOffRequests, updateTimeOffStatus, publishDrafts, createBatchScheduleShifts, copyScheduleWeek, getCompany, getShifts, updateBatchScheduleShifts, getGlobalDraftCount } from '../services/api';
import { ScheduleShift, User, Location, TimeOffRequest, Company, Shift } from '../types';
import { ChevronLeft, ChevronRight, Plus, MapPin, User as UserIcon, Calendar, X, Clock, AlertCircle, Send, Copy, Repeat, LayoutList, Grid, Lock, AlertTriangle, CalendarCheck, ArrowRight, ClipboardCopy, ClipboardPaste, Trash2, Move, ArrowRightLeft, Layers, Users, Printer, Settings, Check, LayoutTemplate, AlignJustify, Table, ChevronDown, MousePointer2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const AdminRota = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [company, setCompany] = useState<Company | null>(null);
  
  const [schedule, setSchedule] = useState<ScheduleShift[]>([]);
  const [actualShifts, setActualShifts] = useState<Shift[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalDraftCount, setGlobalDraftCount] = useState(0);

  // Print Settings State
  const [isPrintSettingsOpen, setIsPrintSettingsOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState({
      layout: 'list' as 'list' | 'staff_grid' | 'date_grid',
      showLocation: true,
      showRole: true,
      showUnassigned: true
  });

  // Publish State
  const [isPublishMenuOpen, setIsPublishMenuOpen] = useState(false);

  // Modal States
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isTimeOffModalOpen, setIsTimeOffModalOpen] = useState(false);
  const [isRepeatModalOpen, setIsRepeatModalOpen] = useState(false);
  const [repeatSourceShift, setRepeatSourceShift] = useState<ScheduleShift | null>(null);
  
  // Context Menu State
  // Type discriminates between clicking a specific shift or a general day area
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: 'shift' | 'day', data: any } | null>(null);
  const [clipboard, setClipboard] = useState<ScheduleShift | null>(null);
  const [dayClipboard, setDayClipboard] = useState<ScheduleShift[] | null>(null);
  
  // Expanded Group State
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null);

  // Form States
  const [shiftRole, setShiftRole] = useState('Staff');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [shiftUser, setShiftUser] = useState<string>('open'); 
  const [shiftLocation, setShiftLocation] = useState<string>('');
  const [shiftQuantity, setShiftQuantity] = useState(1);

  // Repeat Form States
  const [repeatMode, setRepeatMode] = useState<'daily_week' | 'custom'>('daily_week');
  const [repeatEndDate, setRepeatEndDate] = useState('');
  const [repeatDays, setRepeatDays] = useState<number[]>([]); // 0=Sun, 1=Mon...

  // Drag State
  const dragItem = useRef<ScheduleShift | null>(null);

  useEffect(() => {
    loadData();
  }, [user, currentDate]);

  // Close context menu on global click
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

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

    const [schedData, staffData, locData, timeOffData, companyData, actualsData, draftCountData] = await Promise.all([
        getSchedule(user.currentCompanyId, start.getTime(), end.getTime()),
        getCompanyStaff(user.currentCompanyId),
        getLocations(user.currentCompanyId),
        getTimeOffRequests(user.currentCompanyId),
        getCompany(user.currentCompanyId),
        getShifts(user.currentCompanyId),
        getGlobalDraftCount(user.currentCompanyId)
    ]);
    
    setSchedule(schedData);
    setStaff(staffData);
    setLocations(locData);
    setTimeOffRequests(timeOffData.filter(r => r.status === 'pending'));
    setCompany(companyData);
    setActualShifts(actualsData); 
    setGlobalDraftCount(draftCountData);
    setLoading(false);
  };

  if (company && company.settings.rotaEnabled === false) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center border border-slate-200 dark:border-white/10">
                  <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Rota System Disabled</h2>
              <p className="text-slate-500 max-w-md">The scheduling features are currently turned off for your company. Please enable them in Settings if you wish to use them.</p>
          </div>
      );
  }

  // --- GROUPING LOGIC ---
  const getGroupKey = (s: ScheduleShift) => {
      return `${s.role}_${s.startTime}_${s.endTime}_${s.locationId || 'nal'}`;
  };

  const groupShifts = (shifts: ScheduleShift[]) => {
      const groups: Record<string, ScheduleShift[]> = {};
      shifts.forEach(s => {
          const key = getGroupKey(s);
          if (!groups[key]) groups[key] = [];
          groups[key].push(s);
      });
      return groups;
  };

  const getShiftsForDay = (date: Date) => {
    return schedule.filter(s => {
      const sDate = new Date(s.startTime);
      return sDate.getDate() === date.getDate() &&
             sDate.getMonth() === date.getMonth() &&
             sDate.getFullYear() === date.getFullYear();
    }).sort((a, b) => a.startTime - b.startTime);
  };

  const getShiftsForCell = (date: Date, userId: string | null) => {
      return schedule.filter(s => {
          const sDate = new Date(s.startTime);
          const isSameDate = sDate.getDate() === date.getDate() && 
                             sDate.getMonth() === date.getMonth() && 
                             sDate.getFullYear() === date.getFullYear();
          const isSameUser = s.userId === userId;
          return isSameDate && isSameUser;
      }).sort((a,b) => a.startTime - b.startTime);
  };

  // --- ACTIONS ---

  const handleTimeOffAction = async (requestId: string, status: 'approved' | 'rejected') => {
      if (!user?.currentCompanyId) return;
      try {
          await updateTimeOffStatus(requestId, status);
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
      const drafts = schedule.filter(s => s.status === 'draft');
      if (drafts.length === 0) return;
      setLoading(true);
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
    setShiftQuantity(1);
    setIsShiftModalOpen(true);
  };

  const handleEditShift = (shift: ScheduleShift, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingShift(shift);
    setSelectedDay(new Date(shift.startTime));
    setShiftRole(shift.role);
    const s = new Date(shift.startTime);
    const eTime = new Date(shift.endTime);
    setShiftStart(s.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}));
    setShiftEnd(eTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}));
    setShiftUser(shift.userId || 'open');
    setShiftLocation(shift.locationId || '');
    setShiftQuantity(1); 
    setIsShiftModalOpen(true);
  };

  const handleDuplicateShift = async (shift: ScheduleShift, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const newShift: any = { ...shift };
      newShift.id = `sch_${Date.now()}_dup_${Math.random().toString(36).substr(2,5)}`;
      newShift.status = 'draft';
      newShift.userId = null; 
      delete newShift.userName; 
      newShift.bids = [];
      newShift.isOffered = false;
      await createScheduleShift(newShift as ScheduleShift);
      loadData();
  };

  const handleCopyShift = (shift: ScheduleShift, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setClipboard(shift);
      setContextMenu(null);
  };

  const handlePasteShift = async (targetDate: Date) => {
      if (!clipboard) return;
      const duration = clipboard.endTime - clipboard.startTime;
      const newStart = new Date(targetDate);
      const originalStart = new Date(clipboard.startTime);
      newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
      const startTime = newStart.getTime();
      const endTime = startTime + duration;

      const newShift: any = { ...clipboard };
      newShift.id = `sch_${Date.now()}_paste_${Math.random().toString(36).substr(2,5)}`;
      newShift.startTime = startTime;
      newShift.endTime = endTime;
      newShift.status = 'draft';
      newShift.userId = null;
      delete newShift.userName;
      newShift.bids = [];
      newShift.isOffered = false;

      await createScheduleShift(newShift);
      loadData();
      setContextMenu(null);
  };

  const handleCopyDay = (date: Date) => {
      const shifts = getShiftsForDay(date);
      if (shifts.length === 0) {
          alert("No shifts to copy on this day.");
          setContextMenu(null);
          return;
      }
      setDayClipboard(shifts);
      setContextMenu(null);
  };

  const handlePasteDay = async (targetDate: Date) => {
      if (!dayClipboard) return;
      if (!confirm(`Paste ${dayClipboard.length} shifts to ${targetDate.toLocaleDateString()}?`)) return;
      
      setLoading(true);
      const newShifts = dayClipboard.map(s => {
          const sStart = new Date(s.startTime);
          const sEnd = new Date(s.endTime);
          
          const nStart = new Date(targetDate);
          nStart.setHours(sStart.getHours(), sStart.getMinutes(), 0, 0);
          
          const duration = sEnd.getTime() - sStart.getTime();
          const nEnd = new Date(nStart.getTime() + duration);
          
          const newShift: any = {
              ...s,
              id: `sch_${Date.now()}_pd_${Math.random().toString(36).substr(2,5)}_${Math.floor(Math.random()*1000)}`,
              startTime: nStart.getTime(),
              endTime: nEnd.getTime(),
              status: 'draft',
              userId: null,
              bids: [],
              isOffered: false
          };
          delete newShift.userName;
          return newShift as ScheduleShift;
      });
      
      await createBatchScheduleShifts(newShifts);
      loadData();
      setContextMenu(null);
  };

  // --- REPEAT LOGIC ---
  const handleRepeatClick = (shift: ScheduleShift, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setRepeatSourceShift(shift);
      setContextMenu(null);
      // Defaults
      setRepeatMode('daily_week');
      setRepeatEndDate('');
      setRepeatDays([]);
      setIsRepeatModalOpen(true);
  };

  const handleConfirmRepeat = async () => {
      if (!repeatSourceShift) return;
      
      setLoading(true);
      const batch: ScheduleShift[] = [];
      const duration = repeatSourceShift.endTime - repeatSourceShift.startTime;
      const sourceDate = new Date(repeatSourceShift.startTime);
      
      let cursorDate = new Date(sourceDate);
      cursorDate.setDate(cursorDate.getDate() + 1); // Start next day by default
      
      let cutoffDate = new Date();

      if (repeatMode === 'daily_week') {
          const { end } = getWeekRange(currentDate);
          cutoffDate = end;
          while (cursorDate <= cutoffDate) {
              const newStart = new Date(cursorDate);
              newStart.setHours(sourceDate.getHours(), sourceDate.getMinutes(), 0, 0);
              const newEndTs = newStart.getTime() + duration;
              const newItem = createRepeatItem(repeatSourceShift, newStart.getTime(), newEndTs);
              batch.push(newItem);
              cursorDate.setDate(cursorDate.getDate() + 1);
          }
      } 
      else if (repeatMode === 'custom') {
          if (!repeatEndDate) {
              alert("Please select an end date.");
              setLoading(false);
              return;
          }
          cutoffDate = new Date(repeatEndDate);
          cutoffDate.setHours(23, 59, 59, 999);
          if (cutoffDate <= sourceDate) {
              alert("End date must be after the shift date.");
              setLoading(false);
              return;
          }
          const targetDays = repeatDays.length > 0 ? repeatDays : [0, 1, 2, 3, 4, 5, 6];
          while (cursorDate <= cutoffDate) {
              const dayOfWeek = cursorDate.getDay(); 
              if (targetDays.includes(dayOfWeek)) {
                  const newStart = new Date(cursorDate);
                  newStart.setHours(sourceDate.getHours(), sourceDate.getMinutes(), 0, 0);
                  const newEndTs = newStart.getTime() + duration;
                  const newItem = createRepeatItem(repeatSourceShift, newStart.getTime(), newEndTs);
                  batch.push(newItem);
              }
              cursorDate.setDate(cursorDate.getDate() + 1);
          }
      }

      if (batch.length > 0) {
          await createBatchScheduleShifts(batch);
          loadData();
      }
      setIsRepeatModalOpen(false);
      setLoading(false);
  };

  const createRepeatItem = (source: ScheduleShift, start: number, end: number): ScheduleShift => {
      const copy: any = { ...source };
      copy.id = `sch_${Date.now()}_rep_${Math.random().toString(36).substr(2,5)}`;
      copy.startTime = start;
      copy.endTime = end;
      copy.status = 'draft';
      copy.userId = null; 
      delete copy.userName;
      copy.bids = [];
      copy.isOffered = false;
      return copy;
  };

  const toggleRepeatDay = (dayIndex: number) => {
      if (repeatDays.includes(dayIndex)) {
          setRepeatDays(prev => prev.filter(d => d !== dayIndex));
      } else {
          setRepeatDays(prev => [...prev, dayIndex]);
      }
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
          if (endTs <= startTs) endTs.setDate(endTs.getDate() + 1);
      } else {
          endTs = new Date(startTs.getTime() + (8 * 60 * 60 * 1000));
      }

      const locationName = locations.find(l => l.id === shiftLocation)?.name || null;
      let userName: string | null = null;
      if (shiftUser !== 'open') {
          const u = staff.find(s => s.id === shiftUser);
          if (u) userName = u.name || 'Staff'; 
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
    const baseShift = getShiftDataFromForm();
    if (!baseShift) return;

    if (editingShift) {
        await updateScheduleShift(editingShift.id, baseShift);
    } else {
        if (shiftQuantity > 1) {
            const shiftsToCreate = [];
            for (let i = 0; i < shiftQuantity; i++) {
                shiftsToCreate.push({
                    ...baseShift,
                    id: `sch_${Date.now()}_${i}_${Math.random().toString(36).substr(2,5)}`
                });
            }
            await createBatchScheduleShifts(shiftsToCreate);
        } else {
            const newId = `sch_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
            await createScheduleShift({ ...baseShift, id: newId });
        }
    }

    setIsShiftModalOpen(false);
    loadData();
  };

  const handleDeleteShift = async (id?: string) => {
    const targetId = id || editingShift?.id;
    if (!targetId) return;
    if (confirm("Delete this shift?")) {
        await deleteScheduleShift(targetId);
        setIsShiftModalOpen(false);
        setEditingShift(null);
        loadData();
    }
  };

  const handlePublish = async (scope: 'week' | 'all') => {
    if (!user?.currentCompanyId) return;
    setIsPublishMenuOpen(false);
    
    // Calculate accurate counts for the confirmation dialog
    const weekDrafts = schedule.filter(s => s.status === 'draft').length;
    const confirmMsg = scope === 'week' 
        ? `Publish ${weekDrafts} draft shifts for the currently visible week?` 
        : `Publish ALL ${globalDraftCount} draft shifts across the entire schedule?`;
        
    if (confirm(confirmMsg)) {
        setLoading(true);
        try {
            if (scope === 'week') {
                const { start, end } = getWeekRange(currentDate);
                await publishDrafts(user.currentCompanyId, start.getTime(), end.getTime());
            } else {
                // No date range = publish all
                await publishDrafts(user.currentCompanyId);
            }
            // Add a small delay to allow Firestore to propagate, then reload
            setTimeout(() => loadData(), 500);
        } catch (e) {
            console.error("Publish failed", e);
            alert("Failed to publish shifts. Please try again.");
            setLoading(false);
        }
    }
  };

  const handleAssignBidder = async (shift: ScheduleShift, bidderId: string) => {
      const bidder = staff.find(s => s.id === bidderId);
      if (bidder) {
          if(!confirm(`Assign ${bidder.name} to this shift?`)) return;
          const safeUserName = bidder.name || 'Staff';
          const siblings = schedule.filter(s => 
              s.id !== shift.id &&
              s.role === shift.role &&
              s.startTime === shift.startTime &&
              s.endTime === shift.endTime &&
              s.locationId === shift.locationId
          );
          const updates: { id: string, data: Partial<ScheduleShift> }[] = [];
          updates.push({
              id: shift.id,
              data: {
                  userId: bidder.id,
                  userName: safeUserName,
                  bids: [],
                  isOffered: false,
                  status: 'draft' 
              }
          });
          siblings.forEach(s => {
              if (s.bids?.includes(bidder.id)) {
                  updates.push({
                      id: s.id,
                      data: { bids: s.bids.filter(b => b !== bidder.id) }
                  });
              }
          });
          await updateBatchScheduleShifts(updates);
          setIsShiftModalOpen(false);
          setEditingShift(null);
          loadData();
      }
  };

  // --- DRAG AND DROP ---
  const handleDragStart = (e: React.DragEvent, shift: ScheduleShift) => {
      e.dataTransfer.setData('text/plain', JSON.stringify(shift));
      e.dataTransfer.effectAllowed = 'copyMove';
      dragItem.current = shift;
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.altKey ? 'copy' : 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
      e.preventDefault();
      const data = e.dataTransfer.getData('text/plain');
      if (!data) return;
      const sourceShift: ScheduleShift = JSON.parse(data);
      const isCopy = e.altKey;
      const duration = sourceShift.endTime - sourceShift.startTime;
      const newStart = new Date(targetDate);
      const originalStart = new Date(sourceShift.startTime);
      newStart.setHours(originalStart.getHours(), originalStart.getMinutes());
      const newStartTime = newStart.getTime();
      const newEndTime = newStartTime + duration;

      if (isCopy) {
          const newShift: any = { ...sourceShift };
          newShift.id = `sch_${Date.now()}_drag_${Math.random().toString(36).substr(2,5)}`;
          newShift.startTime = newStartTime;
          newShift.endTime = newEndTime;
          newShift.status = 'draft';
          newShift.userId = null;
          delete newShift.userName;
          newShift.bids = [];
          newShift.isOffered = false;
          await createScheduleShift(newShift);
      } else {
          await updateScheduleShift(sourceShift.id, {
              startTime: newStartTime,
              endTime: newEndTime,
              status: 'draft' 
          });
      }
      loadData();
  };

  const handlePrintClick = () => setIsPrintSettingsOpen(true);
  const handleConfirmPrint = () => { setIsPrintSettingsOpen(false); setTimeout(() => window.print(), 300); };

  // --- VISUAL COMPONENTS ---
  const GroupShiftCard: React.FC<{ groupKey: string, shifts: ScheduleShift[] }> = ({ groupKey, shifts }) => {
      const isExpanded = expandedGroupId === groupKey;
      const assignedCount = shifts.filter(s => s.userId).length;
      const totalCount = shifts.length;
      const isFull = assignedCount === totalCount;
      const isEmpty = assignedCount === 0;
      const firstShift = shifts[0];
      const showFinishTimes = company?.settings.rotaShowFinishTimes !== false;
      const brandColor = company?.settings.primaryColor || '#4f46e5';
      const progressColor = isFull ? 'bg-green-500' : isEmpty ? 'bg-red-500' : ''; 
      const customStyle = (!isFull && !isEmpty) ? { backgroundColor: brandColor } : {};

      if (!isExpanded && shifts.length > 1) {
          return (
              <div onClick={() => setExpandedGroupId(groupKey)}
                className={`relative p-3 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition shadow-sm hover:shadow-md group mb-2 overflow-hidden`}
              >
                  <div className="absolute bottom-0 left-0 h-1 bg-slate-100 dark:bg-slate-900 w-full">
                      <div className={`h-full ${progressColor} transition-all duration-500`} style={{ width: `${(assignedCount / totalCount) * 100}%`, ...customStyle }}></div>
                  </div>
                  <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">{firstShift.role}</span>
                      <div className="flex items-center space-x-1 bg-slate-100 dark:bg-black/30 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 dark:text-slate-300">
                          <Users className="w-3 h-3" />
                          <span>{assignedCount}/{totalCount}</span>
                      </div>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {new Date(firstShift.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                      {showFinishTimes && ` - ${new Date(firstShift.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                  </div>
              </div>
          );
      }
      return (
          <div className="space-y-2 mb-2 animate-fade-in">
              {shifts.map((shift, idx) => (
                  <SingleShiftCard key={shift.id} shift={shift} isGrouped={shifts.length > 1} index={idx} />
              ))}
              {shifts.length > 1 && (
                  <button onClick={() => setExpandedGroupId(null)} className="w-full py-1 text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg flex items-center justify-center gap-1">
                      <Layers className="w-3 h-3" /> Collapse Group
                  </button>
              )}
          </div>
      );
  };

  const SingleShiftCard: React.FC<{ shift: ScheduleShift, isGrouped?: boolean, index?: number }> = ({ shift, isGrouped, index }) => {
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
            onContextMenu={(e) => { 
                e.preventDefault(); 
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, type: 'shift', data: shift }); 
            }}
            className={`
                group relative p-2.5 rounded-xl border text-left cursor-pointer transition-all shadow-sm hover:shadow-lg hover:scale-[1.02]
                ${shift.status === 'draft' 
                    ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 border-dashed opacity-80 hover:opacity-100' 
                    : isOpen 
                        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30 hover:bg-amber-100 dark:hover:bg-amber-900/20' 
                        : isOffered
                            ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800/30 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                            : isNoShow
                                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
                                : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 border-l-4 border-l-brand-500 border-t-0 border-r-0 border-b-0 shadow-sm'
                }
            `}
        >
            <div className="flex justify-between items-start mb-1">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate uppercase tracking-wider">
                    {isGrouped ? `Slot ${index! + 1}` : shift.role}
                </span>
                {shift.status === 'draft' && <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>}
                {isNoShow && !isOffered && <AlertTriangle className="w-3 h-3 text-red-500" />}
                {isOffered && <ArrowRightLeft className="w-3 h-3 text-purple-400" />}
            </div>
            {!isGrouped && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 flex items-center font-mono">
                    {new Date(shift.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                    {showFinishTimes && ` - ${new Date(shift.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                </div>
            )}
            {hasBids ? (
                <div className={`flex items-center space-x-1 text-[10px] font-medium ${isOpen ? 'text-amber-600 dark:text-amber-400' : 'text-purple-600 dark:text-purple-400'}`}>
                    <AlertCircle className="w-3 h-3" />
                    <span>{shift.bids?.length} Bids</span>
                </div>
            ) : isOpen ? (
                <div className="flex items-center space-x-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>Open</span>
                </div>
            ) : (
                <div className="flex items-center space-x-2 text-xs text-slate-700 dark:text-white">
                    <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[8px] font-bold">{shift.userName?.charAt(0)}</div>
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
  // Local week count for display
  const localDraftCount = schedule.filter(s => s.status === 'draft').length;

  return (
    <>
    {/* PRINT VIEW */}
    <div className="hidden print:block p-4 bg-white text-black min-h-screen text-[8px]">
        {/* ... (Print View Code - Unchanged) ... */}
    </div>

    {/* WEB APP VIEW */}
    <div className="space-y-6 h-[calc(100vh-120px)] flex flex-col print:hidden">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Rota Management</h1>
                <p className="text-slate-500 dark:text-slate-400">Plan shifts and manage staffing levels.</p>
            </div>
            <div className="flex flex-wrap gap-2">
                 <button 
                    onClick={() => setIsTimeOffModalOpen(true)}
                    className="relative glass-panel hover:bg-white/50 dark:hover:bg-white/10 text-slate-700 dark:text-white px-4 py-2.5 rounded-xl font-medium transition flex items-center space-x-2 border border-slate-200 dark:border-white/10"
                >
                    <Clock className="w-4 h-4" />
                    <span className="hidden sm:inline">Time Off</span>
                    {pendingRequestsCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {pendingRequestsCount}
                        </span>
                    )}
                </button>
                <div className="flex rounded-xl glass-panel border border-slate-200 dark:border-white/10 p-1">
                    <button onClick={handlePrintClick} className="px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition flex items-center gap-1" title="Print Rota">
                        <Printer className="w-3 h-3" /><span className="hidden sm:inline">Print</span>
                    </button>
                    <div className="w-px bg-slate-200 dark:bg-white/10 mx-1"></div>
                    <button onClick={handleCopyWeek} className="px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition">
                        Copy Previous
                    </button>
                    <div className="w-px bg-slate-200 dark:bg-white/10 mx-1"></div>
                    <button onClick={handleClearDrafts} className="px-3 py-1.5 text-xs font-bold text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Clear Drafts
                    </button>
                </div>
                
                {/* Publish Dropdown */}
                <div className="relative">
                    <button 
                        id="rota-publish-menu-btn"
                        onClick={() => setIsPublishMenuOpen(!isPublishMenuOpen)}
                        disabled={globalDraftCount === 0}
                        className="bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition disabled:opacity-50 flex items-center space-x-2"
                    >
                        <Send className="w-4 h-4" />
                        <span>Publish</span>
                        <ChevronDown className="w-4 h-4 ml-1" />
                    </button>
                    {isPublishMenuOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 z-50 overflow-hidden animate-fade-in">
                            <button 
                                id="publish-week-btn"
                                onClick={() => handlePublish('week')}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-medium flex flex-col group"
                            >
                                <span className="text-slate-900 dark:text-white font-bold mb-0.5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">Publish Current Week</span>
                                <span className="text-[10px] text-slate-500">
                                    {weekStart.toLocaleDateString(undefined, {month:'short', day:'numeric'})} - {new Date(weekStart.getTime() + 6*86400000).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                                </span>
                            </button>
                            <button 
                                onClick={() => handlePublish('all')}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 text-xs font-medium border-t border-slate-200 dark:border-white/5 flex flex-col group"
                            >
                                <span className="text-slate-900 dark:text-white font-bold mb-0.5 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">Publish All Drafts</span>
                                <span className="text-[10px] text-slate-500">{globalDraftCount} shifts total</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between glass-panel p-2 rounded-xl border border-slate-200 dark:border-white/10 shrink-0">
            <div className="flex items-center space-x-2">
                <button onClick={handlePrev} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-700 dark:text-white"><ChevronLeft className="w-5 h-5" /></button>
                <button onClick={handleToday} className="px-3 py-1 text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg">Today</button>
                <button onClick={handleNext} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-700 dark:text-white"><ChevronRight className="w-5 h-5" /></button>
                <div className="text-lg font-bold text-slate-900 dark:text-white px-2">
                    {viewMode === 'week' 
                        ? `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${new Date(weekStart.getTime() + 6*86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                        : currentDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
                    }
                </div>
            </div>
            
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                <button onClick={() => setViewMode('week')} className={`p-2 rounded-md transition ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><Grid className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('day')} className={`p-2 rounded-md transition ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><LayoutList className="w-4 h-4" /></button>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {viewMode === 'week' ? (
                // --- WEEK VIEW ---
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 min-h-full">
                    {weekDates.map((date, i) => {
                        const dayShifts = getShiftsForDay(date);
                        const groups = groupShifts(dayShifts);
                        const isToday = new Date().toDateString() === date.toDateString();
                        
                        return (
                            <div 
                                key={i} 
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, date)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ x: e.clientX, y: e.clientY, type: 'day', data: date });
                                }}
                                className={`flex flex-col rounded-xl overflow-hidden border transition-colors ${
                                    isToday ? 'border-brand-500/50 bg-slate-50 dark:bg-slate-900/10' : 'border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/5'
                                }`}
                            >
                                <div className={`text-center p-3 border-b ${isToday ? 'bg-slate-200 dark:bg-slate-700 border-brand-200 dark:border-brand-500/30' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5'}`}>
                                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{WEEK_DAYS[i]}</div>
                                    <div className={`text-lg font-bold ${isToday ? 'text-brand-600 dark:text-brand-400' : 'text-slate-900 dark:text-white'}`}>
                                        {date.getDate()}
                                    </div>
                                </div>

                                <div className="flex-1 p-2 space-y-2 min-h-[10rem]">
                                    {Object.entries(groups).map(([key, groupShifts]) => (
                                        <GroupShiftCard key={key} groupKey={key} shifts={groupShifts} />
                                    ))}
                                    <button 
                                        id={i === 0 ? 'rota-add-btn-0' : undefined}
                                        onClick={() => handleAddShift(date)}
                                        className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-white/10 rounded-lg text-slate-400 dark:text-slate-500 hover:border-brand-500/50 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition flex items-center justify-center group"
                                    >
                                        <Plus className="w-4 h-4 group-hover:scale-125 transition-transform" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                // --- DAY VIEW ---
                <div className="glass-panel rounded-xl p-6 min-h-full border border-slate-200 dark:border-white/10" onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, type: 'day', data: currentDate }); }}>
                    {(() => {
                        const dayShifts = getShiftsForDay(currentDate);
                        const groups = groupShifts(dayShifts);
                        const roleKeys = Object.keys(groups).sort();

                        return (
                            <div className="space-y-8">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                        {currentDate.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </h2>
                                    <button onClick={() => handleAddShift(currentDate)} className="bg-brand-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg shadow-brand-500/20 hover:bg-brand-700 transition flex items-center space-x-2">
                                        <Plus className="w-4 h-4" /> <span>Add Shift</span>
                                    </button>
                                </div>
                                {roleKeys.length === 0 ? (
                                    <div className="text-center py-20 text-slate-500">
                                        <Calendar className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p>No shifts scheduled for this day.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {roleKeys.map(key => (
                                            <div key={key} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-white/5">
                                                <GroupShiftCard groupKey={key} shifts={groups[key]} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}
            
            {/* Context Menu */}
            {contextMenu && (
                <div className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 w-48 animate-in fade-in zoom-in-95 duration-100" style={{ top: contextMenu.y, left: contextMenu.x }}>
                    {contextMenu.type === 'shift' ? (
                        <>
                            <button onClick={() => { handleEditShift(contextMenu.data); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition"><MousePointer2 className="w-4 h-4" /> Edit Details</button>
                            <button onClick={() => { handleCopyShift(contextMenu.data); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition"><ClipboardCopy className="w-4 h-4" /> Copy</button>
                            <button onClick={() => { handleDuplicateShift(contextMenu.data); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition"><Copy className="w-4 h-4" /> Duplicate</button>
                            <button onClick={(e) => { handleRepeatClick(contextMenu.data, e); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition"><Repeat className="w-4 h-4" /> Repeat...</button>
                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                            <button onClick={() => { handleDeleteShift(contextMenu.data.id); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 transition"><Trash2 className="w-4 h-4" /> Delete</button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => { handleAddShift(contextMenu.data); setContextMenu(null); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition"><Plus className="w-4 h-4" /> Add Shift</button>
                            {clipboard && <button onClick={() => { handlePasteShift(contextMenu.data); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition"><ClipboardPaste className="w-4 h-4" /> Paste Shift</button>}
                            
                            <div className="h-px bg-slate-200 dark:bg-slate-700 my-1"></div>
                            <button onClick={() => { handleCopyDay(contextMenu.data); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition"><Copy className="w-4 h-4" /> Copy Day</button>
                            {dayClipboard && <button onClick={() => { handlePasteDay(contextMenu.data); }} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white flex items-center gap-2 transition"><ClipboardPaste className="w-4 h-4" /> Paste Day ({dayClipboard.length})</button>}
                        </>
                    )}
                </div>
            )}
        </div>

        {/* --- MODALS --- */}
        {/* ... (Print Settings Modal same as previous) ... */}
        {isPrintSettingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in print:hidden">
                <div className="glass-panel w-full max-w-lg p-6 rounded-2xl shadow-2xl border border-white/10 bg-slate-900">
                    {/* ... Content Unchanged ... */}
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-white flex items-center gap-2">
                            <Settings className="w-5 h-5" /> Print Settings
                        </h3>
                        <button onClick={() => setIsPrintSettingsOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
                    </div>
                    {/* ... (Existing Print Settings Logic) ... */}
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-3">
                            <button 
                                onClick={() => setPrintConfig({...printConfig, layout: 'list'})}
                                className={`flex flex-col items-center p-4 rounded-xl border transition-all ${printConfig.layout === 'list' ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                            >
                                <AlignJustify className="w-6 h-6 mb-2" />
                                <span className="text-xs font-bold">List View</span>
                            </button>
                            <button 
                                onClick={() => setPrintConfig({...printConfig, layout: 'staff_grid'})}
                                className={`flex flex-col items-center p-4 rounded-xl border transition-all ${printConfig.layout === 'staff_grid' ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                            >
                                <Table className="w-6 h-6 mb-2" />
                                <span className="text-xs font-bold">Staff Grid</span>
                            </button>
                            <button 
                                onClick={() => setPrintConfig({...printConfig, layout: 'date_grid'})}
                                className={`flex flex-col items-center p-4 rounded-xl border transition-all ${printConfig.layout === 'date_grid' ? 'bg-brand-600 border-brand-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                            >
                                <LayoutTemplate className="w-6 h-6 mb-2" />
                                <span className="text-xs font-bold">Date Grid</span>
                            </button>
                        </div>

                        <div className="bg-slate-800/50 rounded-xl p-4 space-y-3 border border-white/5">
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm text-slate-300">Show Locations</span>
                                <div 
                                    onClick={() => setPrintConfig({...printConfig, showLocation: !printConfig.showLocation})}
                                    className={`w-10 h-6 rounded-full p-1 transition-colors ${printConfig.showLocation ? 'bg-brand-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${printConfig.showLocation ? 'translate-x-4' : ''}`}></div>
                                </div>
                            </label>
                            <label className="flex items-center justify-between cursor-pointer">
                                <span className="text-sm text-slate-300">Show Role Names</span>
                                <div 
                                    onClick={() => setPrintConfig({...printConfig, showRole: !printConfig.showRole})}
                                    className={`w-10 h-6 rounded-full p-1 transition-colors ${printConfig.showRole ? 'bg-brand-500' : 'bg-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${printConfig.showRole ? 'translate-x-4' : ''}`}></div>
                                </div>
                            </label>
                            {printConfig.layout !== 'list' && (
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-sm text-slate-300">Show Unassigned Row</span>
                                    <div 
                                        onClick={() => setPrintConfig({...printConfig, showUnassigned: !printConfig.showUnassigned})}
                                        className={`w-10 h-6 rounded-full p-1 transition-colors ${printConfig.showUnassigned ? 'bg-brand-500' : 'bg-slate-700'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${printConfig.showUnassigned ? 'translate-x-4' : ''}`}></div>
                                    </div>
                                </label>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setIsPrintSettingsOpen(false)} 
                                className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmPrint}
                                className="flex-1 px-4 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center gap-2"
                            >
                                <Printer className="w-5 h-5" />
                                <span>Print Now</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {isShiftModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in print:hidden">
                <div id="shift-modal-container" className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                            {editingShift ? 'Edit Shift' : `Add Shift`}
                        </h3>
                        <button onClick={() => setIsShiftModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-900 dark:hover:text-white" /></button>
                    </div>

                    <form onSubmit={handleSaveShift} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Role / Position</label>
                            <input 
                                type="text" required
                                value={shiftRole} onChange={e => setShiftRole(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                placeholder="e.g. Bar Staff"
                            />
                        </div>

                        {!editingShift && (
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Number of Staff Needed</label>
                                <input 
                                    type="number" min="1" max="20" required
                                    value={shiftQuantity} onChange={e => setShiftQuantity(parseInt(e.target.value))}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">Creates multiple open slots for this role.</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Start Time</label>
                                <input 
                                    type="time" required
                                    value={shiftStart} onChange={e => setShiftStart(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">End Time</label>
                                {company?.settings.rotaShowFinishTimes !== false ? (
                                    <input 
                                        type="time" required
                                        value={shiftEnd} onChange={e => setShiftEnd(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                ) : (
                                    <div className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 text-sm flex items-center">
                                        <ArrowRight className="w-4 h-4 mr-2" /> Till Finish
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Assign Staff</label>
                            <select 
                                value={shiftUser} onChange={e => setShiftUser(e.target.value)}
                                disabled={!editingShift && shiftQuantity > 1}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none disabled:opacity-50"
                            >
                                <option value="open">-- Open / Unassigned --</option>
                                {staff.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.position || 'Staff'})</option>
                                ))}
                            </select>
                            {!editingShift && shiftQuantity > 1 && <p className="text-xs text-amber-500 mt-1">Cannot assign staff during bulk creation.</p>}
                        </div>

                         <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Location</label>
                            <select 
                                value={shiftLocation} onChange={e => setShiftLocation(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            >
                                <option value="">-- No Specific Location --</option>
                                {locations.map(l => (
                                    <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Bids Section */}
                        {editingShift && editingShift.bids && editingShift.bids.length > 0 && (
                            <div className="bg-amber-100 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-900/30 animate-fade-in">
                                <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400 mb-2">
                                    {editingShift.userId ? 'Swap Requests' : 'Staff Bids'} ({editingShift.bids.length})
                                </h4>
                                <div className="space-y-2">
                                    {editingShift.bids.map(bidderId => {
                                        const b = staff.find(s => s.id === bidderId);
                                        if (!b) return null;
                                        return (
                                            <div key={bidderId} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                                                <span className="text-sm text-slate-700 dark:text-slate-200">{b.name}</span>
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

                        <div className="flex gap-3 pt-4 items-center">
                            {editingShift && (
                                <button type="button" onClick={() => handleDeleteShift()} className="px-3 py-2 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg font-bold transition">Delete</button>
                            )}
                            <div className="flex-1"></div>
                            
                            <button type="button" onClick={() => setIsShiftModalOpen(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition">Cancel</button>
                            <button id="shift-save-btn" type="submit" className="px-6 py-2 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {/* Repeat Shift Modal */}
        {isRepeatModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in print:hidden">
                <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    {/* ... Repeat Content Unchanged ... */}
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                            <Repeat className="w-5 h-5" /> Repeat Shift
                        </h3>
                        <button onClick={() => setIsRepeatModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-900 dark:hover:text-white" /></button>
                    </div>
                    {/* ... (Existing Repeat Form) ... */}
                    <div className="space-y-6">
                        {/* Summary */}
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-sm border border-slate-200 dark:border-slate-700">
                            <p className="text-slate-500 mb-1 font-medium">Original Shift</p>
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-900 dark:text-white">{repeatSourceShift?.role}</span>
                                <span className="font-mono text-slate-500">
                                    {new Date(repeatSourceShift!.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(repeatSourceShift!.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </span>
                            </div>
                        </div>

                        {/* Mode Selection */}
                        <div className="space-y-3">
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Repeat Pattern</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={() => setRepeatMode('daily_week')}
                                    className={`p-3 rounded-lg border-2 text-left transition-all ${repeatMode === 'daily_week' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                >
                                    <span className="block font-bold text-sm">Every Day</span>
                                    <span className="text-[10px]">Rest of this week</span>
                                </button>
                                <button 
                                    onClick={() => setRepeatMode('custom')}
                                    className={`p-3 rounded-lg border-2 text-left transition-all ${repeatMode === 'custom' ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-400' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}
                                >
                                    <span className="block font-bold text-sm">Custom</span>
                                    <span className="text-[10px]">Specific days & dates</span>
                                </button>
                            </div>
                        </div>

                        {/* Custom Options */}
                        {repeatMode === 'custom' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">Repeats On</label>
                                    <div className="flex justify-between gap-1">
                                        {['S','M','T','W','T','F','S'].map((d, i) => (
                                            <button 
                                                key={i}
                                                onClick={() => toggleRepeatDay(i)}
                                                className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                                                    repeatDays.includes(i) 
                                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' 
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                    {repeatDays.length === 0 && <p className="text-[10px] text-amber-500 mt-1">* Select at least one day. Leaving blank repeats daily.</p>}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">Repeat Until</label>
                                    <input 
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        value={repeatEndDate}
                                        onChange={(e) => setRepeatEndDate(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setIsRepeatModalOpen(false)} className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition">Cancel</button>
                            <button 
                                onClick={handleConfirmRepeat}
                                className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition shadow-lg shadow-brand-500/20"
                            >
                                Create Shifts
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Time Off Modal */}
        {isTimeOffModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in print:hidden">
                <div className="glass-panel w-full max-w-lg p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 h-[80vh] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Time Off Requests</h3>
                        <button onClick={() => setIsTimeOffModalOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-900 dark:hover:text-white" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {timeOffRequests.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">No pending requests.</div>
                        ) : (
                            timeOffRequests.map(req => (
                                <div key={req.id} className="border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 rounded-xl p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">{req.userName}</h4>
                                            <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-white/5">{req.type}</span>
                                        </div>
                                        <div className="text-right text-xs text-slate-500">
                                            Requested {new Date(req.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                                        {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                        {req.reason && <p className="mt-1 italic text-slate-500 dark:text-slate-400">"{req.reason}"</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleTimeOffAction(req.id, 'rejected')}
                                            className="flex-1 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
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
    </>
  );
};
