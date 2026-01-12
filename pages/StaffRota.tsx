
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSchedule, bidOnShift, createTimeOffRequest, getMyTimeOff, getCompany } from '../services/api';
import { ScheduleShift, TimeOffRequest, Company } from '../types';
import { Calendar, MapPin, Clock, AlertCircle, CheckCircle, Plus, X, User, Lock } from 'lucide-react';

export const StaffRota = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'my-shifts' | 'open-board' | 'time-off'>('my-shifts');
  const [schedule, setSchedule] = useState<ScheduleShift[]>([]);
  const [myRequests, setMyRequests] = useState<TimeOffRequest[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  // Time Off Form
  const [isTimeOffOpen, setIsTimeOffOpen] = useState(false);
  const [toType, setToType] = useState('holiday');
  const [toStart, setToStart] = useState('');
  const [toEnd, setToEnd] = useState('');
  const [toReason, setToReason] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.currentCompanyId) return;
    setLoading(true);

    // Get next 30 days
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setDate(end.getDate() + 30);

    const [schedData, reqData, companyData] = await Promise.all([
        getSchedule(user.currentCompanyId, start.getTime(), end.getTime()),
        getMyTimeOff(user.id),
        getCompany(user.currentCompanyId)
    ]);
    
    setSchedule(schedData.filter(s => s.status === 'published'));
    setMyRequests(reqData);
    setCompany(companyData);
    setLoading(false);
  };

  if (company && company.settings.rotaEnabled === false) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Rota System Not Active</h2>
              <p className="text-slate-500 max-w-md">Your employer has not enabled the scheduling system for this company.</p>
          </div>
      );
  }

  const handleBid = async (shiftId: string) => {
      if (!user) return;
      await bidOnShift(shiftId, user.id);
      loadData();
  };

  const handleSubmitTimeOff = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user?.currentCompanyId) return;

      const newReq: TimeOffRequest = {
          id: `tor_${Date.now()}`,
          userId: user.id,
          userName: user.name,
          companyId: user.currentCompanyId,
          type: toType as any,
          startDate: new Date(toStart).getTime(),
          endDate: new Date(toEnd).getTime(),
          reason: toReason,
          status: 'pending',
          createdAt: Date.now()
      };

      await createTimeOffRequest(newReq);
      setMyRequests([newReq, ...myRequests]);
      setIsTimeOffOpen(false);
      setToStart(''); setToEnd(''); setToReason('');
  };

  const myShifts = schedule.filter(s => s.userId === user?.id).sort((a,b) => a.startTime - b.startTime);
  const openShifts = schedule.filter(s => s.userId === null).sort((a,b) => a.startTime - b.startTime);

  // Group open shifts by date string for better organization
  const groupedOpenShifts: Record<string, ScheduleShift[]> = {};
  openShifts.forEach(s => {
      const d = new Date(s.startTime).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
      if(!groupedOpenShifts[d]) groupedOpenShifts[d] = [];
      groupedOpenShifts[d].push(s);
  });

  const ShiftCard: React.FC<{ shift: ScheduleShift; isOpenBoard?: boolean }> = ({ shift, isOpenBoard = false }) => {
      const isBidded = user && shift.bids?.includes(user.id);
      const allowBidding = company?.settings.allowShiftBidding !== false; 
      
      // Robust Overnight Check
      const startD = new Date(shift.startTime);
      const endD = new Date(shift.endTime);
      const isOvernight = startD.toDateString() !== endD.toDateString();

      return (
        <div className={`bg-white dark:bg-slate-800 p-5 rounded-2xl border ${isOpenBoard ? 'border-amber-200 dark:border-amber-900/30' : 'border-slate-100 dark:border-slate-700'} shadow-sm mb-4`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="font-bold text-lg text-slate-900 dark:text-white">{new Date(shift.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div className="text-sm text-slate-500 flex items-center">
                        {new Date(shift.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(shift.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        {isOvernight && <span className="ml-1 text-[9px] font-bold text-brand-600 bg-brand-50 dark:bg-brand-900/50 px-1 rounded">+1</span>}
                    </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${isOpenBoard ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'}`}>
                    {shift.role}
                </span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-slate-500 mb-4">
                <MapPin className="w-4 h-4" />
                <span>{shift.locationName || 'General Location'}</span>
            </div>

            {isOpenBoard && (
                allowBidding ? (
                    <button 
                        onClick={() => !isBidded && handleBid(shift.id)}
                        disabled={!!isBidded}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition ${
                            isBidded 
                            ? 'bg-amber-50 text-amber-600 cursor-default' 
                            : 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20'
                        }`}
                    >
                        {isBidded ? (
                            <>
                                <CheckCircle className="w-5 h-5" />
                                <span>Request Sent</span>
                            </>
                        ) : (
                            <span>Bid for Shift</span>
                        )}
                    </button>
                ) : (
                    <div className="w-full py-3 bg-slate-50 dark:bg-slate-700 text-slate-400 rounded-xl font-medium text-center text-sm">
                        Bidding Disabled
                    </div>
                )
            )}
        </div>
      );
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Schedule</h1>
            <button 
                onClick={() => setIsTimeOffOpen(true)}
                className="text-sm font-bold text-brand-600 hover:bg-brand-50 px-3 py-2 rounded-lg transition"
            >
                + Time Off
            </button>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button 
                onClick={() => setActiveTab('my-shifts')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'my-shifts' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
            >
                My Shifts
            </button>
            <button 
                onClick={() => setActiveTab('open-board')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'open-board' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
            >
                Open Board
                {openShifts.length > 0 && <span className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{openShifts.length}</span>}
            </button>
             <button 
                onClick={() => setActiveTab('time-off')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'time-off' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
            >
                Time Off
            </button>
        </div>

        {/* Content */}
        <div className="min-h-[200px]">
            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading schedule...</div>
            ) : (
                <>
                    {activeTab === 'my-shifts' && (
                        <div>
                            {myShifts.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No upcoming shifts assigned.</p>
                                </div>
                            ) : (
                                myShifts.map(s => <ShiftCard key={s.id} shift={s} />)
                            )}
                        </div>
                    )}

                    {activeTab === 'open-board' && (
                        <div>
                             {Object.keys(groupedOpenShifts).length === 0 ? (
                                <div className="text-center py-12 text-slate-500">
                                    <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No open shifts available right now.</p>
                                </div>
                            ) : (
                                Object.entries(groupedOpenShifts).map(([date, shifts]) => (
                                    <div key={date} className="mb-6">
                                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 pl-1">{date}</h3>
                                        {shifts.map(s => <ShiftCard key={s.id} shift={s} isOpenBoard />)}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'time-off' && (
                        <div className="space-y-4">
                            {myRequests.map(req => (
                                <div key={req.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white capitalize">{req.type}</div>
                                        <div className="text-sm text-slate-500">{new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</div>
                                    </div>
                                    <div>
                                        {req.status === 'pending' && <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">Pending</span>}
                                        {req.status === 'approved' && <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">Approved</span>}
                                        {req.status === 'rejected' && <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">Rejected</span>}
                                    </div>
                                </div>
                            ))}
                            {myRequests.length === 0 && (
                                <div className="text-center py-12 text-slate-500">
                                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>No time off history.</p>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>

        {/* Time Off Modal */}
        {isTimeOffOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                 <div className="bg-white dark:bg-slate-800 w-full max-w-md p-6 rounded-2xl shadow-xl border dark:border-slate-700">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Request Time Off</h3>
                        <button onClick={() => setIsTimeOffOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                    </div>

                    <form onSubmit={handleSubmitTimeOff} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Type</label>
                            <select 
                                value={toType} onChange={e => setToType(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white"
                            >
                                <option value="holiday">Holiday</option>
                                <option value="sickness">Sickness</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Start Date</label>
                                <input 
                                    type="date" required
                                    value={toStart} onChange={e => setToStart(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white"
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">End Date</label>
                                <input 
                                    type="date" required
                                    value={toEnd} onChange={e => setToEnd(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                         <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Reason (Optional)</label>
                            <input 
                                type="text"
                                value={toReason} onChange={e => setToReason(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white"
                                placeholder="e.g. Family wedding"
                            />
                        </div>

                        <div className="pt-2">
                            {company?.settings.requireTimeOffApproval === false ? (
                                <p className="text-xs text-green-600 mb-2">Note: Requests are automatically approved.</p>
                            ) : (
                                <p className="text-xs text-slate-500 mb-2">Note: Requests require manager approval.</p>
                            )}
                            
                            <button type="submit" className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 mt-2">
                                Submit Request
                            </button>
                        </div>
                    </form>
                 </div>
            </div>
        )}
    </div>
  );
};
