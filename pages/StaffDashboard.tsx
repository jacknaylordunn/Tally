
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';
import { getStaffActivity, getCompany, getSchedule, updateUserProfile, uploadVettingDocument } from '../services/api';
import { Shift, Company, ScheduleShift, VettingItem } from '../types';
import { Clock, Scan, X, Calendar, RefreshCw, AlertCircle, Play, StopCircle, MapPin, ChevronRight, FileCheck, Upload, Check, Loader2 } from 'lucide-react';
import jsQR from 'jsqr';
import { useNavigate } from 'react-router-dom';
import { VETTING_TEMPLATES } from '../constants';

export const StaffDashboard = () => {
  const { user, refreshSession } = useAuth();
  const { startTutorial } = useTutorial();
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

  // Vetting State
  const [isVettingOpen, setIsVettingOpen] = useState(false);
  const [vettingItems, setVettingItems] = useState<VettingItem[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

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

      // Prepare Vetting Data
      if (companyData?.settings.vettingEnabled) {
          const level = companyData.settings.vettingLevel || 'BS7858';
          const template = VETTING_TEMPLATES[level];
          
          // Merge template with user's existing data
          const mergedItems = template.map(tItem => {
              const existing = user.vettingData?.find(uItem => uItem.id === tItem.id);
              return existing ? { ...tItem, ...existing } : tItem;
          });
          setVettingItems(mergedItems);
      }

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
      
      // Try starting tutorial
      setTimeout(() => startTutorial(), 1000);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Scanner Logic
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

  // Vetting Handlers
  const handleVettingUpload = async (itemId: string, file: File) => {
      if (!user?.currentCompanyId) return;
      setUploadingId(itemId);
      try {
          const url = await uploadVettingDocument(user.currentCompanyId, user.id, file);
          
          // Update local state
          const updatedItems = vettingItems.map(item => {
              if (item.id === itemId) {
                  return { ...item, status: 'uploaded' as const, fileUrl: url, fileName: file.name, submittedAt: Date.now() };
              }
              return item;
          });
          setVettingItems(updatedItems);

          // Save to User Profile
          await updateUserProfile(user.id, {
              vettingStatus: 'in_progress',
              vettingData: updatedItems
          });
          
      } catch (e) {
          console.error("Upload failed", e);
          alert("Failed to upload document.");
      } finally {
          setUploadingId(null);
      }
  };

  const submitVetting = async () => {
      if (!user) return;
      await updateUserProfile(user.id, { vettingStatus: 'submitted' });
      await refreshSession();
      setIsVettingOpen(false);
      alert("Vetting submitted for review.");
  };

  const needsVetting = company?.settings.vettingEnabled && user?.vettingStatus !== 'verified';

  return (
    <div className="max-w-md mx-auto space-y-8 animate-fade-in relative pb-20">
       
       <header className="flex items-center justify-between glass-panel p-6 rounded-3xl border border-slate-200 dark:border-white/10">
          <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{greeting}, {user?.name.split(' ')[0]}</h1>
              <p className="text-slate-500 text-sm">Ready to work?</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/20 border border-brand-200 dark:border-brand-500/50 flex items-center justify-center text-brand-600 dark:text-brand-300 font-bold text-lg shadow-sm dark:shadow-glow">
              {user?.name.charAt(0)}
          </div>
       </header>

       {/* Vetting Alert */}
       {needsVetting && (
           <div 
                onClick={() => setIsVettingOpen(true)}
                className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 p-4 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition shadow-sm"
           >
               <div className="flex items-center gap-3">
                   <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg text-amber-600 dark:text-amber-200">
                       <FileCheck className="w-5 h-5" />
                   </div>
                   <div>
                       <h3 className="font-bold text-amber-800 dark:text-amber-200 text-sm">Vetting Required</h3>
                       <p className="text-xs text-amber-700 dark:text-amber-300/80">
                           {user?.vettingStatus === 'submitted' ? 'Under Review' : 'Complete your compliance checks'}
                       </p>
                   </div>
               </div>
               <ChevronRight className="w-5 h-5 text-amber-400" />
           </div>
       )}

       {/* HERO CLOCK UI */}
       <div className="relative flex justify-center py-4">
           {activeShift ? (
               <div className="relative group cursor-pointer" onClick={() => setIsScanning(true)}>
                   {/* Background Glow */}
                   <div className="absolute inset-0 bg-green-500 rounded-full blur-[60px] opacity-20 animate-pulse-slow"></div>
                   
                   {/* Main Circle */}
                   <div className="w-64 h-64 rounded-full bg-white dark:bg-slate-900 border-4 border-green-500/20 flex flex-col items-center justify-center relative z-10 shadow-2xl transition-transform hover:scale-105">
                       <div className="text-xs font-bold uppercase tracking-[0.2em] text-green-600 dark:text-green-400 mb-2">Active Shift</div>
                       <div className="text-6xl font-mono font-bold text-slate-900 dark:text-white tracking-tighter tabular-nums">
                           {duration.h}:{duration.m.toString().padStart(2, '0')}
                       </div>
                       <div className="text-slate-400 mt-1 font-medium">hrs</div>
                       
                       <div className="absolute bottom-8 flex items-center gap-2 text-white bg-red-500 px-4 py-2 rounded-full shadow-lg">
                           <StopCircle className="w-4 h-4 fill-current" />
                           <span className="text-sm font-bold">Tap to End</span>
                       </div>
                   </div>
               </div>
           ) : (
               <div id="staff-clock-in-btn" className="relative group cursor-pointer" onClick={() => setIsScanning(true)}>
                   <div className="absolute inset-0 bg-brand-600 rounded-full blur-[60px] opacity-20 group-hover:opacity-40 transition duration-500"></div>
                   <div className="w-64 h-64 rounded-full bg-gradient-to-br from-brand-600 to-indigo-700 flex flex-col items-center justify-center relative z-10 shadow-2xl shadow-brand-900/50 border-4 border-white/20 transition-all hover:scale-105 hover:rotate-3 active:scale-95">
                       <Play className="w-16 h-16 text-white ml-2 mb-2 fill-current" />
                       <span className="text-2xl font-bold text-white tracking-tight">Clock In</span>
                       
                       {nextScheduledShift && (
                           <div className="absolute -bottom-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shadow-lg">
                               <Calendar className="w-3 h-3 text-brand-500" />
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

       {/* VETTING MODAL */}
       {isVettingOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
               <div className="glass-panel w-full max-w-lg p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 max-h-[85vh] flex flex-col">
                   <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Compliance Check</h2>
                            <p className="text-xs text-slate-500">{company?.settings.vettingLevel} Standard</p>
                        </div>
                        <button onClick={() => setIsVettingOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                   </div>

                   <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                       {vettingItems.map(item => (
                           <div key={item.id} className="border border-slate-200 dark:border-white/10 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50">
                               <div className="flex justify-between items-start mb-2">
                                   <div>
                                       <h4 className="font-bold text-slate-900 dark:text-white text-sm">{item.label}</h4>
                                       {item.description && <p className="text-xs text-slate-500 mt-1">{item.description}</p>}
                                   </div>
                                   {item.status === 'accepted' ? (
                                       <div className="bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1">
                                           <Check className="w-3 h-3" /> Verified
                                       </div>
                                   ) : item.status === 'uploaded' ? (
                                       <div className="bg-blue-100 text-blue-700 text-[10px] px-2 py-1 rounded-lg font-bold">In Review</div>
                                   ) : item.status === 'rejected' ? (
                                       <div className="bg-red-100 text-red-700 text-[10px] px-2 py-1 rounded-lg font-bold">Rejected</div>
                                   ) : (
                                       <div className="bg-slate-200 text-slate-600 text-[10px] px-2 py-1 rounded-lg font-bold">Required</div>
                                   )}
                               </div>

                               {item.type === 'file' && item.status !== 'accepted' && (
                                   <div className="mt-3">
                                       <input 
                                            type="file" 
                                            id={`file-${item.id}`}
                                            className="hidden" 
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) handleVettingUpload(item.id, e.target.files[0]);
                                            }}
                                       />
                                       <label 
                                            htmlFor={`file-${item.id}`}
                                            className={`flex items-center justify-center w-full py-2 border-2 border-dashed rounded-lg text-xs font-bold cursor-pointer transition ${uploadingId === item.id ? 'opacity-50 cursor-wait' : 'hover:border-brand-500 hover:text-brand-600'}`}
                                       >
                                           {uploadingId === item.id ? (
                                               <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span>
                                           ) : (
                                               <span className="flex items-center gap-2"><Upload className="w-3 h-3" /> {item.fileName || 'Select File'}</span>
                                           )}
                                       </label>
                                   </div>
                               )}
                               
                               {item.type === 'check' && (
                                   <div className="mt-2 text-xs text-slate-400 italic bg-black/5 dark:bg-white/5 p-2 rounded">
                                       Pending manual verification by admin.
                                   </div>
                               )}
                           </div>
                       ))}
                   </div>

                   <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                       <button 
                            onClick={submitVetting}
                            disabled={vettingItems.some(i => i.required && i.status === 'pending')}
                            className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                       >
                           Submit for Approval
                       </button>
                   </div>
               </div>
           </div>
       )}

       {/* Activity List */}
       <div className="glass-panel rounded-3xl p-6 border border-slate-200 dark:border-white/10">
           <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-900 dark:text-white text-lg">Recent History</h3>
               <button onClick={() => navigate('/staff/activity')} className="text-brand-600 dark:text-brand-400 text-sm font-semibold hover:text-brand-500">View All</button>
           </div>
           
           <div className="space-y-3">
               {shifts.slice(0, 3).map(shift => (
                   <button 
                        key={shift.id} 
                        onClick={() => navigate('/staff/activity')}
                        className="w-full group bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-brand-200 dark:hover:bg-white/10 transition-colors flex items-center justify-between shadow-sm dark:shadow-none text-left"
                    >
                       <div className="flex items-center gap-4">
                           <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold ${shift.endTime ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'}`}>
                               <span>{new Date(shift.startTime).getDate()}</span>
                               <span className="uppercase opacity-60 text-[10px]">{new Date(shift.startTime).toLocaleString('default', { month: 'short' })}</span>
                           </div>
                           <div>
                               <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                   {shift.endTime ? `${((shift.endTime - shift.startTime) / 3600000).toFixed(1)} hrs` : 'Active Now'}
                                </p>
                               <div className="flex items-center gap-1 text-xs text-slate-500">
                                   <MapPin className="w-3 h-3" />
                                   <span>{shift.companyId ? 'Office' : 'Remote'}</span>
                               </div>
                           </div>
                       </div>
                       <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition" />
                   </button>
               ))}
               {shifts.length === 0 && (
                   <div className="text-center py-8 text-slate-500 text-sm">No activity recorded yet.</div>
               )}
           </div>
       </div>
    </div>
  );
};