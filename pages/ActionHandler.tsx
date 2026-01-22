
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifyToken } from '../services/api';
import { CheckCircle, XCircle, Loader2, RefreshCw, Home } from 'lucide-react';
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

  // Dynamic styles based on status
  const getStyles = () => {
      switch (status) {
          case 'success':
              return {
                  container: 'bg-green-100 dark:bg-green-900',
                  icon: 'text-green-600 dark:text-green-400',
                  title: 'text-green-900 dark:text-white',
                  text: 'text-green-800 dark:text-green-200'
              };
          case 'error':
              return {
                  container: 'bg-red-100 dark:bg-red-900',
                  icon: 'text-red-600 dark:text-red-400',
                  title: 'text-red-900 dark:text-white',
                  text: 'text-red-800 dark:text-red-200'
              };
          default:
              return {
                  container: 'bg-slate-50 dark:bg-slate-900',
                  icon: 'text-brand-600 dark:text-brand-400',
                  title: 'text-slate-900 dark:text-white',
                  text: 'text-slate-500 dark:text-slate-400'
              };
      }
  };

  const styles = getStyles();

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-500 ${styles.container}`}>
      <div className="max-w-md w-full animate-in fade-in zoom-in duration-300">
        
        {status === 'loading' && (
            <div className="flex flex-col items-center">
                <Loader2 className={`w-16 h-16 animate-spin mb-6 ${styles.icon}`} />
                <h2 className={`text-2xl font-bold mb-2 ${styles.title}`}>{message}</h2>
                <p className={styles.text}>Please wait...</p>
            </div>
        )}

        {status === 'success' && (
            <div className="flex flex-col items-center animate-bounce-in">
                <CheckCircle className={`w-24 h-24 mb-6 ${styles.icon}`} />
                <h2 className={`text-4xl font-bold mb-2 ${styles.title}`}>Success!</h2>
                <p className={`text-xl ${styles.text}`}>{message}</p>
            </div>
        )}

        {status === 'error' && (
            <div className="flex flex-col items-center">
                <XCircle className={`w-24 h-24 mb-6 ${styles.icon}`} />
                <h2 className={`text-3xl font-bold mb-2 ${styles.title}`}>Failed</h2>
                <p className={`text-lg mb-8 ${styles.text}`}>{message}</p>
                
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button 
                        onClick={() => processScan()}
                        className="bg-white dark:bg-black/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-red-50 dark:hover:bg-black/30 transition flex items-center justify-center space-x-2"
                    >
                        <RefreshCw className="w-5 h-5" />
                        <span>Try Again</span>
                    </button>
                    <button 
                        onClick={() => navigate(user?.role === UserRole.ADMIN ? '/admin' : '/staff')}
                        className="bg-red-600 dark:bg-white text-white dark:text-red-900 px-6 py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition flex items-center justify-center space-x-2"
                    >
                        <Home className="w-5 h-5" />
                        <span>Go to Dashboard</span>
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};
