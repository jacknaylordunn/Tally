
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifyToken } from '../services/api';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { UserRole } from '../types';

export const ActionHandler = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying...');

  useEffect(() => {
    const handleScan = async () => {
      // 1. Auth Check (Bounce Logic)
      if (!isAuthenticated) {
        // Construct the full URL to store
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
        setMessage('Invalid QR Code.');
        return;
      }

      // 3. Location Check (for Static)
      let locationData = undefined;
      if (type === 'static') {
        try {
          setMessage('Checking location...');
          const pos: GeolocationPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
          });

          // Security: Check Accuracy
          if (pos.coords.accuracy > 500) {
              throw new Error("GPS signal too weak. Please move outdoors or near a window.");
          }

          locationData = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            locationId: locId || ''
          };
        } catch (e: any) {
          setStatus('error');
          setMessage(e.message || 'Location permission denied. Cannot verify static QR.');
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
        // Vibrate if possible
        if (navigator.vibrate) navigator.vibrate(200);
        
        // Redirect after delay
        setTimeout(() => {
             if (user?.role === UserRole.ADMIN) navigate('/admin');
             else navigate('/staff');
        }, 2000);
      } else {
        setStatus('error');
        setMessage(result.message);
      }
    };

    if (!authLoading) {
        if (isAuthenticated) {
            handleScan();
        } else {
             // Bounce Logic handled in useEffect above if not authenticated, 
             // but if we are here and not authenticated and not loading, we should redirect.
             const currentUrl = window.location.href;
             sessionStorage.setItem('pendingScan', currentUrl);
             navigate('/login');
        }
    }
  }, [isAuthenticated, authLoading, location.search, navigate, user]);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-500 ${
        status === 'success' ? 'bg-success text-white' : 
        status === 'error' ? 'bg-danger text-white' : 
        'bg-slate-900 text-white'
    }`}>
      <div className="max-w-md w-full">
        {status === 'loading' && (
            <div className="flex flex-col items-center">
                <Loader2 className="w-16 h-16 animate-spin mb-4 opacity-80" />
                <h2 className="text-2xl font-bold">{message}</h2>
            </div>
        )}

        {status === 'success' && (
            <div className="flex flex-col items-center animate-bounce-in">
                <CheckCircle className="w-24 h-24 mb-6" />
                <h2 className="text-4xl font-bold mb-2">Success!</h2>
                <p className="text-xl opacity-90">{message}</p>
            </div>
        )}

        {status === 'error' && (
            <div className="flex flex-col items-center">
                <XCircle className="w-24 h-24 mb-6" />
                <h2 className="text-3xl font-bold mb-2">Failed</h2>
                <p className="text-lg opacity-90">{message}</p>
                <button 
                    onClick={() => navigate('/staff')}
                    className="mt-8 bg-white text-danger px-6 py-2 rounded-full font-bold shadow-lg hover:bg-slate-100 transition"
                >
                    Go to Dashboard
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
