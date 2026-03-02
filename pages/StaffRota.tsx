
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSchedule, bidOnShift, cancelBid, createTimeOffRequest, getMyTimeOff, getCompany, setShiftOfferStatus, deleteTimeOffRequest } from '../services/api';
import { ScheduleShift, TimeOffRequest, Company } from '../types';
import { Calendar, MapPin, Clock, AlertCircle, CheckCircle, Plus, X, User, Lock, RotateCcw, ArrowRightLeft, Trash2, Users } from 'lucide-react';

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
              <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center border border-slate-200 dark:border-white/10">
                  <Lock className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Rota System Not Active</h2>
              <p className="text-slate-500 max-w-md">Your employer has not enabled the scheduling system for this company.</p>
          </div>
      );
  }

  const handleBid = async (shiftIds: string[]) => {
      if (!user) return;
      // Smart Bidding: Apply bid to ALL unassigned shifts in this group
      await Promise.all(shiftIds.map(id => bidOnShift(id, user.id)));
      loadData();
  };

  const handleCancelBid = async (shiftIds: string[]) => {
      if (!user) return;
      if (!confirm("Cancel your request?")) return;
      await Promise.all(shiftIds.map(id => cancelBid(id, user.id)));
      loadData();
  };

  const handleOfferShift = async (shiftId: string, offer: boolean) => {
      if (!confirm(offer ? "Put this shift up for grabs? You are still responsible for it until someone else is assigned." : "Retract offer?")) return;
      await setShiftOfferStatus(shiftId, offer);
      loadData();
  };

  const handleDeleteTimeOff = async (requestId: string) => {
      if (!confirm("Are you sure you want to delete this time off request?")) return;
      await deleteTimeOffRequest(requestId);
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
  
  // Logic to Group Open Shifts with Role Filtering
  const openShifts = schedule.filter(s => {
      const isOpen = s.userId === null || (s.userId !== user?.id && s.isOffered);
      if (!isOpen) return false;

      // Visibility Rule: If shift has a role, user must have that role in their profile.
      // Falls back to legacy `position` field if `roles` array is missing.
      const userRoles = user?.roles || (user?.position ? [user.position] : []);
      const canSee = !s.role || s.role === 'Staff' || s.role === 'Open' || userRoles.includes(s.role);

      return canSee;
  }).sort((a,b) => a.startTime - b.startTime);

  // Group by Date -> Group Key
  const groupedOpenShifts: Record<string, Record<string, ScheduleShift[]>> = {};
  
  openShifts.forEach(s => {
      const dateKey = new Date(s.startTime).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
      const groupKey = `${s.role}_${s.startTime}_${s.endTime}_${s.locationId || 'nal'}`;
      
      if(!groupedOpenShifts[dateKey]) groupedOpenShifts[dateKey] = {};
      if(!groupedOpenShifts[dateKey][groupKey]) groupedOpenShifts[dateKey][groupKey] = [];
      
      groupedOpenShifts[dateKey][groupKey].push(s);
  });

  const ShiftCard: React.FC<{ shift: ScheduleShift; isOpenBoard?: boolean }> = ({ shift, isOpenBoard = false }) => {
      const showFinishTimes = company?.settings.rotaShowFinishTimes !== false;
      const startD = new Date(shift.startTime);
      const endD = new Date(shift.endTime);
      const isOvernight = startD.toDateString() !== endD.toDateString();

      return (
        <div className={`bg-white dark:bg-white/5 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm mb-4 transition`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="font-bold text-lg text-slate-900 dark:text-white">{new Date(shift.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center">
                        {new Date(shift.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                        {showFinishTimes ? (
                            <>
                                - {new Date(shift.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                {isOvernight && <span className="ml-1 text-[9px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 px-1 rounded">+1</span>}
                            </>
                        ) : (
                            <span className="ml-2 font-medium text-slate-500">Till Finish</span>
                        )}
                    </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400`}>
                    {shift.role}
                </span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                <MapPin className="w-4 h-4" />
                <span>{shift.locationName || 'General Location'}</span>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                {shift.isOffered ? (
                    <button 
                        onClick={() => handleOfferShift(shift.id, false)}
                        className="w-full py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition"
                    >
                        <RotateCcw className="w-4 h-4" /> Retract Offer
                    </button>
                ) : (
                    <button 
                        onClick={() => handleOfferShift(shift.id, true)}
                        className="w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                        <ArrowRightLeft className="w-4 h-4" /> Offer Swap
                    </button>
                )}
            </div>
        </div>
      );
  };

  const OpenGroupCard: React.FC<{ shifts: ScheduleShift[] }> = ({ shifts }) => {
      const shift = shifts[0]; 
      const allowBidding = company?.settings.allowShiftBidding !== false; 
      const showFinishTimes = company?.settings.rotaShowFinishTimes !== false;
      const isSwap = !!shift.userId; 
      
      const isBidded = shifts.some(s => user && s.bids?.includes(user.id));
      const slotsCount = shifts.length;
      const ids = shifts.map(s => s.id);

      return (
        <div className={`p-5 rounded-2xl border ${isSwap ? 'border-purple-200 dark:border-purple-900/30 bg-purple-50 dark:bg-purple-900/5' : 'border-amber-200 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/5'} shadow-sm mb-4 transition`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="flex items-center space-x-2">
                        <div className="font-bold text-lg text-slate-900 dark:text-white">{new Date(shift.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                        {slotsCount > 1 && (
                            <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-200 dark:border-amber-500/20 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {slotsCount} Spots
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center">
                        {new Date(shift.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} 
                        {showFinishTimes && ` - ${new Date(shift.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${isSwap ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'}`}>
                        {shift.role}
                    </span>
                    {isSwap && <span className="text-[10px] text-purple-600 dark:text-purple-300 font-medium">Cover Request</span>}
                </div>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                <MapPin className="w-4 h-4" />
                <span>{shift.locationName || 'General Location'}</span>
            </div>

            {allowBidding ? (
                isBidded ? (
                    <button 
                        onClick={() => handleCancelBid(ids)}
                        className="w-full py-3 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl font-bold flex items-center justify-center space-x-2 transition border border-slate-300 dark:border-slate-700"
                    >
                        <X className="w-5 h-5" />
                        <span>Cancel Request</span>
                    </button>
                ) : (
                    <button 
                        onClick={() => handleBid(ids)}
                        className={`w-full py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition ${
                            isSwap ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20'
                        }`}
                    >
                        <span>{isSwap ? 'Offer to Cover' : `Bid for Shift (${slotsCount} Left)`}</span>
                    </button>
                )
            ) : (
                <div className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-medium text-center text-sm">
                    Bidding Disabled
                </div>
            )}
        </div>
      );
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
        <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Schedule</h1>
            <button 
                id="staff-rota-timeoff-btn"
                onClick={() => setIsTimeOffOpen(true)}
                className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 px-3 py-2 rounded-lg transition"
            >
                + Time Off
            </button>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-slate-200 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-white/5">
            <button 
                onClick={() => setActiveTab('my-shifts')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'my-shifts' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                My Shifts
            </button>
            <button 
                onClick={() => setActiveTab('open-board')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'open-board' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                Open Board
                {openShifts.length > 0 && <span className="ml-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{openShifts.length}</span>}
            </button>
             <button 
                onClick={() => setActiveTab('time-off')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'time-off' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
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
                                    <p>No open shifts available for your role.</p>
                                </div>
                            ) : (
                                Object.entries(groupedOpenShifts).map(([date, roleGroups]) => (
                                    <div key={date} className="mb-6">
                                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 pl-1">{date}</h3>
                                        {Object.values(roleGroups).map((group, idx) => (
                                            <OpenGroupCard key={idx} shifts={group} />
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'time-off' && (
                        <div className="space-y-4">
                            {myRequests.map(req => (
                                <div key={req.id} className="bg-white dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10 flex justify-between items-center group">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-white capitalize">{req.type}</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">{new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {req.status === 'pending' && <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-bold border border-yellow-200 dark:border-yellow-700/50">Pending</span>}
                                        {req.status === 'approved' && <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold border border-green-200 dark:border-green-700/50">Approved</span>}
                                        {req.status === 'rejected' && <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-bold border border-red-200 dark:border-red-700/50">Rejected</span>}
                                        
                                        <button 
                                            onClick={() => handleDeleteTimeOff(req.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-red-900/20 rounded-lg transition opacity-0 group-hover:opacity-100"
                                            title="Delete Request"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                 <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Request Time Off</h3>
                        <button id="timeoff-close-btn" onClick={() => setIsTimeOffOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-900 dark:hover:text-white" /></button>
                    </div>

                    <form onSubmit={handleSubmitTimeOff} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Type</label>
                            <select 
                                value={toType} onChange={e => setToType(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                            >
                                <option value="holiday">Holiday</option>
                                <option value="sickness">Sickness</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
                                <input 
                                    type="date" required
                                    value={toStart} onChange={e => setToStart(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                            </div>
                             <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">End Date</label>
                                <input 
                                    type="date" required
                                    value={toEnd} onChange={e => setToEnd(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                />
                            </div>
                        </div>
                         <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Reason (Optional)</label>
                            <input 
                                type="text"
                                value={toReason} onChange={e => setToReason(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                                placeholder="e.g. Family wedding"
                            />
                        </div>

                        <div className="pt-2">
                            {company?.settings.requireTimeOffApproval === false ? (
                                <p className="text-xs text-green-600 dark:text-green-400 mb-2">Note: Requests are automatically approved.</p>
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
