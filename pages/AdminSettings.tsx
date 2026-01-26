
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getCompany, updateCompanySettings, updateCompany, deleteCompanyFull, updateUserProfile, updateAllLocationsRadius, getLocations } from '../services/api';
import { Company } from '../types';
import { Copy, Save, Building, Shield, Check, Palette, DollarSign, Image, Globe, Trash2, AlertOctagon, Share2, Percent, CalendarDays, AlertTriangle, User, Sun, Moon, Laptop, Eye, EyeOff, FileText, TableProperties } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, useBlocker } from 'react-router-dom';
import { APP_NAME } from '../constants';

export const AdminSettings = () => {
  const { user, refreshSession } = useAuth();
  const { theme, setTheme, setBrandColor } = useTheme();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const isSavingRef = useRef(false);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [personalName, setPersonalName] = useState('');
  
  const [radius, setRadius] = useState(200);
  const [updateExistingLocs, setUpdateExistingLocs] = useState(false);
  const [locationCount, setLocationCount] = useState(0);

  const [requireApproval, setRequireApproval] = useState(false);
  const [defaultRate, setDefaultRate] = useState(15);
  const [currency, setCurrency] = useState('£');
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9');
  const [logoUrl, setLogoUrl] = useState('');
  const [showStaffEarnings, setShowStaffEarnings] = useState(true);
  
  // Export Settings
  const [exportShowTimesWeekly, setExportShowTimesWeekly] = useState(true);
  const [exportShowTimesMonthly, setExportShowTimesMonthly] = useState(false);
  const [exportIncludeDeductions, setExportIncludeDeductions] = useState(false);

  // Holiday Pay
  const [holidayPayEnabled, setHolidayPayEnabled] = useState(false);
  const [holidayPayRate, setHolidayPayRate] = useState(12.07);

  // Rota Settings
  const [rotaEnabled, setRotaEnabled] = useState(false);
  const [rotaShowFinishTimes, setRotaShowFinishTimes] = useState(true);
  const [allowShiftBidding, setAllowShiftBidding] = useState(true);
  const [requireTimeOffApproval, setRequireTimeOffApproval] = useState(true);

  // Audit Settings
  const [auditLateIn, setAuditLateIn] = useState(15);
  const [auditEarlyIn, setAuditEarlyIn] = useState(30); // New default
  const [auditEarlyOut, setAuditEarlyOut] = useState(15);
  const [auditLateOut, setAuditLateOut] = useState(15);
  const [auditShortShift, setAuditShortShift] = useState(5);
  const [auditLongShift, setAuditLongShift] = useState(14);

  useEffect(() => {
    const loadData = async () => {
        if (!user || !user.currentCompanyId) return;
        const [data, locs] = await Promise.all([
            getCompany(user.currentCompanyId),
            getLocations(user.currentCompanyId)
        ]);
        setCompany(data);
        setLocationCount(locs.length);
        
        // Identity
        setCompanyName(data.name);
        setPersonalName(user.name);

        setRadius(data.settings.geofenceRadius);
        setRequireApproval(data.settings.requireApproval || false);
        setDefaultRate(data.settings.defaultHourlyRate || 15);
        setCurrency(data.settings.currency || '£');
        setPrimaryColor(data.settings.primaryColor || '#0ea5e9');
        setLogoUrl(data.settings.logoUrl || '');
        setShowStaffEarnings(data.settings.showStaffEarnings !== false);
        setHolidayPayEnabled(data.settings.holidayPayEnabled || false);
        setHolidayPayRate(data.settings.holidayPayRate || 12.07);
        
        // Export
        setExportShowTimesWeekly(data.settings.exportShowShiftTimesWeekly !== false); // default true
        setExportShowTimesMonthly(data.settings.exportShowShiftTimesMonthly || false);
        setExportIncludeDeductions(data.settings.exportIncludeDeductions || false);

        // Rota
        setRotaEnabled(data.settings.rotaEnabled || false);
        setRotaShowFinishTimes(data.settings.rotaShowFinishTimes !== undefined ? data.settings.rotaShowFinishTimes : true);
        setAllowShiftBidding(data.settings.allowShiftBidding !== undefined ? data.settings.allowShiftBidding : true);
        setRequireTimeOffApproval(data.settings.requireTimeOffApproval !== undefined ? data.settings.requireTimeOffApproval : true);
        
        // Audit
        setAuditLateIn(data.settings.auditLateInThreshold || 15);
        setAuditEarlyIn(data.settings.auditEarlyInThreshold || 30);
        setAuditEarlyOut(data.settings.auditEarlyOutThreshold || 15);
        setAuditLateOut(data.settings.auditLateOutThreshold || 15);
        setAuditShortShift(data.settings.auditShortShiftThreshold || 5);
        setAuditLongShift(data.settings.auditLongShiftThreshold || 14);

        setLoading(false);
    };
    loadData();
  }, [user]);

  // Dirty Check Logic
  const isDirty = useMemo(() => {
      if (!company || !user) return false;
      const s = company.settings;
      const clean = (val: any, def: any) => val ?? def;

      return (
          companyName !== company.name ||
          personalName !== user.name ||
          radius !== s.geofenceRadius ||
          updateExistingLocs || // consider dirty if checkbox is ticked
          requireApproval !== (s.requireApproval || false) ||
          defaultRate !== (s.defaultHourlyRate || 15) ||
          currency !== (s.currency || '£') ||
          primaryColor !== (s.primaryColor || '#0ea5e9') ||
          logoUrl !== (s.logoUrl || '') ||
          showStaffEarnings !== clean(s.showStaffEarnings, true) ||
          holidayPayEnabled !== (s.holidayPayEnabled || false) ||
          holidayPayRate !== (s.holidayPayRate || 12.07) ||
          exportShowTimesWeekly !== clean(s.exportShowShiftTimesWeekly, true) ||
          exportShowTimesMonthly !== (s.exportShowShiftTimesMonthly || false) ||
          exportIncludeDeductions !== (s.exportIncludeDeductions || false) ||
          rotaEnabled !== (s.rotaEnabled || false) ||
          rotaShowFinishTimes !== clean(s.rotaShowFinishTimes, true) ||
          allowShiftBidding !== clean(s.allowShiftBidding, true) ||
          requireTimeOffApproval !== clean(s.requireTimeOffApproval, true) ||
          auditLateIn !== (s.auditLateInThreshold || 15) ||
          auditEarlyIn !== (s.auditEarlyInThreshold || 30) ||
          auditEarlyOut !== (s.auditEarlyOutThreshold || 15) ||
          auditLateOut !== (s.auditLateOutThreshold || 15) ||
          auditShortShift !== (s.auditShortShiftThreshold || 5) ||
          auditLongShift !== (s.auditLongShiftThreshold || 14)
      );
  }, [
      company, user, companyName, personalName, radius, requireApproval, defaultRate, currency, primaryColor, logoUrl, showStaffEarnings,
      holidayPayEnabled, holidayPayRate, exportShowTimesWeekly, exportShowTimesMonthly, exportIncludeDeductions, rotaEnabled, rotaShowFinishTimes, allowShiftBidding, requireTimeOffApproval,
      auditLateIn, auditEarlyIn, auditEarlyOut, auditLateOut, auditShortShift, auditLongShift, updateExistingLocs
  ]);

  // Prevent Navigation if Dirty
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname && !isSavingRef.current
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
        const proceed = window.confirm("You have unsaved changes. Do you really want to leave?");
        if (proceed) {
            blocker.proceed();
        } else {
            blocker.reset();
        }
    }
  }, [blocker]);

  // Prevent Browser Tab Close/Refresh if Dirty
  useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
          if (isDirty && !isSavingRef.current) {
              e.preventDefault();
              e.returnValue = ''; // Legacy standard
          }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleCopyCode = () => {
      if (company?.code) {
          navigator.clipboard.writeText(company.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const handleShareCode = async () => {
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
            handleCopyCode();
            alert("Sharing not supported on this device. Code copied to clipboard.");
        }
  };

  const handleSave = async () => {
      if (!user?.currentCompanyId) return;
      isSavingRef.current = true; // Bypass blockers
      setSaving(true);
      
      try {
          // Update Company Details
          await updateCompany(user.currentCompanyId, {
              name: companyName
          });

          // Update Settings
          await updateCompanySettings(user.currentCompanyId, {
              geofenceRadius: radius,
              requireApproval,
              defaultHourlyRate: defaultRate,
              currency: currency,
              primaryColor,
              logoUrl,
              showStaffEarnings,
              holidayPayEnabled,
              holidayPayRate,
              exportShowShiftTimesWeekly: exportShowTimesWeekly,
              exportShowShiftTimesMonthly: exportShowTimesMonthly,
              exportIncludeDeductions: exportIncludeDeductions,
              rotaEnabled,
              rotaShowFinishTimes,
              allowShiftBidding,
              requireTimeOffApproval,
              auditLateInThreshold: auditLateIn,
              auditEarlyInThreshold: auditEarlyIn,
              auditEarlyOutThreshold: auditEarlyOut,
              auditLateOutThreshold: auditLateOut,
              auditShortShiftThreshold: auditShortShift,
              auditLongShiftThreshold: auditLongShift
          });

          // Handle Batch Location Update
          if (updateExistingLocs) {
              await updateAllLocationsRadius(user.currentCompanyId, radius);
          }

          // Update User Details
          if (user.name !== personalName) {
              await updateUserProfile(user.id, { name: personalName });
              await refreshSession();
          }
          
          // Update global theme immediately
          setBrandColor(primaryColor);
          
          setSaving(false);
          // Reload to reflect all changes nicely
          window.location.reload(); 
      } catch (e) {
          console.error(e);
          alert("Error saving settings.");
          setSaving(false);
          isSavingRef.current = false;
      }
  };

  const handleDeleteCompany = async () => {
      if (!user?.currentCompanyId) return;
      const confirmName = prompt(`To confirm deletion, please type the company name: ${company?.name}`);
      if (confirmName === company?.name) {
          try {
              isSavingRef.current = true; // Bypass blockers
              await deleteCompanyFull(user.currentCompanyId);
              alert("Company deleted successfully.");
              window.location.reload();
          } catch (e) {
              console.error(e);
              alert("Failed to delete company.");
              isSavingRef.current = false;
          }
      }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setPrimaryColor(e.target.value);
  };

  if (loading) return <div className="p-8 text-center flex justify-center"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column code remains unchanged */}
            <div className="space-y-6">
                <div 
                    className="rounded-2xl p-8 text-white relative overflow-hidden shadow-lg transition-all duration-500"
                    style={{ backgroundColor: primaryColor }}
                >
                    <div className="relative z-10">
                        <h2 className="text-white/80 font-medium mb-1 uppercase tracking-wider text-xs">Company Invite Code</h2>
                        <div className="flex items-center space-x-2">
                            <span className="text-4xl font-bold tracking-widest">{company?.code}</span>
                            <div className="flex space-x-1">
                                <button onClick={handleCopyCode} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition backdrop-blur-sm">
                                    {copied ? <Check className="w-5 h-5 text-emerald-300" /> : <Copy className="w-5 h-5" />}
                                </button>
                                <button onClick={handleShareCode} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition backdrop-blur-sm">
                                    <Share2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <p className="mt-4 text-white/80 text-sm">Share this code with your staff.</p>
                    </div>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-20 rounded-full -translate-y-1/2 translate-x-1/4"></div>
                </div>

                <div className="space-y-2">
                    {isDirty && (
                        <div className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-lg text-sm font-medium text-center border border-amber-200 dark:border-amber-900/30">Unsaved changes</div>
                    )}
                    <button onClick={handleSave} disabled={saving} className={`w-full flex items-center justify-center space-x-2 px-6 py-4 rounded-xl font-bold transition disabled:opacity-70 shadow-lg ${isDirty ? 'bg-brand-600 hover:bg-brand-700 text-white animate-pulse' : 'glass-panel hover:bg-white/10 text-slate-900 dark:text-white'}`}>
                        <Save className="w-5 h-5" />
                        <span>{saving ? 'Saving...' : (isDirty ? 'Save Changes' : 'Save All Changes')}</span>
                    </button>
                </div>
            </div>

            {/* Right Column: Settings Forms */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Identity */}
                <div className="glass-panel rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-white/10">
                    <div className="flex items-center space-x-3 pb-4 border-b border-slate-200 dark:border-white/10 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 dark:text-slate-400"><User className="w-5 h-5" /></div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Identity</h3>
                    </div>
                    <div className="space-y-4">
                        <div><label className="block text-sm font-medium mb-2">Company Name</label><input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" /></div>
                        <div><label className="block text-sm font-medium mb-2">Your Full Name</label><input type="text" value={personalName} onChange={(e) => setPersonalName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" /></div>
                    </div>
                </div>

                {/* Branding & Appearance */}
                <div className="glass-panel rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-white/10">
                    <div className="flex items-center space-x-3 pb-4 border-b border-slate-200 dark:border-white/10 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 dark:text-slate-400">
                            <Palette className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Branding & Appearance</h3>
                    </div>
                    
                    <div className="space-y-6">
                        {/* Theme Toggle */}
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Interface Theme</span>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                <button 
                                    onClick={() => setTheme('light')}
                                    className={`p-2 rounded-md transition ${theme === 'light' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                    title="Light Mode"
                                >
                                    <Sun className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setTheme('dark')}
                                    className={`p-2 rounded-md transition ${theme === 'dark' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                    title="Dark Mode"
                                >
                                    <Moon className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setTheme('system')}
                                    className={`p-2 rounded-md transition ${theme === 'system' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                                    title="System Default"
                                >
                                    <Laptop className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Brand Color */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Brand Color</label>
                            <div className="flex items-center space-x-3">
                                <input 
                                    type="color" 
                                    value={primaryColor}
                                    onChange={handleColorChange}
                                    className="h-10 w-14 rounded cursor-pointer bg-transparent"
                                />
                                <input 
                                    type="text" 
                                    value={primaryColor} 
                                    onChange={handleColorChange}
                                    className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none uppercase font-mono" 
                                />
                            </div>
                        </div>

                        {/* Logo URL */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Logo URL</label>
                            <div className="flex items-center space-x-3">
                                <div className="relative flex-1">
                                    <Image className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="url" 
                                        value={logoUrl} 
                                        onChange={(e) => setLogoUrl(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" 
                                        placeholder="https://example.com/logo.png"
                                    />
                                </div>
                                {logoUrl && (
                                    <div className="h-10 w-10 bg-white rounded-lg border border-slate-200 p-1 flex items-center justify-center">
                                        <img src={logoUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Direct link to image (PNG/JPG).</p>
                        </div>
                    </div>
                </div>

                {/* Payroll & Localization - UPDATED */}
                <div className="glass-panel rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-white/10">
                    <div className="flex items-center space-x-3 pb-4 border-b border-slate-200 dark:border-white/10 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 dark:text-slate-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Payroll & Currency</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Currency
                            </label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <select 
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none transition-colors"
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
                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Default Hourly Rate
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency}</span>
                                <input 
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={defaultRate}
                                    onChange={(e) => setDefaultRate(parseFloat(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-colors"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Applied to new staff automatically.</p>
                        </div>
                    </div>

                    <div className="mt-4 border-t border-slate-200 dark:border-white/10 pt-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="pr-4">
                                <h4 className="font-medium text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                    {showStaffEarnings ? <Eye className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                                    Staff View Earnings
                                </h4>
                                <p className="text-xs text-slate-500">Allow staff to see their estimated pay in the app.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                <input type="checkbox" checked={showStaffEarnings} onChange={(e) => setShowStaffEarnings(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                            </label>
                        </div>

                        {/* Export Settings */}
                        <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-white/5">
                            <h4 className="font-bold text-xs uppercase text-slate-500 mb-2 flex items-center gap-2"><FileText className="w-3 h-3" /> Export Customization</h4>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 dark:text-slate-300">Show Times in Weekly Matrix</span>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input type="checkbox" checked={exportShowTimesWeekly} onChange={(e) => setExportShowTimesWeekly(e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                            
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-700 dark:text-slate-300">Show Times in Monthly Matrix</span>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input type="checkbox" checked={exportShowTimesMonthly} onChange={(e) => setExportShowTimesMonthly(e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="pr-4">
                                    <span className="text-sm text-slate-700 dark:text-slate-300">Include Payroll Deduction Columns</span>
                                    <p className="text-[10px] text-slate-500">Adds empty columns for Tax, NI, and Net Pay to the Matrix export for your accountant.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                    <input type="checkbox" checked={exportIncludeDeductions} onChange={(e) => setExportIncludeDeductions(e.target.checked)} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                        </div>

                        {/* Holiday Pay Toggle */}
                        <div className="flex items-center justify-between">
                            <div className="pr-4">
                                <h4 className="font-medium text-slate-900 dark:text-white text-sm">Calculate Holiday Pay</h4>
                                <p className="text-xs text-slate-500">Automatically calculate holiday accrual in exports.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                <input type="checkbox" checked={holidayPayEnabled} onChange={(e) => setHolidayPayEnabled(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                            </label>
                        </div>
                        
                        {holidayPayEnabled && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Holiday Pay Rate (%)
                                </label>
                                <div className="relative">
                                    <input 
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={holidayPayRate}
                                        onChange={(e) => setHolidayPayRate(parseFloat(e.target.value))}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none transition-colors"
                                        placeholder="12.07"
                                    />
                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">12.07% is standard for UK casual workers.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-panel rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-white/10">
                    <div className="flex items-center space-x-3 pb-4 border-b border-slate-200 dark:border-white/10 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 dark:text-slate-400"><Building className="w-5 h-5" /></div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">General & Security</h3>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">GPS Geofence Radius (meters)</label>
                            <input type="number" min="20" value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" />
                            {locationCount > 0 && (
                                <div className="flex items-center mt-2 animate-fade-in">
                                    <input 
                                        type="checkbox" 
                                        id="update-locs"
                                        checked={updateExistingLocs}
                                        onChange={(e) => setUpdateExistingLocs(e.target.checked)}
                                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                    />
                                    <label htmlFor="update-locs" className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                                        Update radius for all {locationCount} existing locations?
                                    </label>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <div className="pr-4"><h4 className="font-medium text-sm">Require Admin Approval</h4><p className="text-xs text-slate-500">New staff must be approved.</p></div>
                            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                                <input type="checkbox" checked={requireApproval} onChange={(e) => setRequireApproval(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="glass-panel rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-white/10">
                    <div className="flex items-center space-x-3 pb-4 border-b border-slate-200 dark:border-white/10 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 dark:text-slate-400"><AlertTriangle className="w-5 h-5" /></div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Attendance Auditing</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Early In (mins)</label><input type="number" min="0" value={auditEarlyIn} onChange={(e) => setAuditEarlyIn(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" /></div>
                        <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Late In (mins)</label><input type="number" min="0" value={auditLateIn} onChange={(e) => setAuditLateIn(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" /></div>
                        <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Early Out (mins)</label><input type="number" min="0" value={auditEarlyOut} onChange={(e) => setAuditEarlyOut(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" /></div>
                        <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Late Out (mins)</label><input type="number" min="0" value={auditLateOut} onChange={(e) => setAuditLateOut(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" /></div>
                        <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Short Shift (mins)</label><input type="number" min="0" value={auditShortShift} onChange={(e) => setAuditShortShift(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" /></div>
                        <div><label className="block text-xs font-bold uppercase text-slate-500 mb-2">Long Shift (hrs)</label><input type="number" min="0" value={auditLongShift} onChange={(e) => setAuditLongShift(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" /></div>
                    </div>
                </div>

                <div className="glass-panel rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-white/10">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10 mb-4">
                        <div className="flex items-center space-x-3">
                             <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-500 dark:text-slate-400"><CalendarDays className="w-5 h-5" /></div>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Rota System</h3>
                        </div>
                         <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input type="checkbox" checked={rotaEnabled} onChange={(e) => setRotaEnabled(e.target.checked)} className="sr-only peer" />
                            <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                        </label>
                    </div>
                    {rotaEnabled && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center justify-between"><span className="text-sm font-medium">Show Finish Times</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={rotaShowFinishTimes} onChange={(e) => setRotaShowFinishTimes(e.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div></label></div>
                             <div className="flex items-center justify-between"><span className="text-sm font-medium">Allow Shift Bidding</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={allowShiftBidding} onChange={(e) => setAllowShiftBidding(e.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div></label></div>
                             <div className="flex items-center justify-between"><span className="text-sm font-medium">Approval for Time Off</span><label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={requireTimeOffApproval} onChange={(e) => setRequireTimeOffApproval(e.target.checked)} className="sr-only peer" /><div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div></label></div>
                        </div>
                    )}
                </div>

                <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-200 dark:border-red-900/30">
                    <div className="flex items-center space-x-3 pb-4 border-b border-red-200 dark:border-red-900/30 mb-4">
                        <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg text-red-500"><AlertOctagon className="w-5 h-5" /></div>
                        <h3 className="font-bold text-lg text-red-500 dark:text-red-400">Danger Zone</h3>
                    </div>
                    <div className="flex items-center justify-between">
                        <div><h4 className="font-bold text-red-500 dark:text-red-400">Delete Company</h4><p className="text-sm text-red-600/70 dark:text-red-400/70">Permanently delete organization.</p></div>
                        <button onClick={handleDeleteCompany} className="px-4 py-2 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800 rounded-lg font-bold text-sm transition">Delete Company</button>
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};
