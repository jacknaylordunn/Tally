
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStaffActivity, getCompany } from '../services/api';
import { Shift, Company } from '../types';
import { Calendar, DollarSign, Clock, Filter, MapPin, ChevronDown } from 'lucide-react';

type FilterType = 'all' | 'month' | 'week';

export const StaffActivity = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('week'); // Default to week

  useEffect(() => {
    const loadData = async () => {
        if (!user) return;
        const [shiftsData, companyData] = await Promise.all([
            getStaffActivity(user.id),
            user.currentCompanyId ? getCompany(user.currentCompanyId) : Promise.resolve(null)
        ]);
        setShifts(shiftsData);
        setCompany(companyData);
        setLoading(false);
    };
    loadData();
  }, [user]);

  // Fallback to £ if company settings are missing currency
  const currency = company?.settings.currency || '£';

  // --- FILTER LOGIC ---
  const filteredShifts = shifts.filter(s => {
      const shiftDate = new Date(s.startTime);
      const now = new Date();
      
      if (filter === 'month') {
          return shiftDate.getMonth() === now.getMonth() && shiftDate.getFullYear() === now.getFullYear();
      } else if (filter === 'week') {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          // Set to beginning of that day
          oneWeekAgo.setHours(0, 0, 0, 0);
          return shiftDate >= oneWeekAgo;
      }
      return true; // 'all'
  });

  const calculatePay = (start: number, end: number | null, rate: number) => {
      if (!end) return 'Active';
      const hours = (end - start) / 3600000;
      return (hours * rate).toFixed(2);
  };

  const totalStats = filteredShifts.reduce((acc, shift) => {
      if (!shift.endTime) return acc;
      const hours = (shift.endTime - shift.startTime) / 3600000;
      acc.hours += hours;
      acc.earnings += (hours * shift.hourlyRate);
      return acc;
  }, { hours: 0, earnings: 0 });

  const toggleFilter = () => {
      if (filter === 'week') setFilter('month');
      else if (filter === 'month') setFilter('all');
      else setFilter('week');
  };

  const getFilterLabel = () => {
      if (filter === 'all') return 'All Time';
      if (filter === 'month') return 'This Month';
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      return `Last Week (${weekStart.toLocaleDateString(undefined, {month:'short', day:'numeric'})}+)`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
       <header>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Your Activity</h1>
          <p className="text-slate-500 dark:text-slate-400">History of your shifts and earnings.</p>
       </header>

       {/* Filter */}
       <div className="flex items-center justify-between bg-white dark:bg-white/5 p-2 rounded-xl border border-slate-200 dark:border-white/10">
            <h3 className="font-bold text-sm text-slate-600 dark:text-slate-300 px-2 uppercase tracking-wider">Range</h3>
            <button 
                onClick={toggleFilter}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/5 px-4 py-2 rounded-lg text-sm font-bold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center space-x-2"
            >
                <Filter className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                <span>{getFilterLabel()}</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
       </div>

       {/* Summary Cards */}
       <div className="grid grid-cols-2 gap-4">
           <div className="bg-white dark:bg-white/5 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10">
               <div className="flex items-center space-x-2 text-slate-400 mb-2">
                   <Clock className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase tracking-wider">Total Shifts</span>
               </div>
               <div className="flex flex-col">
                   <span className="text-3xl font-bold text-slate-900 dark:text-white leading-none">
                       {filteredShifts.length}
                   </span>
                   <span className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                       ({totalStats.hours.toFixed(1)} hrs)
                   </span>
               </div>
           </div>
           <div className="bg-white dark:bg-white/5 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10">
               <div className="flex items-center space-x-2 text-brand-600 dark:text-brand-400 mb-2">
                   <DollarSign className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase tracking-wider">Est. Earnings</span>
               </div>
               <div className="flex flex-col">
                   <span className="text-3xl font-bold text-slate-900 dark:text-white leading-none">
                       {currency}{totalStats.earnings.toFixed(2)}
                   </span>
                   <span className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                       Gross Pay
                   </span>
               </div>
           </div>
       </div>

       {/* List */}
       <div className="space-y-4">
           {loading ? (
               <div className="p-8 text-center text-slate-500">Loading history...</div>
           ) : filteredShifts.map(shift => (
               <div key={shift.id} className="bg-white dark:bg-white/5 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:bg-slate-50 dark:hover:bg-white/10">
                   <div className="flex items-start space-x-4">
                        <div className="bg-slate-100 dark:bg-white/5 p-3 rounded-xl text-center min-w-[3.5rem] border border-slate-200 dark:border-white/5">
                            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                                {new Date(shift.startTime).toLocaleString('default', { month: 'short' })}
                            </div>
                            <div className="text-xl font-bold text-slate-900 dark:text-white">
                                {new Date(shift.startTime).getDate()}
                            </div>
                        </div>
                        <div>
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{new Date(shift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                <span className="text-slate-400">•</span>
                                <span className={shift.endTime ? 'text-slate-500 dark:text-slate-300' : 'text-emerald-500 dark:text-emerald-400 animate-pulse font-bold'}>
                                    {shift.endTime ? new Date(shift.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active'}
                                </span>
                            </div>
                            <div className="text-sm text-slate-500 mt-1 capitalize flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${shift.startMethod === 'manual' ? 'bg-orange-400' : 'bg-brand-500'}`}></span>
                                {shift.startMethod.replace('_', ' ')}
                                <span className="w-1 h-1 bg-slate-400 dark:bg-slate-600 rounded-full"></span>
                                <MapPin className="w-3 h-3" />
                                {shift.companyId ? 'On Site' : 'Remote'}
                            </div>
                        </div>
                   </div>

                   <div className="flex items-center justify-between md:justify-end md:gap-8 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-white/5">
                        <div className="text-left md:text-right">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Duration</div>
                            <div className="font-mono text-sm text-slate-700 dark:text-slate-300">
                                {shift.endTime 
                                    ? ((shift.endTime - shift.startTime) / 3600000).toFixed(2) + ' hrs' 
                                    : 'Tracking...'}
                            </div>
                        </div>
                        <div className="text-right min-w-[5rem]">
                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Earned</div>
                            <div className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                                {currency}{calculatePay(shift.startTime, shift.endTime, shift.hourlyRate)}
                            </div>
                        </div>
                   </div>
               </div>
           ))}
           {filteredShifts.length === 0 && !loading && (
               <div className="text-center py-12 flex flex-col items-center">
                   <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <Clock className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                   </div>
                   <p className="text-slate-500">No shift history found for this period.</p>
               </div>
           )}
       </div>
    </div>
  );
};
