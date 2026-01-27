
import React, { useEffect, useState } from 'react';
import { getShifts, getLocations, getCompany, getSchedule, updateShift, deleteShift, getCompanyStaff, updateUserProfile } from '../services/api';
import { Shift, Location, Company, User, ScheduleShift } from '../types';
import { Users, Clock, AlertCircle, Search, Download, ArrowUpRight, QrCode, Printer, MapPin, X, Building, ChevronRight, Zap, Calendar, CheckCircle2, MoreHorizontal, Edit2, Trash2, LogOut, Save, DollarSign, ChevronDown, ClipboardList, Check, UserPlus, AlertTriangle, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { APP_NAME } from '../constants';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { startTutorial } = useTutorial();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [todaysSchedule, setTodaysSchedule] = useState<ScheduleShift[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active'>('all');

  // Widget States
  const [costWindow, setCostWindow] = useState<12 | 18 | 24>(12);
  const [isCostMenuOpen, setIsCostMenuOpen] = useState(false);

  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);
  const [selectedLocationForPoster, setSelectedLocationForPoster] = useState<Location | null>(null);

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewTab, setReviewTab] = useState<'alerts' | 'pending' | 'rota'>('alerts');

  // Action Menu State
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  
  // Edit Modal State
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
        if (!user || !user.currentCompanyId) return;
        const [shiftsData, locationsData, companyData, staffData] = await Promise.all([
            getShifts(user.currentCompanyId),
            getLocations(user.currentCompanyId),
            getCompany(user.currentCompanyId),
            getCompanyStaff(user.currentCompanyId)
        ]);
        setShifts(shiftsData);
        setLocations(locationsData);
        setCompany(companyData);
        setStaff(staffData);

        if (companyData.settings.rotaEnabled) {
            try {
                const now = new Date();
                const startOfDay = new Date(now.setHours(0,0,0,0)).getTime();
                const endOfDay = new Date(now.setHours(23,59,59,999)).getTime();
                const todayRota = await getSchedule(user.currentCompanyId, startOfDay, endOfDay);
                setTodaysSchedule(todayRota);
            } catch (e) { console.error(e); }
        }
        setLoading(false);
        
        setTimeout(() => startTutorial(), 1000);
    };
    loadData();
  }, [user]);

  const filteredShifts = shifts.filter(s => {
      const matchesSearch = s.userName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'active' ? !s.endTime : true;
      return matchesSearch && matchesFilter;
  });

  const activeShiftsCount = shifts.filter(s => !s.endTime).length;
  const todaysScheduleCount = todaysSchedule.filter(s => s.userId).length;
  const currency = company?.settings.currency || '£';

  // --- REVIEW ALERTS CALCULATION ---
  const getAlerts = () => {
      if (!company) return [];
      const { 
          auditLateInThreshold = 15,
          auditEarlyOutThreshold = 15,
          auditLateOutThreshold = 15,
          auditShortShiftThreshold = 5,
          auditLongShiftThreshold = 14 
      } = company.settings;

      const alerts: { type: string, message: string, shift: Shift }[] = [];

      shifts.forEach(s => {
          // If manually dismissed, skip
          if (s.warningsDismissed) return;

          const now = Date.now();
          const durationMins = ((s.endTime || now) - s.startTime) / 60000;
          
          if (durationMins > (auditLongShiftThreshold * 60)) {
              alerts.push({ type: 'long', message: `Long shift (> ${auditLongShiftThreshold}h)`, shift: s });
          }
          if (s.endTime && durationMins < auditShortShiftThreshold) {
              alerts.push({ type: 'short', message: `Short shift (< ${auditShortShiftThreshold}m)`, shift: s });
          }
          if (s.scheduledStartTime) {
              const lateMins = (s.startTime - s.scheduledStartTime) / 60000;
              if (lateMins > auditLateInThreshold) {
                  alerts.push({ type: 'late_in', message: `Late In (+${Math.round(lateMins)}m)`, shift: s });
              }
          }
          if (s.endTime && s.scheduledEndTime) {
              const earlyMins = (s.scheduledEndTime - s.endTime) / 60000;
              if (earlyMins > auditEarlyOutThreshold) {
                  alerts.push({ type: 'early_out', message: `Early Out (${Math.round(earlyMins)}m)`, shift: s });
              }
          }
      });
      return alerts;
  };

  const pendingStaff = staff.filter(u => u.isApproved === false);
  const uncoveredRota = todaysSchedule.filter(s => !s.userId);
  const alerts = getAlerts();
  
  const totalReviewItems = alerts.length + pendingStaff.length + uncoveredRota.length;

  // --- ROLLING COST CALCULATION ---
  const calculateRollingCost = () => {
      const now = Date.now();
      const cutoff = now - (costWindow * 60 * 60 * 1000);
      
      return shifts.reduce((total, s) => {
          const sEnd = s.endTime || now;
          if (sEnd < cutoff) return total;
          if (s.startTime > now) return total;

          const effectiveStart = Math.max(s.startTime, cutoff);
          const effectiveEnd = Math.min(sEnd, now);
          const durationHours = (effectiveEnd - effectiveStart) / 3600000;
          if (durationHours <= 0) return total;

          const rate = s.hourlyRate || company?.settings.defaultHourlyRate || 0;
          return total + (durationHours * rate);
      }, 0);
  };

  const rollingCost = calculateRollingCost();

  // --- Handlers ---

  const getStaticQrUrl = (locId: string) => `${window.location.protocol}//${window.location.host}/#/action?type=static&lid=${locId}`;

  const toLocalISO = (ts: number) => {
      const d = new Date(ts);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
  };

  const handleEditClick = (shift: Shift) => {
      setEditingShift(shift);
      setEditStartTime(toLocalISO(shift.startTime));
      setEditEndTime(shift.endTime ? toLocalISO(shift.endTime) : '');
      setOpenActionMenuId(null);
      setIsReviewModalOpen(false); // Close review modal if opened from there
  };

  const handleDismissAlert = async (shift: Shift) => {
      try {
          await updateShift(shift.id, { warningsDismissed: true });
          setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, warningsDismissed: true } : s));
      } catch (e) {
          console.error("Dismiss failed", e);
      }
  };

  const handleApproveStaff = async (userId: string) => {
      if(!confirm("Approve this staff member?")) return;
      try {
          await updateUserProfile(userId, { isApproved: true });
          setStaff(prev => prev.map(u => u.id === userId ? { ...u, isApproved: true } : u));
      } catch (e) {
          console.error(e);
          alert("Failed to approve.");
      }
  };

  const handleSaveEdit = async () => {
      if (!editingShift) return;
      setIsSaving(true);
      try {
          const start = new Date(editStartTime).getTime();
          const end = editEndTime ? new Date(editEndTime).getTime() : null;
          
          await updateShift(editingShift.id, { startTime: start, endTime: end });
          
          setShifts(prev => prev.map(s => s.id === editingShift.id ? { ...s, startTime: start, endTime: end } : s));
          setEditingShift(null);
      } catch (e) {
          console.error(e);
          alert('Failed to update shift.');
      } finally {
          setIsSaving(false);
      }
  };

  const handleForceClockOut = async (shift: Shift) => {
      if(!confirm(`Force clock out for ${shift.userName}?`)) return;
      try {
          const now = Date.now();
          await updateShift(shift.id, { endTime: now });
          setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, endTime: now } : s));
      } catch (e) {
          console.error(e);
          alert('Failed to clock out.');
      }
      setOpenActionMenuId(null);
  };

  const handleDeleteShift = async (shiftId: string) => {
      if(!confirm('Are you sure you want to delete this record? This cannot be undone.')) return;
      try {
          await deleteShift(shiftId);
          setShifts(prev => prev.filter(s => s.id !== shiftId));
      } catch (e) {
          console.error(e);
          alert('Failed to delete.');
      }
      setOpenActionMenuId(null);
  };

  const StatWidget = ({ label, value, subtext, icon: Icon, color, isDropdown = false, onClick }: any) => (
      <div 
        onClick={onClick}
        className={`glass-panel p-6 rounded-3xl relative overflow-visible group transition duration-300 border border-slate-200 dark:border-white/5 ${onClick ? 'cursor-pointer hover:bg-white/80 dark:hover:bg-white/10 hover:shadow-lg' : 'hover:bg-white/50 dark:hover:bg-white/5'}`}
      >
          <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${color}-500/10 rounded-full blur-2xl group-hover:bg-${color}-500/20 transition`}></div>
          <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl bg-${color}-500/20 text-${color}-600 dark:text-${color}-400`}>
                      <Icon className="w-6 h-6" />
                  </div>
                  {isDropdown ? (
                      <div className="relative" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => setIsCostMenuOpen(!isCostMenuOpen)}
                            className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg flex items-center gap-1 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition"
                          >
                              <span>{costWindow} hrs</span>
                              <ChevronDown className="w-3 h-3" />
                          </button>
                          {isCostMenuOpen && (
                              <div className="absolute right-0 top-8 w-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in">
                                  {[12, 18, 24].map((h) => (
                                      <button
                                        key={h}
                                        onClick={() => { setCostWindow(h as any); setIsCostMenuOpen(false); }}
                                        className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/10 ${costWindow === h ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}
                                      >
                                          Last {h} Hours
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>
                  ) : (
                      subtext && <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-lg">{subtext}</span>
                  )}
              </div>
              <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">{value}</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">{label}</p>
          </div>
      </div>
  );

  return (
    <div className="space-y-8 pb-12" onClick={() => { setOpenActionMenuId(null); setIsCostMenuOpen(false); }}>
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Command Center</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">Overview for {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <div className="flex gap-3">
                <Link to="/admin/kiosk" id="dashboard-kiosk-btn" className="bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-brand-900/20 flex items-center gap-2 transition transform active:scale-95">
                    <Zap className="w-4 h-4" />
                    <span>Launch Kiosk</span>
                </Link>
                <button onClick={() => setIsLocationSelectorOpen(true)} className="glass-panel hover:bg-white/50 dark:hover:bg-white/10 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 px-5 py-3 rounded-xl font-bold transition flex items-center gap-2">
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Print QR</span>
                </button>
            </div>
        </header>

        {/* Stats Row */}
        <div className={`grid grid-cols-1 ${company?.settings.rotaEnabled ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-6`}>
            {company?.settings.rotaEnabled && (
                <StatWidget 
                    label="Today's Schedule" 
                    value={`${activeShiftsCount}/${todaysScheduleCount}`} 
                    subtext="Attendance"
                    icon={Calendar}
                    color="purple"
                />
            )}
            <StatWidget 
                label="Active Staff" 
                value={activeShiftsCount} 
                subtext="Live"
                icon={Users}
                color="emerald"
            />
            
            {/* Interactive Cost Widget */}
            <div onClick={(e) => e.stopPropagation()}>
                <StatWidget 
                    label={`Est. Cost (Last ${costWindow}h)`} 
                    value={`${currency}${rollingCost.toFixed(0)}`} 
                    isDropdown={true}
                    icon={DollarSign}
                    color="brand"
                />
            </div>

            <StatWidget 
                label="Requires Review" 
                value={totalReviewItems} 
                subtext="Alerts"
                icon={ClipboardList}
                color={totalReviewItems > 0 ? "rose" : "slate"}
                onClick={() => {
                    if (totalReviewItems > 0) setIsReviewModalOpen(true);
                }}
            />
        </div>

        {/* Main Content Block */}
        <div className="glass-panel rounded-3xl overflow-hidden border border-slate-200 dark:border-white/5">
            {/* Filters */}
            <div className="p-6 border-b border-slate-200 dark:border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-white/5">
                <div className="flex bg-slate-200 dark:bg-slate-900/50 p-1 rounded-xl">
                    <button 
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${filter === 'all' ? 'bg-white dark:bg-brand-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        All Activity
                    </button>
                    <button 
                        onClick={() => setFilter('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${filter === 'active' ? 'bg-white dark:bg-brand-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Active Now
                    </button>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Search staff..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-900/30 text-xs uppercase font-bold text-slate-500 tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Employee</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Timing</th>
                            <th className="px-6 py-4">Method</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {loading ? (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-500">Loading live data...</td></tr>
                        ) : filteredShifts.length === 0 ? (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-500">No activity found.</td></tr>
                        ) : filteredShifts.map((shift) => {
                            const isActive = !shift.endTime;
                            const durationMs = (isActive ? Date.now() : shift.endTime!) - shift.startTime;
                            const h = Math.floor(durationMs / 3600000);
                            const m = Math.floor((durationMs % 3600000) / 60000);
                            
                            return (
                                <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition duration-150 group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-gradient-to-tr dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-white font-bold text-sm shadow-sm">
                                                {shift.userName.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                                    {shift.userName}
                                                    {shift.scheduleShiftId && <CheckCircle2 className="w-3 h-3 text-purple-500" />}
                                                </div>
                                                <div className="text-xs text-slate-500">{new Date(shift.startTime).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isActive ? (
                                            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-xs font-bold">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                <span>Active</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-500 font-medium text-xs bg-slate-100 dark:bg-white/5 px-2 py-1 rounded">Completed</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-mono text-slate-700 dark:text-white">{new Date(shift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{h}h {m}m duration</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded border border-slate-200 dark:border-white/5">
                                            {shift.startMethod === 'dynamic_qr' ? 'KIOSK QR' : shift.startMethod === 'static_gps' ? 'GPS SCAN' : 'MANUAL'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right relative">
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setOpenActionMenuId(openActionMenuId === shift.id ? null : shift.id); 
                                            }}
                                            className={`p-2 rounded-lg transition ${openActionMenuId === shift.id ? 'bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
                                        >
                                            <MoreHorizontal className="w-5 h-5" />
                                        </button>

                                        {openActionMenuId === shift.id && (
                                            <div className="absolute right-0 top-12 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 z-50 overflow-hidden animate-fade-in">
                                                <button 
                                                    onClick={() => handleEditClick(shift)} 
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 text-sm font-medium flex items-center gap-3 transition"
                                                >
                                                    <Edit2 className="w-4 h-4 text-blue-500" /> Edit Time
                                                </button>
                                                {!shift.endTime && (
                                                    <button 
                                                        onClick={() => handleForceClockOut(shift)} 
                                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 text-sm font-medium flex items-center gap-3 transition border-t border-slate-100 dark:border-white/5"
                                                    >
                                                        <LogOut className="w-4 h-4 text-amber-500" /> Clock Out
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleDeleteShift(shift.id)} 
                                                    className="w-full text-left px-4 py-3 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 text-sm font-medium flex items-center gap-3 transition border-t border-slate-100 dark:border-white/5"
                                                >
                                                    <Trash2 className="w-4 h-4" /> Delete
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>

        {/* --- MODALS --- */}
        
        {/* Review Modal */}
        {isReviewModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setIsReviewModalOpen(false)}>
                <div className="glass-panel w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ClipboardList className="w-6 h-6 text-brand-500" />
                            Requires Review
                        </h2>
                        <button onClick={() => setIsReviewModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    
                    {/* Tabs */}
                    <div className="flex bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 px-6">
                        <button 
                            onClick={() => setReviewTab('alerts')}
                            className={`py-4 px-4 text-sm font-bold border-b-2 transition ${reviewTab === 'alerts' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Attendance Alerts ({alerts.length})
                        </button>
                        <button 
                            onClick={() => setReviewTab('pending')}
                            className={`py-4 px-4 text-sm font-bold border-b-2 transition ${reviewTab === 'pending' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Pending Staff ({pendingStaff.length})
                        </button>
                        <button 
                            onClick={() => setReviewTab('rota')}
                            className={`py-4 px-4 text-sm font-bold border-b-2 transition ${reviewTab === 'rota' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Uncovered Rota ({uncoveredRota.length})
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-black/10">
                        {reviewTab === 'alerts' && (
                            <div className="space-y-3">
                                {alerts.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">No attendance alerts.</div>
                                ) : (
                                    alerts.map((item, i) => (
                                        <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 flex justify-between items-center group">
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white">{item.shift.userName}</div>
                                                <div className="text-xs text-slate-500 mb-1">{new Date(item.shift.startTime).toLocaleDateString()}</div>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
                                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                                    {item.message}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleDismissAlert(item.shift)}
                                                    className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-bold transition flex items-center gap-1"
                                                >
                                                    <EyeOff className="w-3 h-3" /> Dismiss
                                                </button>
                                                <button 
                                                    onClick={() => handleEditClick(item.shift)}
                                                    className="px-3 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 rounded-lg text-xs font-bold transition text-slate-700 dark:text-white"
                                                >
                                                    View / Edit
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {reviewTab === 'pending' && (
                            <div className="space-y-3">
                                {pendingStaff.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">No pending staff approvals.</div>
                                ) : (
                                    pendingStaff.map(u => (
                                        <div key={u.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center font-bold text-slate-500">
                                                    {u.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                                                    <div className="text-xs text-slate-500">{u.email}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => navigate('/admin/staff')}
                                                    className="px-3 py-2 text-slate-500 hover:text-slate-900 dark:hover:text-white text-xs font-bold"
                                                >
                                                    View Profile
                                                </button>
                                                <button 
                                                    onClick={() => handleApproveStaff(u.id)}
                                                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition flex items-center gap-1"
                                                >
                                                    <UserPlus className="w-3 h-3" /> Approve
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {reviewTab === 'rota' && (
                            <div className="space-y-3">
                                {uncoveredRota.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">All shifts today are covered.</div>
                                ) : (
                                    uncoveredRota.map(s => (
                                        <div key={s.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-white/5 flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-slate-900 dark:text-white">{s.role} Shift</div>
                                                <div className="text-xs text-slate-500 font-mono">
                                                    {new Date(s.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(s.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => navigate('/admin/rota')}
                                                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition"
                                            >
                                                Go to Rota
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
        
        {/* Poster Modal */}
        {selectedLocationForPoster && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center relative">
                    <button onClick={() => setSelectedLocationForPoster(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition text-slate-900">
                        <X className="w-5 h-5" />
                    </button>
                    <h2 className="text-3xl font-extrabold text-slate-900 mb-2">{selectedLocationForPoster.name}</h2>
                    <p className="text-slate-500 mb-8">Scan to Clock In/Out</p>
                    <div className="bg-white border-4 border-slate-900 p-6 rounded-3xl inline-block mb-8">
                         <QRCode value={getStaticQrUrl(selectedLocationForPoster.id)} size={250} />
                    </div>
                    <button className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition" onClick={() => window.print()}>
                        Print Poster
                    </button>
                </div>
            </div>
        )}
        
        {/* Location Selector */}
        {isLocationSelectorOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" onClick={(e) => e.stopPropagation()}>
                <div className="glass-panel border border-slate-200 dark:border-white/10 rounded-3xl p-6 max-w-md w-full bg-white dark:bg-slate-900">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Select Location</h2>
                        <button onClick={() => setIsLocationSelectorOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="w-6 h-6" /></button>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {locations.map(loc => (
                            <button key={loc.id} onClick={() => { setIsLocationSelectorOpen(false); setSelectedLocationForPoster(loc); }}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-brand-50 dark:hover:bg-brand-600 transition group text-left border border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-5 h-5 text-slate-400 group-hover:text-brand-600 dark:group-hover:text-white" />
                                    <span className="font-bold text-slate-900 dark:text-white">{loc.name}</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-600 dark:group-hover:text-white" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Edit Modal */}
        {editingShift && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
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
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">End Time</label>
                                <input 
                                    type="datetime-local"
                                    value={editEndTime}
                                    onChange={(e) => setEditEndTime(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm"
                                />
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
                            className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSaveEdit}
                            disabled={isSaving}
                            className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center space-x-2"
                        >
                            <Save className="w-4 h-4" />
                            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
