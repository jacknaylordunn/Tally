
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { X, Zap, ShieldCheck, Maximize, Minimize } from 'lucide-react';
import QRCode from 'react-qr-code';
import { getCompany } from '../services/api';
import { Company } from '../types';
import { LOGO_URL } from '../constants';

export const KioskMode = () => {
  const { user } = useAuth();
  const [qrValue, setQrValue] = useState('');
  const [timeLeft, setTimeLeft] = useState(10);
  const [company, setCompany] = useState<Company | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wakeLockRef = useRef<any>(null);
  
  const baseUrl = `${window.location.protocol}//${window.location.host}/#/action`;

  useEffect(() => {
    const loadCompany = async () => {
        if (user?.currentCompanyId) {
            const data = await getCompany(user.currentCompanyId);
            setCompany(data);
        }
    };
    loadCompany();
  }, [user]);

  useEffect(() => {
    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                console.log('Wake Lock active');
            }
        } catch (err) {
            console.error(`${err}`);
        }
    };
    requestWakeLock();
    
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            requestWakeLock();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        if (wakeLockRef.current) wakeLockRef.current.release();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!user?.currentCompanyId) return;

    const generateQR = () => {
      const timestamp = Date.now();
      const params = new URLSearchParams({
        type: 'kiosk',
        t: timestamp.toString(),
        cid: user.currentCompanyId! 
      });
      setQrValue(`${baseUrl}?${params.toString()}`);
      setTimeLeft(10);
    };

    generateQR();

    const intervalId = setInterval(() => {
      generateQR();
    }, 10000);

    const countdownId = setInterval(() => {
      setTimeLeft((prev) => prev > 0 ? prev - 1 : 0);
    }, 1000);

    return () => {
      clearInterval(intervalId);
      clearInterval(countdownId);
    };
  }, [baseUrl, user]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        setIsFullscreen(true);
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }
  };

  const brandColor = company?.settings.primaryColor || '#0ea5e9';

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans select-none">
        
        {/* Ambient Background */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 z-0"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-brand-500/10 rounded-full blur-[100px] opacity-30 pointer-events-none"></div>

        {/* Header / Nav */}
        <div className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-20">
             <div className="flex items-center space-x-3 bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                 <span className="text-xs font-medium tracking-wide text-white/80">LIVE CONNECTION</span>
             </div>

             <div className="flex items-center space-x-4">
                 <button 
                    onClick={toggleFullscreen}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white"
                >
                    {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                 </button>
                 <Link to="/admin" id="kiosk-exit-btn" className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all backdrop-blur-sm group">
                    <X className="w-6 h-6 text-slate-300 group-hover:text-white" />
                </Link>
             </div>
        </div>

        {/* Main Content */}
        <div className="z-10 flex flex-col items-center max-w-lg w-full p-8 animate-in fade-in zoom-in duration-500">
            
            {/* Branding */}
             <div className="mb-10 text-center flex flex-col items-center">
                 <div className="relative mb-6">
                    {company?.settings.logoUrl ? (
                        <img src={company.settings.logoUrl} alt="Logo" className="w-24 h-24 rounded-xl shadow-xl object-contain bg-white p-1" />
                    ) : (
                        <img src={LOGO_URL} alt="Logo" className="w-24 h-24 rounded-xl shadow-xl object-contain bg-white p-1 opacity-90" />
                    )}
                 </div>
                <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">Scan to Clock In & Out</h1>
                <p className="text-slate-400 text-lg">Use your phone camera</p>
            </div>

            {/* QR Card */}
            <div className="relative group">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-brand-500 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-30 transition-opacity duration-1000 animate-pulse"></div>
                
                <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl relative z-10 flex flex-col items-center">
                    {/* ID Badge notch visual */}
                    <div className="w-20 h-1.5 bg-slate-200 rounded-full mb-6"></div>

                    {qrValue && (
                        <div className="w-72 h-72 flex items-center justify-center relative">
                            <QRCode value={qrValue} size={256} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                            
                            {/* Security Watermark / Logo Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                                <ShieldCheck className="w-32 h-32 text-slate-900" />
                            </div>
                        </div>
                    )}
                    
                    <div className="mt-6 flex items-center space-x-2 text-slate-400 text-xs uppercase tracking-widest font-bold">
                        <Zap className="w-3 h-3 text-brand-500" />
                        <span>Dynamic Security Code</span>
                    </div>
                </div>

                {/* Timer Floating Badge */}
                <div className="absolute -bottom-5 -right-5 bg-slate-800 rounded-full p-1.5 shadow-xl border-4 border-slate-900 z-20">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-slate-700" />
                            <circle 
                                cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="5" fill="transparent" 
                                className="transition-all duration-1000 ease-linear"
                                style={{ color: brandColor }}
                                strokeDasharray="163" 
                                strokeDashoffset={163 - (timeLeft / 10) * 163}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className="absolute text-lg font-bold font-mono">{timeLeft}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-20 flex flex-col items-center space-y-4 opacity-50">
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Powered by Tallyd</span>
                </div>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest">Device ID: {user?.id.substring(0,8)}</p>
            </div>
        </div>
    </div>
  );
};
