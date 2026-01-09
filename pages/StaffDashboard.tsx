
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStaffActivity, getCompany } from '../services/api';
import { Shift, Company } from '../types';
import { Clock, Scan, X, Camera } from 'lucide-react';
import jsQR from 'jsqr';
import { useNavigate } from 'react-router-dom';

export const StaffDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [greeting, setGreeting] = useState('Hello');
  
  // Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

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

  // Scanner Logic
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrame: number;

    const startScan = async () => {
        if (!isScanning) return;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Wait for video to be ready
                videoRef.current.setAttribute("playsinline", "true"); 
                videoRef.current.play();
                requestAnimationFrame(tick);
            }
        } catch (err) {
            console.error("Camera error", err);
            alert("Unable to access camera. Please ensure permissions are granted.");
            setIsScanning(false);
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
                 
                 if (code) {
                     // Found QR!
                     console.log("Found QR", code.data);
                     
                     // Detect if it's a Tally URL (either full URL or partial)
                     if (code.data.includes('action')) {
                         try {
                             let targetPath = '';
                             // Check if full URL
                             if (code.data.startsWith('http')) {
                                 const url = new URL(code.data);
                                 // Handle HashRouter URLs: example.com/#/action?t=...
                                 if (url.hash && url.hash.includes('action')) {
                                     targetPath = url.hash.substring(1); // removes #
                                 } else {
                                     // Standard URL
                                     targetPath = url.pathname + url.search;
                                 }
                             } else {
                                 // Might be relative path
                                 targetPath = code.data;
                             }
                             
                             setIsScanning(false);
                             if (stream) stream.getTracks().forEach(t => t.stop());
                             
                             // Navigate to the action handler
                             navigate(targetPath);
                             return; 
                         } catch (e) {
                             console.error("Parse error", e);
                         }
                     }
                 }
             }
        }
        animationFrame = requestAnimationFrame(tick);
    };

    if (isScanning) {
        startScan();
    }

    return () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(animationFrame);
    };
  }, [isScanning, navigate]);

  const calculateDuration = (startTime: number) => {
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return `${hours}h ${minutes}m`;
  };

  return (
    <div className="max-w-xl mx-auto space-y-8 animate-fade-in relative">
       <header className="flex items-center justify-between">
          <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{greeting}, {user?.name.split(' ')[0]}</h1>
              <p className="text-slate-500">Ready for your shift?</p>
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
                        onClick={() => setIsScanning(true)}
                        className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-white py-4 rounded-xl font-semibold transition flex items-center justify-center space-x-2"
                   >
                        <Scan className="w-5 h-5" />
                        <span>Scan to Clock Out</span>
                   </button>
               </div>
           ) : (
               <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 shadow-soft text-center">
                   <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                       <Clock className="w-8 h-8" />
                   </div>
                   <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Off Duty</h2>
                   <p className="text-slate-500 mb-8">Scan a Tally QR code to start tracking.</p>

                   <button 
                        onClick={() => setIsScanning(true)}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white py-4 rounded-xl font-semibold transition flex items-center justify-center space-x-2 shadow-lg shadow-brand-500/20"
                   >
                        <Scan className="w-5 h-5" />
                        <span>Scan QR to Clock In</span>
                   </button>
                   
                   {/* Manual Fallback (Only if enabled by admin) */}
                   {company?.settings.allowManualClockIn && (
                       <p className="text-xs text-slate-400 mt-4">
                           Scanner not working? <span className="underline cursor-pointer hover:text-brand-500">Manual Entry</span>
                       </p>
                   )}
               </div>
           )}
       </div>

       {/* Scanner Overlay */}
       {isScanning && (
            <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center animate-in fade-in duration-200">
                <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20">
                    <div className="text-white font-bold text-lg drop-shadow-md">Scan Code</div>
                    <button onClick={() => setIsScanning(false)} className="p-2 bg-white/20 rounded-full backdrop-blur-md text-white hover:bg-white/30 transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <video ref={videoRef} className="w-full h-full object-cover absolute inset-0 z-10" />
                
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                     <div className="w-72 h-72 border-2 border-brand-500 rounded-3xl relative shadow-[0_0_0_100vh_rgba(0,0,0,0.6)]">
                         <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-brand-500 rounded-tl-xl -mt-1 -ml-1"></div>
                         <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-brand-500 rounded-tr-xl -mt-1 -mr-1"></div>
                         <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-brand-500 rounded-bl-xl -mb-1 -ml-1"></div>
                         <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-brand-500 rounded-br-xl -mb-1 -mr-1"></div>
                         
                         <div className="absolute inset-0 flex items-center justify-center">
                             <Scan className="w-12 h-12 text-brand-500/50 animate-pulse" />
                         </div>
                     </div>
                </div>
                
                <div className="absolute bottom-12 z-20 text-white/80 text-sm font-medium bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                    Point camera at Tally QR Code
                </div>
            </div>
       )}

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
               {shifts.length === 0 && (
                   <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                       <p className="text-slate-500 text-sm">No activity recorded yet.</p>
                       <p className="text-slate-400 text-xs mt-1">Clock in to start your streak!</p>
                   </div>
               )}
           </div>
       </div>
    </div>
  );
};
