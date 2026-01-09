
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { X, RefreshCw, Zap } from 'lucide-react';
import QRCode from 'react-qr-code';
import { getCompany } from '../services/api';
import { Company } from '../types';

export const KioskMode = () => {
  const { user } = useAuth();
  const [qrValue, setQrValue] = useState('');
  const [timeLeft, setTimeLeft] = useState(10);
  const [company, setCompany] = useState<Company | null>(null);
  const wakeLockRef = useRef<any>(null);
  
  // Base URL for the action handler (Hash Router aware)
  const baseUrl = `${window.location.protocol}//${window.location.host}/#/action`;

  // Fetch Company Branding
  useEffect(() => {
    const loadCompany = async () => {
        if (user?.currentCompanyId) {
            const data = await getCompany(user.currentCompanyId);
            setCompany(data);
        }
    };
    loadCompany();
  }, [user]);

  // Request Wake Lock
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
    
    // Re-request if visibility changes (tab switching)
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

  // QR & Timer Logic
  useEffect(() => {
    if (!user?.currentCompanyId) return;

    const generateQR = () => {
      const timestamp = Date.now();
      const params = new URLSearchParams({
        type: 'kiosk',
        t: timestamp.toString(),
        cid: user.currentCompanyId! // Force non-null here as checked above
      });
      // URL: domain/#/action?params
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

  // Calculate Dash Offset for SVG Circle
  // Circumference = 2 * PI * r (r=22) ~= 138
  const circumference = 138;
  const strokeDashoffset = circumference - (timeLeft / 10) * circumference;

  const brandColor = company?.settings.primaryColor || '#0ea5e9';

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-brand-500/30">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-900 via-slate-900 to-slate-900 opacity-50 z-0"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" style={{ backgroundColor: brandColor }}></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

        <Link to="/admin" className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full z-20 transition-all backdrop-blur-sm group">
            <X className="w-6 h-6 text-slate-300 group-hover:text-white" />
        </Link>

        <div className="z-10 flex flex-col items-center max-w-lg w-full p-8 animate-in fade-in zoom-in duration-500">
            {/* Company Header */}
             <div className="mb-10 text-center flex flex-col items-center">
                 {company?.settings.logoUrl ? (
                     <img src={company.settings.logoUrl} alt="Logo" className="w-20 h-20 rounded-2xl mb-6 shadow-xl object-cover bg-white" />
                 ) : (
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center font-bold text-3xl shadow-xl shadow-brand-900/50 mb-4" style={{ color: brandColor }}>
                        {user?.name.charAt(0) || 'T'}
                    </div>
                 )}
                <h1 className="text-3xl font-bold tracking-tight mb-2">Scan to Clock In</h1>
                <p className="text-slate-400">Open your camera app</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-brand-500/20 relative group">
                {/* QR Code */}
                {qrValue && (
                    <div className="w-72 h-72 flex items-center justify-center relative z-10">
                        <QRCode value={qrValue} size={256} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
                    </div>
                )}
                
                {/* Timer Ring */}
                <div className="absolute -bottom-6 -right-6 bg-slate-900 rounded-full p-1 shadow-xl">
                    <div className="relative w-14 h-14 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                            <circle cx="28" cy="28" r="22" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800" />
                            <circle 
                                cx="28" cy="28" r="22" stroke="currentColor" strokeWidth="4" fill="transparent" 
                                className="transition-all duration-1000 ease-linear"
                                style={{ color: brandColor }}
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                            />
                        </svg>
                        <span className="absolute text-sm font-bold">{timeLeft}</span>
                    </div>
                </div>
            </div>

            <div className="mt-16 flex items-center space-x-3 px-6 py-2 bg-white/5 rounded-full backdrop-blur-sm border border-white/5">
                <div className="relative">
                    <RefreshCw className="w-4 h-4 animate-spin-slow" style={{ color: brandColor }} />
                </div>
                <span className="text-slate-400 text-sm font-medium tracking-wide">Secure Token Active</span>
            </div>

            <div className="mt-6 text-center opacity-40 hover:opacity-100 transition-opacity">
               <p className="text-xs text-slate-500 flex items-center gap-1">
                   <Zap className="w-3 h-3" />
                   Tally Kiosk
               </p>
            </div>
        </div>
    </div>
  );
};
