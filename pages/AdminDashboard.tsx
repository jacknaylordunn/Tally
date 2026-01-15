
import React, { useEffect, useState } from 'react';
import { getShifts, getLocations, getCompany, getSchedule, updateShift, deleteShift } from '../services/api';
import { Shift, Location, Company } from '../types';
import { Users, Clock, AlertCircle, Search, Download, ArrowUpRight, QrCode, Printer, MapPin, X, Building, ChevronRight, Zap, Calendar, CheckCircle2, MoreHorizontal, Edit2, Trash2, LogOut, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';
import { Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { APP_NAME } from '../constants';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const { startTutorial } = useTutorial();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [todaysScheduleCount, setTodaysScheduleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active'>('all');

  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);
  const [selectedLocationForPoster, setSelectedLocationForPoster] = useState<Location | null>(null);

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
        const [shiftsData, locationsData, companyData] = await Promise.all([
            getShifts(user.currentCompanyId),
            getLocations(user.currentCompanyId),
            getCompany(user.currentCompanyId)
        ]);
        setShifts(shiftsData);
        setLocations(locationsData);
        setCompany(companyData);

        if (companyData.settings.rotaEnabled) {
            try {
                const now = new Date();
                const startOfDay = new Date(now.setHours(0,0,0,0)).getTime();
                const endOfDay = new Date(now.setHours(23,59,59,999)).getTime();
                const todayRota = await getSchedule(user.currentCompanyId, startOfDay, endOfDay);
                setTodaysScheduleCount(todayRota.filter(s => s.userId).length);
            } catch (e) { console.error(e); }
        }
        setLoading(false);
        
        // Try starting tutorial (Context checks if it's already done)
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
  
  const totalMs = shifts.reduce((acc, s) => acc + (s.endTime ? s.endTime - s.startTime : Date.now() - s.startTime), 0);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const totalDurationDisplay = `${hours}h ${minutes}m`;

  const alertCount = shifts.filter(s => {
      const duration = (s.endTime || Date.now()) - s.startTime;
      return duration > (14 * 3600000) || (s.endTime && duration < (5 * 60000));
  }).length;

  const getStaticQrUrl = (locId: string) => `${window.location.protocol}//${window.location.host}/#/action?type=static&lid=${locId}`;

  // --- Handlers ---

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

  const StatWidget = ({ label, value, subtext, icon: Icon, color }: any) => (
      <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group hover:bg-white/5 transition duration-300">
          <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${color}-500/10 rounded-full blur-2xl group-hover:bg-${color}-500/20 transition`}></div>
          <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl bg-${color}-500/20 text-${color}-400`}>
                      <Icon className="w-6 h-6" />
                  </div>
                  {subtext && <span className="text-xs font-medium text-slate-500 bg-white/5 px-2 py-1 rounded-lg">{subtext}</span>}
              </div>
              <h3 className="text-4xl font-bold text-white mb-1 tracking-tight">{value}</h3>
              <p className="text-slate-400 font-medium text-sm">{label}</p>
          </div>
      </div>
  );

  return (
    <div className="space-y-8 pb-12" onClick={() => setOpenActionMenuId(null)}>
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Command Center</h1>
                <p className="text-slate-400 mt-1">Overview for {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
            
            <div className="flex gap-3">
                <Link to="/admin/kiosk" id="dashboard-kiosk-btn" className="bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-brand-900/50 flex items-center gap-2 transition transform active:scale-95">
                    <Zap className="w-4 h-4" />
                    <span>Launch Kiosk</span>
                </Link>
                <button onClick={() => setIsLocationSelectorOpen(true)} className="glass-panel hover:bg-white/10 text-white px-5 py-3 rounded-xl font-bold transition flex items-center gap-2">
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
            <StatWidget 
                label="Total Time" 
                value={totalDurationDisplay} 
                icon={Clock}
                color="brand"
            />
            <StatWidget 
                label="Alerts" 
                value={alertCount} 
                subtext="Requires Review"
                icon={AlertCircle}
                color="rose"
            />
        </div>

        {/* Main Content Block */}
        <div className="glass-panel rounded-3xl overflow-hidden border border-white/5">
            {/* Filters */}
            <div className="p-6 border-b border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/5">
                <div className="flex bg-slate-900/50 p-1 rounded-xl">
                    <button 
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${filter === 'all' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        All Activity
                    </button>
                    <button 
                        onClick={() => setFilter('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition ${filter === 'active' ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Active Now
                    </button>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Search staff..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-900/50 border border-white/5 rounded-xl text-white placeholder:text-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none text-sm transition-all"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-900/30 text-xs uppercase font-bold text-slate-500 tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Employee</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Timing</th>
                            <th className="px-6 py-4">Method</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
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
                                <tr key={shift.id} className="hover:bg-white/5 transition duration-150 group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                                {shift.userName.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white flex items-center gap-2">
                                                    {shift.userName}
                                                    {shift.scheduleShiftId && <CheckCircle2 className="w-3 h-3 text-purple-400" />}
                                                </div>
                                                <div className="text-xs text-slate-500">{new Date(shift.startTime).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isActive ? (
                                            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                <span>Active</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-500 font-medium text-xs">Completed</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-mono text-white">{new Date(shift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                        <div className="text-xs text-slate-500 mt-0.5">{h}h {m}m duration</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs font-mono text-slate-400 bg-white/5 px-2 py-1 rounded border border-white/5">
                                            {shift.startMethod === 'dynamic_qr' ? 'KIOSK QR' : shift.startMethod === 'static_gps' ? 'GPS SCAN' : 'MANUAL'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right relative">
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setOpenActionMenuId(openActionMenuId === shift.id ? null : shift.id); 
                                            }}
                                            className={`p-2 rounded-lg transition ${openActionMenuId === shift.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
                                        >
                                            <MoreHorizontal className="w-5 h-5" />
                                        </button>

                                        {openActionMenuId === shift.id && (
                                            <div className="absolute right-0 top-12 w-48 bg-slate-900 rounded-xl shadow-xl border border-white/10 z-50 overflow-hidden animate-fade-in">
                                                <button 
                                                    onClick={() => handleEditClick(shift)} 
                                                    className="w-full text-left px-4 py-3 hover:bg-white/5 text-slate-300 text-sm font-medium flex items-center gap-3 transition"
                                                >
                                                    <Edit2 className="w-4 h-4 text-blue-400" /> Edit Time
                                                </button>
                                                {!shift.endTime && (
                                                    <button 
                                                        onClick={() => handleForceClockOut(shift)} 
                                                        className="w-full text-left px-4 py-3 hover:bg-white/5 text-slate-300 text-sm font-medium flex items-center gap-3 transition border-t border-white/5"
                                                    >
                                                        <LogOut className="w-4 h-4 text-amber-400" /> Clock Out
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleDeleteShift(shift.id)} 
                                                    className="w-full text-left px-4 py-3 hover:bg-red-900/20 text-red-400 text-sm font-medium flex items-center gap-3 transition border-t border-white/5"
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
                <div className="glass-panel border border-white/10 rounded-3xl p-6 max-w-md w-full">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white">Select Location</h2>
                        <button onClick={() => setIsLocationSelectorOpen(false)} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {locations.map(loc => (
                            <button key={loc.id} onClick={() => { setIsLocationSelectorOpen(false); setSelectedLocationForPoster(loc); }}
                                className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-brand-600 transition group text-left border border-white/5">
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-5 h-5 text-slate-400 group-hover:text-white" />
                                    <span className="font-bold text-white">{loc.name}</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Edit Modal */}
        {editingShift && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
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
