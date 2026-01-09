
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifyToken } from '../services/api';
import { CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { UserRole } from '../types';

export const ActionHandler = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying...');

  const processScan = useCallback(async () => {
      setStatus('loading');
      
      // 1. Auth Check (Bounce Logic)
      if (!isAuthenticated) {
        const currentUrl = window.location.href;
        sessionStorage.setItem('pendingScan', currentUrl);
        navigate('/login');
        return;
      }

      // 2. Parse Query Params
      const searchParams = new URLSearchParams(location.search);
      const type = searchParams.get('type') as 'kiosk' | 'static' | null;
      const token = searchParams.get('t'); // For kiosk
      const locId = searchParams.get('lid'); // For static

      if (!type || (!token && !locId)) {
        setStatus('error');
        setMessage('Invalid QR Code configuration.');
        return;
      }

      // 3. Location Check (for Static)
      let locationData = undefined;
      if (type === 'static') {
        try {
          setMessage('Verifying your location...');
          const pos: GeolocationPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000, // Increased timeout for better fix
                maximumAge: 0
            });
          });

          // Security: Check Accuracy (allow up to 500m accuracy circle, logic in API checks distance)
          if (pos.coords.accuracy > 1000) {
              console.warn("Low GPS accuracy:", pos.coords.accuracy);
          }

          locationData = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            locationId: locId || ''
          };
        } catch (e: any) {
          setStatus('error');
          if (e.code === 1) setMessage('Location permission denied. Please enable GPS.');
          else if (e.code === 2) setMessage('Position unavailable. Please move outside.');
          else if (e.code === 3) setMessage('GPS timed out. Please try again.');
          else setMessage('Could not verify location.');
          return;
        }
      }

      // 4. Server Validation
      setMessage('Processing Clock In...');
      const result = await verifyToken(
        token || '', 
        user!.id, 
        type, 
        locationData
      );

      if (result.success) {
        setStatus('success');
        setMessage(result.message);
        if (navigator.vibrate) navigator.vibrate(200);
        
        setTimeout(() => {
             if (user?.role === UserRole.ADMIN) navigate('/admin');
             else navigate('/staff');
        }, 2000);
      } else {
        setStatus('error');
        setMessage(result.message);
      }
  }, [isAuthenticated, location.search, navigate, user]);

  useEffect(() => {
    if (!authLoading) {
        if (isAuthenticated) {
            processScan();
        } else {
             const currentUrl = window.location.href;
             sessionStorage.setItem('pendingScan', currentUrl);
             navigate('/login');
        }
    }
  }, [isAuthenticated, authLoading, processScan, navigate]);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-500 ${
        status === 'success' ? 'bg-success' : 
        status === 'error' ? 'bg-danger' : 
        'bg-slate-900'
    }`}>
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
        {status === 'loading' && (
            <div className="flex flex-col items-center text-white">
                <Loader2 className="w-16 h-16 animate-spin mb-4 opacity-80" />
                <h2 className="text-2xl font-bold">{message}</h2>
            </div>
        )}

        {status === 'success' && (
            <div className="flex flex-col items-center animate-bounce-in text-white">
                <CheckCircle className="w-24 h-24 mb-6" />
                <h2 className="text-4xl font-bold mb-2">Success!</h2>
                <p className="text-xl opacity-90">{message}</p>
            </div>
        )}

        {status === 'error' && (
            <div className="flex flex-col items-center text-white">
                <XCircle className="w-24 h-24 mb-6" />
                <h2 className="text-3xl font-bold mb-2">Failed</h2>
                <p className="text-lg opacity-90 mb-8">{message}</p>
                
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button 
                        onClick={() => processScan()}
                        className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition flex items-center justify-center space-x-2"
                    >
                        <RefreshCw className="w-5 h-5" />
                        <span>Try Again</span>
                    </button>
                    <button 
                        onClick={() => navigate('/staff')}
                        className="bg-white text-danger px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-slate-100 transition"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
