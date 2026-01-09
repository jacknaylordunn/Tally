
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStaffActivity, getCompany, toggleManualShift } from '../services/api';
import { Shift, Company } from '../types';
import { Play, Square, Calendar, Loader2, Clock } from 'lucide-react';

export const StaffDashboard = () => {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch Data
  const loadData = async () => {
      if (!user) return;
      const [shiftsData, companyData] = await Promise.all([
          getStaffActivity(user.id),
          user.currentCompanyId ? getCompany(user.currentCompanyId) : Promise.resolve(null)
      ]);
      setShifts(shiftsData);
      setCompany(companyData);
      
      const current = shiftsData.find(s => !s.endTime);
      setActiveShift(current || null);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle Manual Toggle
  const handleToggleShift = async () => {
      if (!user || !user.currentCompanyId) return;
      setLoading(true);
      try {
          await toggleManualShift(user.id, user.currentCompanyId);
          await loadData();
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const calculateDuration = (startTime: number) => {
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-fade-in">
       <header className="flex items-center justify-between">
          <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Hi, {user?.name.split(' ')[0]}</h1>
              <p className="text-slate-500">Let's get to work.</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">
              {user?.name.charAt(0)}
          </div>
       </header>

       {/* Status Card */}
       <div className="relative">
           {activeShift ? (
               <div className="bg-gradient-to-b from-slate-900 to-slate-800 text-white rounded-[2rem] p-8 shadow-2xl text-center relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-blue-500"></div>
                   <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-500/20 rounded-full blur-3xl"></div>
                   
                   <p className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2">Current Status</p>
                   <h2 className="text-4xl font-bold mb-1">Clocked In</h2>
                   <p className="text-green-400 font-mono mb-8 animate-pulse">
                       {calculateDuration(activeShift.startTime)}
                   </p>

                   <button 
                        onClick={handleToggleShift}
                        disabled={loading}
                        className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white py-4 rounded-xl font-semibold transition flex items-center justify-center space-x-2"
                   >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-5 h-5 fill-current" />}
                        <span>End Shift</span>
                   </button>
               </div>
           ) : (
               <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 shadow-soft text-center">
                   <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                       <Clock className="w-8 h-8" />
                   </div>
                   <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Off Duty</h2>
                   <p className="text-slate-500 mb-8">Ready to start your day?</p>

                   <button 
                        onClick={handleToggleShift}
                        disabled={loading || !company?.settings.allowManualClockIn}
                        className={`w-full py-4 rounded-xl font-semibold transition flex items-center justify-center space-x-2 shadow-lg shadow-brand-500/20
                            ${company?.settings.allowManualClockIn 
                                ? 'bg-brand-600 hover:bg-brand-700 text-white' 
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                   >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />}
                        <span>{company?.settings.allowManualClockIn ? 'Start Shift' : 'Scan QR to Start'}</span>
                   </button>
                   {!company?.settings.allowManualClockIn && (
                       <p className="mt-4 text-xs text-slate-400">Manual entry disabled. Please use a kiosk.</p>
                   )}
               </div>
           )}
       </div>

       {/* Recent Activity */}
       <div>
           <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-lg text-slate-900 dark:text-white">Recent Activity</h3>
           </div>
           
           <div className="space-y-3">
               {shifts.slice(0, 4).map(shift => (
                   <div key={shift.id} className="group bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-brand-200 dark:hover:border-brand-800 transition-colors flex items-center justify-between">
                       <div className="flex items-center space-x-4">
                           <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold ${shift.endTime ? 'bg-slate-50 dark:bg-slate-800 text-slate-500' : 'bg-green-50 text-green-600'}`}>
                               <span>{new Date(shift.startTime).getDate()}</span>
                               <span className="uppercase text-[0.6rem] opacity-70">{new Date(shift.startTime).toLocaleString('default', { month: 'short' })}</span>
                           </div>
                           <div>
                               <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                   {shift.endTime ? `${((shift.endTime - shift.startTime) / 3600000).toFixed(1)} hrs` : 'In Progress'}
                               </p>
                               <p className="text-xs text-slate-400 capitalize">{shift.startMethod.replace('_', ' ')}</p>
                           </div>
                       </div>
                       <div className="text-right">
                           <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                               {new Date(shift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </p>
                           <p className="text-xs text-slate-400">
                               {shift.endTime ? new Date(shift.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                           </p>
                       </div>
                   </div>
               ))}
               {shifts.length === 0 && <p className="text-center text-slate-400 py-4 text-sm">No recent activity.</p>}
           </div>
       </div>
    </div>
  );
};
