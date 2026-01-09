
import React, { useEffect, useState } from 'react';
import { getShifts, getLocations } from '../services/api';
import { Shift, Location } from '../types';
import { Users, Clock, AlertCircle, Search, Filter, Download, ArrowUpRight, QrCode, Printer, MapPin, X, Building, ChevronRight, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadShiftsCSV } from '../utils/csv';
import { Link } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { APP_NAME } from '../constants';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active'>('all');

  // Modal States
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);
  const [selectedLocationForPoster, setSelectedLocationForPoster] = useState<Location | null>(null);

  useEffect(() => {
    const loadData = async () => {
        if (!user || !user.currentCompanyId) return;
        const [shiftsData, locationsData] = await Promise.all([
            getShifts(user.currentCompanyId),
            getLocations(user.currentCompanyId)
        ]);
        setShifts(shiftsData);
        setLocations(locationsData);
        setLoading(false);
    };
    loadData();
  }, [user]);

  const filteredShifts = shifts.filter(s => {
      const matchesSearch = s.userName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'active' ? !s.endTime : true;
      return matchesSearch && matchesFilter;
  });

  const activeShiftsCount = shifts.filter(s => !s.endTime).length;
  
  // Calculate Total Hours & Minutes
  const totalMs = shifts.reduce((acc, s) => acc + (s.endTime ? s.endTime - s.startTime : Date.now() - s.startTime), 0);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const totalDurationDisplay = `${hours}h ${minutes}m`;

  const lateCheckouts = shifts.filter(s => !s.endTime && (Date.now() - s.startTime > 43200000)).length;

  const handleExport = () => {
      downloadShiftsCSV(filteredShifts, 'tally_full_report');
  };

  const getStaticQrUrl = (locId: string) => {
    return `${window.location.protocol}//${window.location.host}/#/action?type=static&lid=${locId}`;
  };

  const StatCard = ({ label, value, subtext, icon: Icon, colorClass }: any) => (
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-soft hover:shadow-lg transition-all duration-300">
          <div className="flex items-start justify-between mb-4">
              <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
                  <h3 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{value}</h3>
              </div>
              <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10`}>
                  <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
              </div>
          </div>
          {subtext && <p className="text-xs text-slate-400">{subtext}</p>}
      </div>
  );

  return (
    <div className="space-y-8">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard</h1>
                <p className="text-slate-500 mt-1">Overview for {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="flex space-x-3">
                 <button 
                    onClick={handleExport}
                    className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center space-x-2"
                 >
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                 </button>
            </div>
        </header>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link to="/admin/kiosk" className="group relative overflow-hidden bg-gradient-to-br from-brand-600 to-brand-700 rounded-3xl p-6 shadow-xl shadow-brand-500/20 text-white flex items-center justify-between hover:scale-[1.01] transition-all duration-300">
                <div className="relative z-10">
                    <div className="flex items-center space-x-2 mb-2 text-brand-100 font-medium text-sm uppercase tracking-wider">
                        <Zap className="w-4 h-4" />
                        <span>Kiosk Mode</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">Launch Live Kiosk</h3>
                    <p className="text-brand-100 text-sm">Open the secure QR scanner for this device.</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm group-hover:bg-white/30 transition">
                    <QrCode className="w-6 h-6" />
                </div>
                {/* Decoration */}
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            </Link>

            <button 
                onClick={() => setIsLocationSelectorOpen(true)}
                className="group relative overflow-hidden bg-slate-900 dark:bg-slate-800 rounded-3xl p-6 shadow-lg text-white flex items-center justify-between hover:bg-slate-800 dark:hover:bg-slate-700 transition-all duration-300 text-left"
            >
                <div className="relative z-10">
                     <div className="flex items-center space-x-2 mb-2 text-slate-400 font-medium text-sm uppercase tracking-wider">
                        <Printer className="w-4 h-4" />
                        <span>Static QR</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-1">Print QR Poster</h3>
                    <p className="text-slate-400 text-sm">Generate a physical scan point for a location.</p>
                </div>
                <div className="w-12 h-12 bg-slate-700 dark:bg-slate-600 rounded-full flex items-center justify-center group-hover:bg-slate-600 dark:group-hover:bg-slate-500 transition">
                    <ArrowUpRight className="w-6 h-6" />
                </div>
            </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
                label="Active Staff" 
                value={activeShiftsCount} 
                subtext="Currently clocked in"
                icon={Users}
                colorClass="bg-emerald-500 text-emerald-600"
            />
            <StatCard 
                label="Total Time" 
                value={totalDurationDisplay} 
                subtext="Tracked this week"
                icon={Clock}
                colorClass="bg-brand-500 text-brand-600"
            />
            <StatCard 
                label="Alerts" 
                value={lateCheckouts} 
                subtext="Shifts exceeding 12h"
                icon={AlertCircle}
                colorClass="bg-rose-500 text-rose-600"
            />
        </div>

        {/* List Section */}
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition ${filter === 'all' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        All Activity
                    </button>
                    <button 
                        onClick={() => setFilter('active')}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition ${filter === 'active' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        Active Now
                    </button>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Search staff..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-transparent border-b border-slate-200 dark:border-slate-700 focus:border-slate-900 dark:focus:border-white outline-none text-sm transition-colors"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 text-xs uppercase font-semibold text-slate-500">
                            <tr>
                                <th className="px-6 py-4 font-medium">Employee</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium">Clock In</th>
                                <th className="px-6 py-4 font-medium">Duration</th>
                                <th className="px-6 py-4 font-medium">Method</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-5 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading data...</td></tr>
                            ) : filteredShifts.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-400">No activity found matching your criteria.</td></tr>
                            ) : filteredShifts.map((shift) => {
                                const isActive = !shift.endTime;
                                const durationMs = (isActive ? Date.now() : shift.endTime!) - shift.startTime;
                                const h = Math.floor(durationMs / 3600000);
                                const m = Math.floor((durationMs % 3600000) / 60000);
                                
                                return (
                                    <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition duration-150">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                    {shift.userName.charAt(0)}
                                                </div>
                                                <span className="font-medium text-slate-900 dark:text-white">{shift.userName}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {isActive ? (
                                                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium border border-emerald-100 dark:border-emerald-800">
                                                    <span className="relative flex h-2 w-2">
                                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                    </span>
                                                    <span>Active</span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs font-medium">Completed</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                            {new Date(shift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                            {h}h {m}m
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="capitalize text-slate-500 text-xs">{shift.startMethod.replace('_', ' ')}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* Modal: Select Location for Poster */}
        {isLocationSelectorOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Select Location</h2>
                        <button onClick={() => setIsLocationSelectorOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    
                    {locations.length === 0 ? (
                        <div className="text-center py-8">
                             <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                             <p className="text-slate-500 mb-4">No locations found.</p>
                             <Link to="/admin/locations" className="text-brand-600 font-bold hover:underline">Add a location first</Link>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            {locations.map(loc => (
                                <button 
                                    key={loc.id}
                                    onClick={() => {
                                        setIsLocationSelectorOpen(false);
                                        setSelectedLocationForPoster(loc);
                                    }}
                                    className="w-full flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-slate-700 transition group text-left"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 group-hover:text-brand-600 group-hover:bg-brand-100 dark:group-hover:text-white">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">{loc.name}</h4>
                                            <p className="text-xs text-slate-500">Radius: {loc.radius}m</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-brand-500" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Modal: Poster Display */}
        {selectedLocationForPoster && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white rounded-none md:rounded-3xl p-8 max-w-lg w-full text-center relative shadow-2xl print:shadow-none print:w-screen print:h-screen print:max-w-none print:rounded-none print:flex print:flex-col print:items-center print:justify-center">
                    <button 
                        onClick={() => setSelectedLocationForPoster(null)}
                        className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition print:hidden"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>

                    <div className="mb-8 space-y-2">
                        <div className="flex items-center justify-center space-x-2 mb-4 text-slate-400">
                             <Building className="w-5 h-5" />
                             <span className="font-semibold uppercase tracking-widest text-sm">{APP_NAME}</span>
                        </div>
                        <h2 className="text-4xl font-extrabold text-slate-900">{selectedLocationForPoster.name}</h2>
                        <p className="text-slate-500 text-lg">Scan to Clock In or Out</p>
                    </div>

                    <div className="bg-white border-4 border-slate-900 p-8 rounded-3xl inline-block mb-8 shadow-xl print:shadow-none">
                         <QRCode value={getStaticQrUrl(selectedLocationForPoster.id)} size={300} />
                    </div>
                    
                    <div className="text-slate-400 text-sm font-medium mb-8">
                        <p>1. Open your camera</p>
                        <p>2. Scan the code</p>
                        <p>3. Confirm your location</p>
                    </div>

                    <div className="flex gap-4 print:hidden">
                        <button 
                            className="flex-1 bg-brand-500 text-white py-3 rounded-xl font-bold hover:bg-brand-600 transition shadow-lg shadow-brand-500/30"
                            onClick={() => window.print()}
                        >
                            Print Poster
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
