
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifyToken } from '../services/api';
import { CheckCircle, XCircle, Loader2, RefreshCw, Home, MapPin, Settings, AlertTriangle, Navigation } from 'lucide-react';
import { UserRole } from '../types';

export const ActionHandler = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Status: 'idle' means waiting for user to tap (for GPS). 'loading' is processing.
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying...');
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Extract query params once
  const searchParams = new URLSearchParams(location.search);
  const type = searchParams.get('type') as 'kiosk' | 'static' | null;
  const token = searchParams.get('t');
  const locId = searchParams.get('lid');

  const processScan = useCallback(async () => {
      setStatus('loading');
      setPermissionDenied(false); 
      
      // 1. Auth Check
      if (!isAuthenticated) {
        const currentUrl = window.location.href;
        sessionStorage.setItem('pendingScan', currentUrl);
        navigate('/login');
        return;
      }

      if (!type || (!token && !locId)) {
        setStatus('error');
        setMessage('Invalid QR Code configuration.');
        return;
      }

      // 2. Location Check (for Static)
      let locationData = undefined;
      if (type === 'static') {
        try {
          setMessage('Acquiring GPS location...');
          
          // CRITICAL: This must happen after a user gesture on iOS
          const pos: GeolocationPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 20000, 
                maximumAge: 0
            });
          });

          if (pos.coords.accuracy > 2000) {
              console.warn("Low GPS accuracy:", pos.coords.accuracy);
          }

          locationData = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            locationId: locId || ''
          };
        } catch (e: any) {
          console.error("GPS Error", e);
          setStatus('error');
          
          if (e.code === 1) { // PERMISSION_DENIED
              setPermissionDenied(true);
              setMessage('Location access denied.');
          }
          else if (e.code === 2) setMessage('Position unavailable. GPS signal weak.');
          else if (e.code === 3) setMessage('GPS timed out. Please try again.');
          else setMessage('Could not verify location.');
          return;
        }
      }

      // 3. Server Validation
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
  }, [isAuthenticated, type, token, locId, navigate, user]);

  useEffect(() => {
    if (!authLoading) {
        if (!isAuthenticated) {
             const currentUrl = window.location.href;
             sessionStorage.setItem('pendingScan', currentUrl);
             navigate('/login');
             return;
        }

        // Logic to determine if we can auto-start
        if (type === 'static') {
            // For static GPS scans, we NEVER auto-start. 
            // We force an 'idle' state so the user must click a button.
            // This satisfies iOS Safari's requirement for user gestures before Geolocation.
            setStatus('idle');
        } else {
            // Kiosk/Dynamic codes don't need GPS, so we auto-process
            processScan();
        }
    }
  }, [authLoading, isAuthenticated, type, processScan, navigate]);

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
          default: // idle or loading
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
        
        {status === 'idle' && (
            <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <MapPin className={`w-12 h-12 ${styles.icon}`} />
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${styles.title}`}>Location Check</h2>
                <p className={`mb-8 ${styles.text}`}>We need to verify you are on site.</p>
                
                <button 
                    onClick={() => processScan()}
                    className="w-full max-w-xs bg-brand-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition flex items-center justify-center space-x-2"
                >
                    <Navigation className="w-5 h-5" />
                    <span>Verify & Clock In</span>
                </button>
            </div>
        )}

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
                {permissionDenied ? (
                    <div className="bg-white/80 dark:bg-black/30 p-4 rounded-full mb-6">
                        <MapPin className={`w-16 h-16 ${styles.icon}`} />
                    </div>
                ) : (
                    <XCircle className={`w-24 h-24 mb-6 ${styles.icon}`} />
                )}
                
                <h2 className={`text-3xl font-bold mb-2 ${styles.title}`}>{permissionDenied ? 'Permission Blocked' : 'Failed'}</h2>
                <p className={`text-lg mb-6 ${styles.text}`}>
                    {permissionDenied 
                        ? 'Your browser denied location access.' 
                        : message}
                </p>
                
                {permissionDenied && (
                    <div className="bg-white dark:bg-black/20 rounded-xl p-5 mb-8 text-left border border-red-200 dark:border-white/10 shadow-sm w-full">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            How to fix this:
                        </h4>
                        <ul className="list-disc pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <li>Check browser address bar settings (Aa or Lock icon).</li>
                            <li>Ensure Location is set to <strong>Ask</strong> or <strong>Allow</strong>.</li>
                            <li>If "Ask" is set, tap Retry below and look for a popup.</li>
                        </ul>
                    </div>
                )}

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
