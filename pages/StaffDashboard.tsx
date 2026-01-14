
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStaffActivity, getCompany, getSchedule } from '../services/api';
import { Shift, Company, ScheduleShift } from '../types';
import { Clock, Scan, X, Calendar, RefreshCw, AlertCircle, Play, StopCircle, MapPin, ChevronRight } from 'lucide-react';
import jsQR from 'jsqr';
import { useNavigate } from 'react-router-dom';

export const StaffDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [nextScheduledShift, setNextScheduledShift] = useState<ScheduleShift | null>(null);
  const [greeting, setGreeting] = useState('Hello');
  
  // Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

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

      if (companyData?.settings.rotaEnabled && user.currentCompanyId) {
          try {
              const now = new Date();
              const endOfDay = new Date(); endOfDay.setHours(23, 59, 59);
              const todayShifts = await getSchedule(user.currentCompanyId, now.getTime(), endOfDay.getTime());
              const upcoming = todayShifts
                  .filter(s => s.userId === user.id && s.startTime > Date.now())
                  .sort((a,b) => a.startTime - b.startTime);
              
              if (upcoming.length > 0) {
                  setNextScheduledShift(upcoming[0]);
              }
          } catch (e) {
              console.error("Error fetching next shift", e);
          }
      }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Scanner Logic (Same logic, new UI hook triggers)
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrame: number;

    const startScan = async () => {
        if (!isScanning) return;
        setCameraError('');
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute("playsinline", "true"); 
                videoRef.current.play();
                requestAnimationFrame(tick);
            }
        } catch (err: any) {
            console.error("Camera error", err);
            if (err.name === 'NotAllowedError') setCameraError("Camera permission denied.");
            else if (err.name === 'NotFoundError') setCameraError("No camera found.");
            else setCameraError("Unable to access camera.");
        }
    };

    const tick = () => {
        if (!videoRef.current || !isScanning) return;
        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
             const canvas = document.createElement("canvas");
             canvas.width = videoRef.current.videoWidth;
             canvas.height = videoRef.current.videoHeight;
             const ctx = canvas.getContext("2d");
             if (ctx) {
                 ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                 const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                 const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                 
                 if (code && code.data.includes('action')) {
                     try {
                         let targetPath = '';
                         if (code.data.startsWith('http')) {
                             const url = new URL(code.data);
                             targetPath = url.hash ? url.hash.substring(1) : (url.pathname + url.search);
                         } else {
                             targetPath = code.data;
                         }
                         setIsScanning(false);
                         if (stream) stream.getTracks().forEach(t => t.stop());
                         navigate(targetPath);
                         return; 
                     } catch (e) {
                         console.error("Parse error", e);
                     }
                 }
             }
        }
        animationFrame = requestAnimationFrame(tick);
    };

    if (isScanning) startScan();
    return () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(animationFrame);
    };
  }, [isScanning, navigate]);

  const calculateDuration = (startTime: number) => {
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return { h: hours, m: minutes };
  };

  const duration = activeShift ? calculateDuration(activeShift.startTime) : {h:0, m:0};

  return (
    <div className="max-w-md mx-auto space-y-8 animate-fade-in relative pb-20">
       
       <header className="flex items-center justify-between glass-panel p-6 rounded-3xl">
          <div>
              <h1 className="text-xl font-bold text-white">{greeting}, {user?.name.split(' ')[0]}</h1>
              <p className="text-slate-400 text-sm">Ready to work?</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 border border-brand-500/50 flex items-center justify-center text-brand-300 font-bold text-lg shadow-glow">
              {user?.name.charAt(0)}
          </div>
       </header>

       {/* HERO CLOCK UI */}
       <div className="relative flex justify-center py-4">
           {activeShift ? (
               <div className="relative group cursor-pointer" onClick={() => setIsScanning(true)}>
                   {/* Background Glow */}
                   <div className="absolute inset-0 bg-green-500 rounded-full blur-[60px] opacity-20 animate-pulse-slow"></div>
                   
                   {/* Main Circle */}
                   <div className="w-64 h-64 rounded-full glass-panel border-2 border-green-500/50 flex flex-col items-center justify-center relative z-10 shadow-2xl transition-transform hover:scale-105">
                       <div className="text-xs font-bold uppercase tracking-[0.2em] text-green-400 mb-2">Active Shift</div>
                       <div className="text-6xl font-mono font-bold text-white tracking-tighter tabular-nums">
                           {duration.h}:{duration.m.toString().padStart(2, '0')}
                       </div>
                       <div className="text-slate-400 mt-1 font-medium">hrs</div>
                       
                       <div className="absolute bottom-8 flex items-center gap-2 text-white/80 bg-white/10 px-4 py-2 rounded-full backdrop-blur-md">
                           <StopCircle className="w-4 h-4 fill-current text-red-400" />
                           <span className="text-sm font-bold">Tap to End</span>
                       </div>
                   </div>
               </div>
           ) : (
               <div className="relative group cursor-pointer" onClick={() => setIsScanning(true)}>
                   <div className="absolute inset-0 bg-brand-600 rounded-full blur-[60px] opacity-20 group-hover:opacity-40 transition duration-500"></div>
                   <div className="w-64 h-64 rounded-full bg-gradient-to-br from-brand-600 to-indigo-700 flex flex-col items-center justify-center relative z-10 shadow-2xl shadow-brand-900/50 border-4 border-white/5 transition-all hover:scale-105 hover:rotate-3 active:scale-95">
                       <Play className="w-16 h-16 text-white ml-2 mb-2 fill-current" />
                       <span className="text-2xl font-bold text-white tracking-tight">Clock In</span>
                       
                       {nextScheduledShift && (
                           <div className="absolute -bottom-6 bg-slate-800 border border-slate-700 text-slate-300 px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shadow-lg">
                               <Calendar className="w-3 h-3 text-brand-400" />
                               {new Date(nextScheduledShift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </div>
                       )}
                   </div>
               </div>
           )}
       </div>

       {/* SCANNER MODAL */}
       {isScanning && (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fade-in">
                <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20">
                    <div className="text-white font-bold text-lg drop-shadow-md">Scanner</div>
                    <button onClick={() => { setIsScanning(false); setCameraError(''); }} className="p-3 bg-white/10 rounded-full backdrop-blur-md text-white hover:bg-white/20 transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {cameraError ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Camera Issue</h3>
                        <p className="text-slate-400 mb-6">{cameraError}</p>
                        <button onClick={() => {setIsScanning(false); setTimeout(() => setIsScanning(true), 100)}} className="px-6 py-3 bg-white text-black rounded-xl font-bold">Retry</button>
                    </div>
                ) : (
                    <>
                        <video ref={videoRef} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                             <div className="w-72 h-72 border-2 border-brand-500 rounded-[2rem] relative shadow-[0_0_0_100vh_rgba(0,0,0,0.7)]">
                                 <div className="absolute inset-0 border-4 border-white/20 rounded-[2rem] animate-pulse"></div>
                                 <Scan className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-white/50" />
                             </div>
                        </div>
                        <div className="absolute bottom-12 w-full text-center z-20">
                            <span className="bg-black/60 text-white px-6 py-3 rounded-full text-sm font-medium backdrop-blur-md border border-white/10">
                                Scan Code to {activeShift ? 'Clock Out' : 'Clock In'}
                            </span>
                        </div>
                    </>
                )}
            </div>
       )}

       {/* Activity List */}
       <div className="glass-panel rounded-3xl p-6">
           <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-white text-lg">Recent History</h3>
               <button onClick={() => navigate('/staff/activity')} className="text-brand-400 text-sm font-semibold hover:text-brand-300">View All</button>
           </div>
           
           <div className="space-y-3">
               {shifts.slice(0, 3).map(shift => (
                   <div key={shift.id} className="group bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors flex items-center justify-between">
                       <div className="flex items-center gap-4">
                           <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold ${shift.endTime ? 'bg-slate-800 text-slate-400' : 'bg-green-500/20 text-green-400'}`}>
                               <span>{new Date(shift.startTime).getDate()}</span>
                               <span className="uppercase opacity-60 text-[10px]">{new Date(shift.startTime).toLocaleString('default', { month: 'short' })}</span>
                           </div>
                           <div>
                               <p className="font-semibold text-white text-sm">
                                   {shift.endTime ? `${((shift.endTime - shift.startTime) / 3600000).toFixed(1)} hrs` : 'Active Now'}
                                </p>
                               <div className="flex items-center gap-1 text-xs text-slate-500">
                                   <MapPin className="w-3 h-3" />
                                   <span>{shift.companyId ? 'Office' : 'Remote'}</span>
                               </div>
                           </div>
                       </div>
                       <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition" />
                   </div>
               ))}
               {shifts.length === 0 && (
                   <div className="text-center py-8 text-slate-500 text-sm">No activity recorded yet.</div>
               )}
           </div>
       </div>
    </div>
  );
};
