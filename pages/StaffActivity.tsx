
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStaffActivity, getCompany } from '../services/api';
import { Shift, Company } from '../types';
import { Calendar, DollarSign, Clock, Filter } from 'lucide-react';

export const StaffActivity = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'month'>('all');

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

  const filteredShifts = shifts.filter(s => {
      if (filter === 'all') return true;
      const shiftDate = new Date(s.startTime);
      const now = new Date();
      return shiftDate.getMonth() === now.getMonth() && shiftDate.getFullYear() === now.getFullYear();
  });

  const calculatePay = (start: number, end: number | null, rate: number) => {
      if (!end) return 'Active';
      const hours = (end - start) / 3600000;
      return (hours * rate).toFixed(2);
  };

  const totalEarnings = filteredShifts.reduce((acc, shift) => {
      if (!shift.endTime) return acc;
      const hours = (shift.endTime - shift.startTime) / 3600000;
      return acc + (hours * shift.hourlyRate);
  }, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
       <header>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Your Activity</h1>
          <p className="text-slate-500">History of your shifts and earnings.</p>
       </header>

       {/* Summary Cards */}
       <div className="grid grid-cols-2 gap-4">
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
               <div className="flex items-center space-x-2 text-slate-500 mb-2">
                   <Clock className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase">Total Shifts</span>
               </div>
               <p className="text-2xl font-bold text-slate-900 dark:text-white">{filteredShifts.length}</p>
           </div>
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
               <div className="flex items-center space-x-2 text-brand-500 mb-2">
                   <DollarSign className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase">Est. Earnings</span>
               </div>
               <p className="text-2xl font-bold text-slate-900 dark:text-white">{currency}{totalEarnings.toFixed(2)}</p>
           </div>
       </div>

       {/* Filter */}
       <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">History</h3>
            <button 
                onClick={() => setFilter(prev => prev === 'all' ? 'month' : 'all')}
                className="text-sm font-medium text-slate-500 hover:text-brand-500 flex items-center space-x-1"
            >
                <Filter className="w-4 h-4" />
                <span>{filter === 'all' ? 'All Time' : 'This Month'}</span>
            </button>
       </div>

       {/* List */}
       <div className="space-y-4">
           {loading ? (
               <div className="p-8 text-center text-slate-500">Loading history...</div>
           ) : filteredShifts.map(shift => (
               <div key={shift.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                   <div className="flex items-start space-x-4">
                        <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-xl text-center min-w-[3.5rem]">
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
                                <span className="text-slate-300">•</span>
                                <span className={shift.endTime ? '' : 'text-green-500'}>
                                    {shift.endTime ? new Date(shift.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Active'}
                                </span>
                            </div>
                            <div className="text-sm text-slate-500 mt-0.5 capitalize flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${shift.startMethod === 'manual' ? 'bg-orange-400' : 'bg-brand-500'}`}></span>
                                {shift.startMethod.replace('_', ' ')}
                            </div>
                        </div>
                   </div>

                   <div className="flex items-center justify-between md:justify-end md:gap-8 pt-4 md:pt-0 border-t md:border-t-0 border-slate-50 dark:border-slate-700">
                        <div className="text-left md:text-right">
                            <div className="text-xs text-slate-400 uppercase font-medium">Duration</div>
                            <div className="font-semibold text-slate-700 dark:text-slate-300">
                                {shift.endTime 
                                    ? ((shift.endTime - shift.startTime) / 3600000).toFixed(2) + ' hrs' 
                                    : 'Tracking...'}
                            </div>
                        </div>
                        <div className="text-right min-w-[5rem]">
                            <div className="text-xs text-slate-400 uppercase font-medium">Earned</div>
                            <div className="font-bold text-green-600 dark:text-green-400 text-lg">
                                {currency}{calculatePay(shift.startTime, shift.endTime, shift.hourlyRate)}
                            </div>
                        </div>
                   </div>
               </div>
           ))}
           {filteredShifts.length === 0 && !loading && (
               <div className="text-center py-8 text-slate-500">No shift history found.</div>
           )}
       </div>
    </div>
  );
};
