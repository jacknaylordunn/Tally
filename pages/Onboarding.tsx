
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole, Company, Location } from '../types';
import { useNavigate } from 'react-router-dom';
import { MapPin, Camera, Lock, CheckCircle, Copy, Check, DollarSign, Loader2, Navigation, Share2, CalendarDays, Calendar, User, Percent, Clock, Eye, EyeOff } from 'lucide-react';
import { updateCompanySettings, getCompany, createLocation } from '../services/api';
import { LocationMap } from '../components/LocationMap';
import { APP_NAME } from '../constants';

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
  const [holidayPayEnabled, setHolidayPayEnabled] = useState(false);
  const [holidayPayRate, setHolidayPayRate] = useState('12.07');
  const [showStaffEarnings, setShowStaffEarnings] = useState(true);

  // Step 3: Security & Features
  const [requireApproval, setRequireApproval] = useState(false);
  
  // Rota Settings (Sub-settings of Step 3)
  const [enableRota, setEnableRota] = useState(false);
  const [allowBidding, setAllowBidding] = useState(true);
  const [requireTimeOffApproval, setRequireTimeOffApproval] = useState(true);
  const [rotaShowFinishTimes, setRotaShowFinishTimes] = useState(true);
  const [blockEarlyClockIn, setBlockEarlyClockIn] = useState(false);
  
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

  // Optimize map updates to prevent re-renders when typing
  const handleLocationSelect = useCallback((newLat: number, newLng: number) => {
      setLat(newLat);
      setLng(newLng);
  }, []);

  if (!user) {
      // Don't redirect immediately to avoid flicker, just return null 
      // The ProtectedRoute or AuthContext will handle auth flow
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
              currency: currency,
              holidayPayEnabled,
              holidayPayRate: parseFloat(holidayPayRate),
              showStaffEarnings
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
               requireApproval: requireApproval,
               rotaEnabled: enableRota,
               // Only save rota sub-settings if enabled, otherwise they are ignored by logic
               rotaShowFinishTimes: enableRota ? rotaShowFinishTimes : undefined,
               allowShiftBidding: enableRota ? allowBidding : undefined,
               requireTimeOffApproval: enableRota ? requireTimeOffApproval : undefined,
               blockEarlyClockIn: enableRota ? blockEarlyClockIn : undefined
           });
           setStep(4);
       } catch (e) {
           console.error(e);
       } finally {
           setLoading(false);
       }
  };

  // --- STAFF HANDLERS ---

  const copyCode = () => {
      if (company?.code) {
          navigator.clipboard.writeText(company.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const shareCode = async () => {
        if (!company?.code) return;
        const text = `Hey, we are now using ${APP_NAME} for our clock-in system... ⏰\n\nPlease create an account at https://tallyd.app/#/register using ${company.code} as your invite code.\n\n#TallydUp`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join ${company.name} on ${APP_NAME}`,
                    text: text,
                });
            } catch (err) {
                console.error("Share failed", err);
            }
        } else {
            copyCode();
            alert("Sharing not supported on this device. Code copied to clipboard.");
        }
  };

  // --- RENDER HELPERS ---

  const renderAdminFlow = () => (
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
                                onLocationSelect={handleLocationSelect}
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

                    <div className="h-px bg-slate-200 dark:bg-slate-700"></div>

                    {/* Staff Earnings Toggle */}
                    <div className="flex items-center justify-between text-left">
                        <div className="pr-4">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                {showStaffEarnings ? <Eye className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                                Staff View Earnings
                            </h4>
                            <p className="text-xs text-slate-500">Allow staff to see estimated pay in their dashboard.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input type="checkbox" checked={showStaffEarnings} onChange={(e) => setShowStaffEarnings(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                        </label>
                    </div>

                    {/* Holiday Pay Toggle */}
                    <div className="flex items-center justify-between text-left">
                         <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Calculate Holiday Pay</h4>
                            <p className="text-xs text-slate-500">Automatically calculate holiday accrual in exports.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input type="checkbox" checked={holidayPayEnabled} onChange={(e) => setHolidayPayEnabled(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                        </label>
                    </div>

                    {/* Holiday Pay Rate Input (Conditional) */}
                    {holidayPayEnabled && (
                        <div className="text-left animate-in fade-in slide-in-from-top-2">
                             <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Holiday Pay Rate (%)</label>
                             <div className="relative">
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={holidayPayRate}
                                    onChange={(e) => setHolidayPayRate(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none font-bold"
                                    placeholder="12.07"
                                />
                                <Percent className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            </div>
                            <p className="text-xs text-slate-400 mt-2">12.07% is standard for UK casual workers.</p>
                        </div>
                    )}
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

        {/* STEP 3: SECURITY & FEATURES (With Rota Config) */}
        {step === 3 && (
            <div className="space-y-6">
                <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Features & Security</h2>
                    <p className="text-slate-500">Configure how your team uses Tally.</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border border-slate-100 dark:border-slate-700 space-y-6">
                    
                    {/* Approval Toggle */}
                    <div className="flex items-center justify-between">
                         <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">Require Admin Approval</h4>
                            <p className="text-xs text-slate-500">New staff must be approved before they can clock in.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                        </label>
                    </div>

                    <div className="h-px bg-slate-200 dark:bg-slate-700"></div>

                    {/* Rota Toggle */}
                     <div className="flex items-center justify-between">
                         <div className="flex items-start space-x-3">
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                <CalendarDays className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-white">Enable Rota System</h4>
                                <p className="text-xs text-slate-500">Plan shifts and manage staff time off. Optional.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input type="checkbox" checked={enableRota} onChange={(e) => setEnableRota(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                        </label>
                    </div>

                    {/* Rota Sub-Settings (Conditional) */}
                    {enableRota && (
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-4 space-y-4 border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Show Finish Times</span>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input type="checkbox" checked={rotaShowFinishTimes} onChange={(e) => setRotaShowFinishTimes(e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Allow Shift Bidding</span>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input type="checkbox" checked={allowBidding} onChange={(e) => setAllowBidding(e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Approval for Time Off</span>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input type="checkbox" checked={requireTimeOffApproval} onChange={(e) => setRequireTimeOffApproval(e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
                                <div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 block">Block Early Clock In</span>
                                    <span className="text-xs text-slate-500">Prevent check-in before "Early In" threshold.</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input type="checkbox" checked={blockEarlyClockIn} onChange={(e) => setBlockEarlyClockIn(e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                        </div>
                    )}

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

                {/* Improved Code Card Layout for Mobile */}
                <div className="bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8 rounded-2xl relative overflow-hidden group hover:border-brand-500 transition-colors flex flex-col md:block">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 md:mb-2 text-center md:text-left">Company Invite Code</p>
                    
                    <div className="flex flex-col md:flex-row items-center justify-center md:justify-start space-y-4 md:space-y-0">
                        <div className="text-5xl font-black tracking-wider text-slate-900 dark:text-white text-center md:text-left flex-1">
                            {company?.code}
                        </div>
                        
                        <div className="flex space-x-3 md:absolute md:top-4 md:right-4 w-full md:w-auto justify-center md:justify-end">
                            <button 
                                onClick={copyCode} 
                                className="flex-1 md:flex-none p-3 md:p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 hover:text-brand-600 rounded-xl transition flex items-center justify-center gap-2" 
                                title="Copy"
                            >
                                {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                                <span className="md:hidden text-sm font-bold">Copy</span>
                            </button>
                            <button 
                                onClick={shareCode} 
                                className="flex-1 md:flex-none p-3 md:p-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 hover:text-brand-600 rounded-xl transition flex items-center justify-center gap-2" 
                                title="Share"
                            >
                                <Share2 className="w-5 h-5" />
                                <span className="md:hidden text-sm font-bold">Share</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <button onClick={shareCode} className="w-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 py-4 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition flex items-center justify-center space-x-2">
                        <Share2 className="w-5 h-5" />
                        <span>Share Invite Code</span>
                    </button>
                    
                    <button onClick={handleFinish} className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-xl font-bold hover:opacity-90 transition shadow-lg">
                        Go to Dashboard
                    </button>
                </div>
            </div>
        )}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
        {user.role === UserRole.ADMIN ? renderAdminFlow() : (
            // STAFF ONBOARDING FLOW
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center space-y-6">
                <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">You're all set!</h2>
                <p className="text-slate-500 dark:text-slate-400">
                    You have joined {company?.name || 'the team'}.
                    {company?.settings.requireApproval && " Your account is pending approval by an admin."}
                </p>
                <button onClick={handleFinish} className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition">
                    Go to Dashboard
                </button>
            </div>
        )}
    </div>
  );
};
