
import React, { useEffect, useState } from 'react';
import { getShifts } from '../services/api';
import { Shift } from '../types';
import { Users, Clock, AlertCircle, Search, Filter, Download, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { downloadShiftsCSV } from '../utils/csv';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'active'>('all');

  useEffect(() => {
    const loadData = async () => {
        if (!user || !user.currentCompanyId) return;
        const data = await getShifts(user.currentCompanyId);
        setShifts(data);
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
  const totalHours = Math.floor(shifts.reduce((acc, s) => acc + (s.endTime ? s.endTime - s.startTime : Date.now() - s.startTime), 0) / 3600000);
  const lateCheckouts = shifts.filter(s => !s.endTime && (Date.now() - s.startTime > 43200000)).length;

  const handleExport = () => {
      downloadShiftsCSV(filteredShifts, 'tally_full_report');
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
                label="Total Hours" 
                value={totalHours} 
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
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Loading data...</td></tr>
                            ) : filteredShifts.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-slate-400">No activity found matching your criteria.</td></tr>
                            ) : filteredShifts.map((shift) => {
                                const isActive = !shift.endTime;
                                const duration = isActive 
                                    ? Math.floor((Date.now() - shift.startTime) / (1000 * 60 * 60)) 
                                    : Math.floor((shift.endTime! - shift.startTime) / (1000 * 60 * 60));
                                
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
                                            {duration}h {Math.floor(((isActive ? Date.now() : shift.endTime!) - shift.startTime) % 3600000 / 60000)}m
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
    </div>
  );
};
