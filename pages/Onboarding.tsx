
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Company, Location } from '../types';
import { useNavigate } from 'react-router-dom';
import { Building, ArrowRight, User, MapPin, Camera, Lock, CheckCircle, Copy, Check, DollarSign, Globe, Loader2, Navigation } from 'lucide-react';
import { updateCompanySettings, getCompany, createLocation } from '../services/api';
import { LocationMap } from '../components/LocationMap';

export const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState<Company | null>(null);

  // --- ADMIN STATE ---
  
  // Step 1: Location
  const [locName, setLocName] = useState('Head Office');
  const [lat, setLat] = useState<number>(51.5074); // Default London
  const [lng, setLng] = useState<number>(-0.1278);
  const [radius, setRadius] = useState(200);
  const [locLoading, setLocLoading] = useState(false);

  // Step 2: Payroll
  const [currency, setCurrency] = useState('£');
  const [hourlyRate, setHourlyRate] = useState('15.00');

  // Step 3: Security
  const [requireApproval, setRequireApproval] = useState(false);
  
  // Step 4: Invite
  const [copied, setCopied] = useState(false);

  // --- STAFF STATE ---
  const [cameraPerm, setCameraPerm] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [locationPerm, setLocationPerm] = useState<'pending' | 'granted' | 'denied'>('pending');

  useEffect(() => {
    const init = async () => {
        if (user?.currentCompanyId) {
            const c = await getCompany(user.currentCompanyId);
            setCompany(c);
        }
        
        // Auto-detect Currency preference based on Timezone
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz.includes('America')) setCurrency('$');
        else if (tz.includes('Europe') && !tz.includes('London')) setCurrency('€');
        else setCurrency('£'); // Default to GBP as requested
        
        // Attempt to get initial location for map
        navigator.geolocation.getCurrentPosition((pos) => {
            setLat(pos.coords.latitude);
            setLng(pos.coords.longitude);
        }, (err) => {
            console.log("Loc auto-detect failed, using default");
        });
    };
    init();
  }, [user]);

  if (!user) {
      navigate('/login');
      return null;
  }

  const handleFinish = () => {
    navigate(user.role === UserRole.ADMIN ? '/admin' : '/staff');
  };

  // --- ADMIN HANDLERS ---

  const handleUseCurrentLocation = () => {
      setLocLoading(true);
      navigator.geolocation.getCurrentPosition((pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setLocLoading(false);
      }, (err) => {
          alert("Could not retrieve location. Please check permissions.");
          setLocLoading(false);
      });
  };

  const handleAdminStep1_Location = async () => {
      if (!user.currentCompanyId || !locName) return;
      setLoading(true);
      try {
          // Create the first location
          const newLoc: Location = {
              id: `loc_${Date.now()}`,
              companyId: user.currentCompanyId,
              name: locName,
              lat: lat,
              lng: lng,
              radius: radius
          };
          await createLocation(newLoc);
          
          // Also save the radius to company settings as a default
          await updateCompanySettings(user.currentCompanyId, {
              geofenceRadius: radius
          });
          
          setStep(2);
      } catch (e) {
          console.error(e);
          alert("Failed to save location. Please try again.");
      } finally {
          setLoading(false);
      }
  };

  const handleAdminStep2_Payroll = async () => {
      if (!user.currentCompanyId) return;
      setLoading(true);
      try {
          await updateCompanySettings(user.currentCompanyId, {
              defaultHourlyRate: parseFloat(hourlyRate),
              currency: currency
          });
          setStep(3);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const handleAdminStep3_Security = async () => {
       if (!user.currentCompanyId) return;
       setLoading(true);
       try {
           await updateCompanySettings(user.currentCompanyId, {
               requireApproval: requireApproval
           });
           setStep(4);
       } catch (e) {
           console.error(e);
       } finally {
           setLoading(false);
       }
  };

  // --- STAFF HANDLERS ---

  const requestCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop()); 
          setCameraPerm('granted');
      } catch (e) {
          setCameraPerm('denied');
      }
  };

  const requestLocation = () => {
      navigator.geolocation.getCurrentPosition(
          () => setLocationPerm('granted'),
          () => setLocationPerm('denied')
      );
  };

  const copyCode = () => {
      if (company?.code) {
          navigator.clipboard.writeText(company.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const AdminFlow = () => (
    <div className="max-w-lg mx-auto animate-fade-in pb-8">
        {/* Step Indicator */}
        <div className="flex justify-center space-x-2 mb-8">
            {[1, 2, 3, 4].map(s => (
                <div key={s} className={`h-1.5 w-8 rounded-full transition-colors ${s <= step ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
            ))}
        </div>

        {/* STEP 1: LOCATION */}
        {step === 1 && (
            <div className="space-y-6">
                 <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Where is your team based?</h2>
                    <p className="text-slate-500">Add your first location to enable clock-ins.</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Location Name</label>
                        <input 
                            type="text"
                            value={locName}
                            onChange={(e) => setLocName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="e.g. Headquarters"
                        />
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-2">
                             <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Geofence Area</label>
                             <button 
                                onClick={handleUseCurrentLocation}
                                disabled={locLoading}
                                className="text-xs flex items-center space-x-1 text-brand-600 font-medium hover:underline disabled:opacity-50"
                             >
                                {locLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Navigation className="w-3 h-3" />}
                                <span>Use my location</span>
                             </button>
                        </div>
                        
                        <div className="h-48 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 mb-3 relative z-0">
                            <LocationMap 
                                lat={lat}
                                lng={lng}
                                radius={radius}
                                onLocationSelect={(newLat, newLng) => {
                                    setLat(newLat);
                                    setLng(newLng);
                                }}
                            />
                        </div>
                        <div className="flex items-center space-x-3">
                             <span className="text-xs font-bold text-slate-500">Radius: {radius}m</span>
                             <input 
                                type="range" min="50" max="1000" step="10"
                                value={radius}
                                onChange={(e) => setRadius(parseInt(e.target.value))}
                                className="flex-1 accent-brand-500 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                             />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleAdminStep1_Location} 
                    disabled={loading || !locName} 
                    className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Set Location & Continue</span>}
                </button>
            </div>
        )}

        {/* STEP 2: PAYROLL & CURRENCY */}
        {step === 2 && (
            <div className="space-y-6 text-center">
                 <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Payroll Basics</h2>
                <p className="text-slate-500">Set the default currency and pay rate for your staff.</p>
                
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1">
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Currency</label>
                             <div className="relative">
                                <select 
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="w-full appearance-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white py-3 px-4 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none font-bold text-center"
                                >
                                    <option value="£">GBP (£)</option>
                                    <option value="$">USD ($)</option>
                                    <option value="€">EUR (€)</option>
                                    <option value="¥">JPY (¥)</option>
                                    <option value="A$">AUD ($)</option>
                                    <option value="C$">CAD ($)</option>
                                </select>
                             </div>
                        </div>
                        <div className="col-span-2">
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Default Hourly Rate</label>
                             <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency}</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={hourlyRate}
                                    onChange={(e) => setHourlyRate(e.target.value)}
                                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none font-bold"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={handleAdminStep2_Payroll} 
                    disabled={loading} 
                    className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center space-x-2 disabled:opacity-70"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Continue</span>}
                </button>
            </div>
        )}

        {/* STEP 3: SECURITY */}
        {step === 3 && (
            <div className="space-y-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Final Security Checks</h2>
                    <p className="text-slate-500">Configure how your team accesses Tally.</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 space-y-6">
                    <div className="flex items-center justify-between">
                         <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">Require Admin Approval</h4>
                            <p className="text-xs text-slate-500">New staff must be approved before they can clock in.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                        </label>
                    </div>
                </div>

                 <button 
                    onClick={handleAdminStep3_Security} 
                    disabled={loading} 
                    className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center space-x-2 disabled:opacity-70"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Finish Setup</span>}
                </button>
            </div>
        )}

        {/* STEP 4: INVITE */}
        {step === 4 && (
            <div className="space-y-8 text-center">
                 <div className="w-16 h-16 bg-slate-900 text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl">
                    <User className="w-8 h-8" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invite your Team</h2>
                    <p className="text-slate-500">Share this code with your staff to get them started.</p>
                </div>

                <div className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-8 rounded-2xl relative overflow-hidden group cursor-pointer hover:border-brand-500 transition-colors" onClick={copyCode}>
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Company Invite Code</p>
                    <div className="text-5xl font-black tracking-wider flex items-center justify-center space-x-3 text-slate-900 dark:text-white">
                        <span>{company?.code}</span>
                    </div>
                    <div className="absolute top-4 right-4 text-slate-400 group-hover:text-brand-600 transition">
                        {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                    </div>
                    <div className="mt-4 text-xs text-brand-600 font-medium opacity-0 group-hover:opacity-100 transition">Tap to copy</div>
                </div>

                <button onClick={handleFinish} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-bold hover:opacity-90 transition shadow-lg">
                    Go to Dashboard
                </button>
            </div>
        )}
    </div>
  );

  const StaffFlow = () => (
     <div className="max-w-lg mx-auto animate-fade-in">
        {step === 1 && (
            <div className="space-y-6 text-center">
                 <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">You're In!</h2>
                <p className="text-slate-500 text-lg">
                    You have successfully joined <span className="font-bold text-slate-900 dark:text-white">{company?.name}</span>.
                </p>
                <button onClick={() => setStep(2)} className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 transition mt-8 shadow-lg shadow-brand-500/30">
                    Let's get set up
                </button>
            </div>
        )}

        {step === 2 && (
            <div className="space-y-6">
                <div className="text-center mb-8">
                     <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Permission Priming</h2>
                     <p className="text-slate-500">We need access to your Camera and Location to verify your attendance.</p>
                </div>

                <div className="space-y-4">
                    {/* Camera Button */}
                    <button 
                        onClick={requestCamera}
                        disabled={cameraPerm === 'granted'}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                            cameraPerm === 'granted' 
                            ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 dark:border-green-500' 
                            : 'border-slate-200 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500'
                        }`}
                    >
                        <div className="flex items-center space-x-4">
                            <div className={`p-2 rounded-lg ${cameraPerm === 'granted' ? 'bg-green-200 dark:bg-green-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                <Camera className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-slate-900 dark:text-white">Camera Access</h4>
                                <p className="text-xs text-slate-500">Used to scan QR codes</p>
                            </div>
                        </div>
                        {cameraPerm === 'granted' && <CheckCircle className="w-6 h-6" />}
                    </button>

                     {/* Location Button */}
                    <button 
                        onClick={requestLocation}
                        disabled={locationPerm === 'granted'}
                        className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                            locationPerm === 'granted' 
                            ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 dark:border-green-500' 
                            : 'border-slate-200 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500'
                        }`}
                    >
                         <div className="flex items-center space-x-4">
                            <div className={`p-2 rounded-lg ${locationPerm === 'granted' ? 'bg-green-200 dark:bg-green-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                <MapPin className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-bold text-slate-900 dark:text-white">Location Access</h4>
                                <p className="text-xs text-slate-500">Used for Static Site verification</p>
                            </div>
                        </div>
                        {locationPerm === 'granted' && <CheckCircle className="w-6 h-6" />}
                    </button>
                </div>

                <button 
                    onClick={handleFinish} 
                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-bold hover:opacity-90 transition mt-8 shadow-lg"
                >
                    Finish Setup
                </button>
                <p className="text-center text-xs text-slate-400 mt-4">You can change these in your browser settings later.</p>
            </div>
        )}
     </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl w-full max-w-2xl p-8 md:p-12 relative overflow-hidden border border-slate-100 dark:border-slate-700">
             {user.role === UserRole.ADMIN ? <AdminFlow /> : <StaffFlow />}
        </div>
    </div>
  );
};
