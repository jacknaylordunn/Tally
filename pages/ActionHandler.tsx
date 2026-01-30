
import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifyToken } from '../services/api';
import { CheckCircle, XCircle, Loader2, RefreshCw, Home, MapPin, Settings, AlertTriangle, Navigation, Signal } from 'lucide-react';
import { UserRole } from '../types';

export const ActionHandler = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying...');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [detailedError, setDetailedError] = useState('');

  // Extract query params once
  const searchParams = new URLSearchParams(location.search);
  const type = searchParams.get('type') as 'kiosk' | 'static' | null;
  const token = searchParams.get('t');
  const locId = searchParams.get('lid');

  // Logic for Kiosk (Automatic)
  const processKioskScan = useCallback(async () => {
      setStatus('loading');
      setMessage('Processing Kiosk Scan...');
      
      const result = await verifyToken(token || '', user!.id, 'kiosk');
      
      handleResult(result);
  }, [token, user]);

  // Logic for Static (Manual Trigger required for GPS)
  const handleLocationClick = () => {
      // Direct call immediately upon user interaction
      setStatus('loading');
      setMessage('Requesting Location Access...');
      setPermissionDenied(false);
      setDetailedError('');

      // Attempt 1: High Accuracy
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              // Success High Accuracy
              handleLocationSuccess(pos);
          },
          (err) => {
              console.warn("High accuracy failed (" + err.code + "). Trying low accuracy...");
              if (err.code === 1) {
                  // Permission denied immediately
                  handleLocationError(err);
              } else {
                  // Fallback: Low Accuracy / Cached
                  setMessage('Acquiring approximate location...');
                  navigator.geolocation.getCurrentPosition(
                      (posLow) => {
                          handleLocationSuccess(posLow);
                      },
                      (errLow) => {
                          handleLocationError(errLow);
                      },
                      { 
                          enableHighAccuracy: false, 
                          timeout: 15000, 
                          maximumAge: 300000 // Accept 5 min old cache
                      }
                  );
              }
          },
          { 
              enableHighAccuracy: true, 
              timeout: 10000, 
              maximumAge: 0 
          }
      );
  };

  const handleLocationSuccess = async (pos: GeolocationPosition) => {
      setMessage('Verifying Location...');
      
      if (pos.coords.accuracy > 2000) {
          console.warn("Low GPS accuracy:", pos.coords.accuracy);
      }

      const locationData = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        locationId: locId || ''
      };

      const result = await verifyToken(token || '', user!.id, 'static', locationData);
      handleResult(result);
  };

  const handleLocationError = (error: GeolocationPositionError) => {
      console.error("GPS Error Final:", error);
      setStatus('error');
      
      if (error.code === 1) { // PERMISSION_DENIED
          setPermissionDenied(true);
          setMessage('Browser Blocked Location');
          setDetailedError('User denied Geolocation or Safari blocked it.');
      }
      else if (error.code === 2) { // POSITION_UNAVAILABLE
          setMessage('Location Unavailable');
          setDetailedError('GPS signal lost or Location Services disabled in OS.');
      }
      else if (error.code === 3) { // TIMEOUT
          setMessage('Location Timeout');
          setDetailedError('Could not get a lock in time. Try moving outside.');
      }
      else {
          setMessage('Location Error');
          setDetailedError(error.message || 'Unknown error');
      }
  };

  const handleResult = (result: { success: boolean, message: string }) => {
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
  };

  useEffect(() => {
    if (!authLoading) {
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

        if (type === 'static') {
            // Wait for user input
            setStatus('idle');
        } else {
            // Auto-run for kiosk
            processKioskScan();
        }
    }
  }, [authLoading, isAuthenticated, type, token, locId, navigate]);

  // UI Helpers
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
        
        {status === 'idle' && (
            <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <MapPin className={`w-12 h-12 ${styles.icon}`} />
                </div>
                <h2 className={`text-2xl font-bold mb-2 ${styles.title}`}>Location Check</h2>
                <p className={`mb-8 ${styles.text}`}>We need to verify you are on site.</p>
                
                <button 
                    onClick={handleLocationClick}
                    className="w-full max-w-xs bg-brand-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-brand-500/30 hover:bg-brand-700 transition flex items-center justify-center space-x-2"
                >
                    <Navigation className="w-5 h-5" />
                    <span>Verify location</span>
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
                
                <h2 className={`text-3xl font-bold mb-2 ${styles.title}`}>{permissionDenied ? 'Access Denied' : 'Verification Failed'}</h2>
                <p className={`text-lg mb-2 ${styles.text}`}>
                    {message}
                </p>
                {detailedError && (
                    <p className="text-xs font-mono bg-black/10 dark:bg-white/10 px-2 py-1 rounded mb-6">{detailedError}</p>
                )}
                
                {permissionDenied && (
                    <div className="bg-white dark:bg-black/20 rounded-xl p-5 mb-8 text-left border border-red-200 dark:border-white/10 shadow-sm w-full">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            To enable location:
                        </h4>
                        <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <li>Check iPhone Settings &gt; Privacy &gt; Location Services is <strong>ON</strong>.</li>
                            <li>Check Safari Websites &gt; Location is <strong>Ask</strong> or <strong>Allow</strong>.</li>
                            <li>If prompted, tap <strong>Allow</strong>.</li>
                            <li className="font-bold">Finally, tap 'Reload Page' below.</li>
                        </ol>
                    </div>
                )}

                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <button 
                        onClick={() => window.location.reload()}
                        className="bg-white dark:bg-black/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-red-50 dark:hover:bg-black/30 transition flex items-center justify-center space-x-2"
                    >
                        <RefreshCw className="w-5 h-5" />
                        <span>Reload Page</span>
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
