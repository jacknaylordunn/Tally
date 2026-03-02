
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { getCompany, updateCompanySettings, updateCompany, deleteCompanyFull, updateUserProfile, updateAllLocationsRadius, getLocations, uploadCompanyLogo } from '../services/api';
import { Company, VettingLevel } from '../types';
import { Copy, Save, Building, Shield, Check, Palette, DollarSign, Image, Globe, Trash2, AlertOctagon, Share2, Percent, CalendarDays, AlertTriangle, User, Sun, Moon, Laptop, Eye, EyeOff, FileText, TableProperties, Upload, FileCheck, Clock, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate, useBlocker } from 'react-router-dom';
import { APP_NAME } from '../constants';

type SettingsTab = 'general' | 'brand' | 'pay' | 'rota' | 'compliance' | 'danger';

export const AdminSettings = () => {
  const { user, refreshSession } = useAuth();
  const { theme, setTheme, setBrandColor } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
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
  
  // Logo
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  const [showStaffEarnings, setShowStaffEarnings] = useState(true);
  
  // Export Settings
  const [exportShowTimesWeekly, setExportShowTimesWeekly] = useState(true);
  const [exportShowTimesMonthly, setExportShowTimesMonthly] = useState(false);
  const [exportIncludeDeductions, setExportIncludeDeductions] = useState(false);

  // Holiday Pay
  const [holidayPayEnabled, setHolidayPayEnabled] = useState(false);
  const [holidayPayRate, setHolidayPayRate] = useState(12.07);

  // Break Settings
  const [breakType, setBreakType] = useState<'paid' | 'unpaid'>('unpaid');

  // Rota Settings
  const [rotaEnabled, setRotaEnabled] = useState(false);
  const [rotaShowFinishTimes, setRotaShowFinishTimes] = useState(true);
  const [allowShiftBidding, setAllowShiftBidding] = useState(true);
  const [requireTimeOffApproval, setRequireTimeOffApproval] = useState(true);

  // Vetting Settings
  const [vettingEnabled, setVettingEnabled] = useState(false);
  const [vettingLevel, setVettingLevel] = useState<VettingLevel>('BS7858');

  // Audit Settings
  const [auditLateIn, setAuditLateIn] = useState(15);
  const [auditEarlyIn, setAuditEarlyIn] = useState(30);
  const [auditEarlyOut, setAuditEarlyOut] = useState(15);
  const [auditLateOut, setAuditLateOut] = useState(15);
  const [auditShortShift, setAuditShortShift] = useState(5);
  const [auditLongShift, setAuditLongShift] = useState(14);
  const [blockEarlyClockIn, setBlockEarlyClockIn] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setBreakType(data.settings.breakType || 'unpaid');
        
        // Export
        setExportShowTimesWeekly(data.settings.exportShowShiftTimesWeekly !== false);
        setExportShowTimesMonthly(data.settings.exportShowShiftTimesMonthly || false);
        setExportIncludeDeductions(data.settings.exportIncludeDeductions || false);

        // Rota
        setRotaEnabled(data.settings.rotaEnabled || false);
        setRotaShowFinishTimes(data.settings.rotaShowFinishTimes !== undefined ? data.settings.rotaShowFinishTimes : true);
        setAllowShiftBidding(data.settings.allowShiftBidding !== undefined ? data.settings.allowShiftBidding : true);
        setRequireTimeOffApproval(data.settings.requireTimeOffApproval !== undefined ? data.settings.requireTimeOffApproval : true);
        
        // Vetting
        setVettingEnabled(data.settings.vettingEnabled || false);
        setVettingLevel(data.settings.vettingLevel || 'BS7858');

        // Audit
        setAuditLateIn(data.settings.auditLateInThreshold || 15);
        setAuditEarlyIn(data.settings.auditEarlyInThreshold || 30);
        setAuditEarlyOut(data.settings.auditEarlyOutThreshold || 15);
        setAuditLateOut(data.settings.auditLateOutThreshold || 15);
        setAuditShortShift(data.settings.auditShortShiftThreshold || 5);
        setAuditLongShift(data.settings.auditLongShiftThreshold || 14);
        setBlockEarlyClockIn(data.settings.blockEarlyClockIn || false);

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
          updateExistingLocs ||
          requireApproval !== (s.requireApproval || false) ||
          defaultRate !== (s.defaultHourlyRate || 15) ||
          currency !== (s.currency || '£') ||
          primaryColor !== (s.primaryColor || '#0ea5e9') ||
          logoUrl !== (s.logoUrl || '') ||
          logoFile !== null ||
          showStaffEarnings !== clean(s.showStaffEarnings, true) ||
          holidayPayEnabled !== (s.holidayPayEnabled || false) ||
          holidayPayRate !== (s.holidayPayRate || 12.07) ||
          breakType !== (s.breakType || 'unpaid') ||
          exportShowTimesWeekly !== clean(s.exportShowShiftTimesWeekly, true) ||
          exportShowTimesMonthly !== (s.exportShowShiftTimesMonthly || false) ||
          exportIncludeDeductions !== (s.exportIncludeDeductions || false) ||
          rotaEnabled !== (s.rotaEnabled || false) ||
          rotaShowFinishTimes !== clean(s.rotaShowFinishTimes, true) ||
          allowShiftBidding !== clean(s.allowShiftBidding, true) ||
          requireTimeOffApproval !== clean(s.requireTimeOffApproval, true) ||
          vettingEnabled !== (s.vettingEnabled || false) ||
          vettingLevel !== (s.vettingLevel || 'BS7858') ||
          auditLateIn !== (s.auditLateInThreshold || 15) ||
          auditEarlyIn !== (s.auditEarlyInThreshold || 30) ||
          auditEarlyOut !== (s.auditEarlyOutThreshold || 15) ||
          auditLateOut !== (s.auditLateOutThreshold || 15) ||
          auditShortShift !== (s.auditShortShiftThreshold || 5) ||
          auditLongShift !== (s.auditLongShiftThreshold || 14) ||
          blockEarlyClockIn !== (s.blockEarlyClockIn || false)
      );
  }, [
      company, user, companyName, personalName, radius, requireApproval, defaultRate, currency, primaryColor, logoUrl, logoFile, showStaffEarnings,
      holidayPayEnabled, holidayPayRate, breakType, exportShowTimesWeekly, exportShowTimesMonthly, exportIncludeDeductions, rotaEnabled, rotaShowFinishTimes, allowShiftBidding, requireTimeOffApproval,
      vettingEnabled, vettingLevel,
      auditLateIn, auditEarlyIn, auditEarlyOut, auditLateOut, auditShortShift, auditLongShift, updateExistingLocs, blockEarlyClockIn
  ]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname && !isSavingRef.current
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
        if (window.confirm("You have unsaved changes. Do you really want to leave?")) {
            blocker.proceed();
        } else {
            blocker.reset();
        }
    }
  }, [blocker]);

  const handleCopyCode = () => {
      if (company?.code) {
          navigator.clipboard.writeText(company.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setLogoFile(e.target.files[0]);
      }
  };

  const handleSave = async () => {
      if (!user?.currentCompanyId) return;
      isSavingRef.current = true;
      setSaving(true);
      
      try {
          let finalLogoUrl = logoUrl;
          if (logoFile) {
              finalLogoUrl = await uploadCompanyLogo(user.currentCompanyId, logoFile);
          }

          await updateCompany(user.currentCompanyId, { name: companyName });

          await updateCompanySettings(user.currentCompanyId, {
              geofenceRadius: radius,
              requireApproval,
              defaultHourlyRate: defaultRate,
              currency: currency,
              primaryColor,
              logoUrl: finalLogoUrl,
              showStaffEarnings,
              holidayPayEnabled,
              holidayPayRate,
              breakType,
              exportShowShiftTimesWeekly: exportShowTimesWeekly,
              exportShowShiftTimesMonthly: exportShowTimesMonthly,
              exportIncludeDeductions: exportIncludeDeductions,
              rotaEnabled,
              rotaShowFinishTimes,
              allowShiftBidding,
              requireTimeOffApproval,
              vettingEnabled,
              vettingLevel,
              auditLateInThreshold: auditLateIn,
              auditEarlyInThreshold: auditEarlyIn,
              auditEarlyOutThreshold: auditEarlyOut,
              auditLateOutThreshold: auditLateOut,
              auditShortShiftThreshold: auditShortShift,
              auditLongShiftThreshold: auditLongShift,
              blockEarlyClockIn
          });

          if (updateExistingLocs) {
              await updateAllLocationsRadius(user.currentCompanyId, radius);
          }

          if (user.name !== personalName) {
              await updateUserProfile(user.id, { name: personalName });
              await refreshSession();
          }
          
          setBrandColor(primaryColor);
          setSaving(false);
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
              isSavingRef.current = true; 
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

  if (loading) return <div className="p-8 text-center flex justify-center"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-fade-in h-[calc(100vh-6rem)] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage your company configuration.</p>
            </div>
            <button 
                onClick={handleSave} 
                disabled={saving || !isDirty} 
                className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-bold transition shadow-lg ${isDirty ? 'bg-brand-600 hover:bg-brand-700 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
            >
                <Save className="w-5 h-5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
        </div>

        {/* Layout: Sidebar + Content */}
        <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-hidden">
            
            {/* Sidebar Navigation */}
            <div className="w-full lg:w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden shrink-0 h-fit">
                <nav className="p-2 space-y-1">
                    <button onClick={() => setActiveTab('general')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'general' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <Building className="w-5 h-5" /> General
                    </button>
                    <button onClick={() => setActiveTab('brand')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'brand' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <Palette className="w-5 h-5" /> Branding
                    </button>
                    <button onClick={() => setActiveTab('pay')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'pay' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <DollarSign className="w-5 h-5" /> Time & Pay
                    </button>
                    <button onClick={() => setActiveTab('rota')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'rota' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <CalendarDays className="w-5 h-5" /> Rota System
                    </button>
                    <button onClick={() => setActiveTab('compliance')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'compliance' ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <Shield className="w-5 h-5" /> Compliance
                    </button>
                    <button onClick={() => setActiveTab('danger')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition ${activeTab === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                        <AlertOctagon className="w-5 h-5" /> Danger Zone
                    </button>
                </nav>
                
                {/* Invite Code Widget */}
                <div className="mt-auto p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50">
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Invite Code</p>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl font-mono font-bold text-slate-900 dark:text-white">{company?.code}</span>
                        <button onClick={handleCopyCode} className="p-1.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition">
                            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
                        </button>
                    </div>
                    <p className="text-xs text-slate-500">Share with staff to join.</p>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                
                {/* TAB: GENERAL */}
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Identity & Location</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Company Name</label>
                                    <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Your Name</label>
                                    <input type="text" value={personalName} onChange={e => setPersonalName(e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">GPS Radius (meters)</label>
                                    <input type="number" min="20" value={radius} onChange={e => setRadius(parseInt(e.target.value))} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                    {locationCount > 0 && (
                                        <div className="flex items-center mt-2">
                                            <input type="checkbox" id="update-locs" checked={updateExistingLocs} onChange={e => setUpdateExistingLocs(e.target.checked)} className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                                            <label htmlFor="update-locs" className="ml-2 text-xs font-medium text-slate-600 dark:text-slate-400">Update all {locationCount} existing locations?</label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Security</h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-medium text-sm text-slate-900 dark:text-white">Require Admin Approval</h4>
                                    <p className="text-xs text-slate-500">New staff accounts must be manually approved.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={requireApproval} onChange={e => setRequireApproval(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: BRANDING */}
                {activeTab === 'brand' && (
                    <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-white/10 space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Interface Theme</span>
                            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                <button onClick={() => setTheme('light')} className={`p-2 rounded-md transition ${theme === 'light' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600' : 'text-slate-400'}`}><Sun className="w-4 h-4" /></button>
                                <button onClick={() => setTheme('dark')} className={`p-2 rounded-md transition ${theme === 'dark' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600' : 'text-slate-400'}`}><Moon className="w-4 h-4" /></button>
                                <button onClick={() => setTheme('system')} className={`p-2 rounded-md transition ${theme === 'system' ? 'bg-white dark:bg-slate-700 shadow-sm text-brand-600' : 'text-slate-400'}`}><Laptop className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Brand Color</label>
                            <div className="flex items-center space-x-3">
                                <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded cursor-pointer bg-transparent" />
                                <input type="text" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 uppercase font-mono" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Logo</label>
                            <div className="flex items-center gap-3 mb-2">
                                <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium border border-slate-200 dark:border-slate-700"><Upload className="w-4 h-4 inline mr-2" /> Upload</button>
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
                                {logoFile && <span className="text-xs text-green-600 font-bold">{logoFile.name}</span>}
                            </div>
                            <div className="relative">
                                <Image className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input type="url" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" placeholder="Or paste image URL..." />
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: TIME & PAY */}
                {activeTab === 'pay' && (
                    <div className="space-y-6">
                        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Payroll Basics</h3>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Currency</label>
                                    <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                                        <option value="£">GBP (£)</option>
                                        <option value="$">USD ($)</option>
                                        <option value="€">EUR (€)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Default Rate</label>
                                    <input type="number" step="0.01" value={defaultRate} onChange={e => setDefaultRate(parseFloat(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" />
                                </div>
                            </div>
                            
                            <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-4">
                                <div className="flex justify-between items-center">
                                    <div><h4 className="text-sm font-bold">Staff View Earnings</h4><p className="text-xs text-slate-500">Show estimated pay in app.</p></div>
                                    <input type="checkbox" checked={showStaffEarnings} onChange={e => setShowStaffEarnings(e.target.checked)} className="rounded text-brand-600 focus:ring-brand-500 w-5 h-5" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div><h4 className="text-sm font-bold">Holiday Pay</h4><p className="text-xs text-slate-500">Calculate accrual on exports.</p></div>
                                    <input type="checkbox" checked={holidayPayEnabled} onChange={e => setHolidayPayEnabled(e.target.checked)} className="rounded text-brand-600 focus:ring-brand-500 w-5 h-5" />
                                </div>
                                {holidayPayEnabled && (
                                    <div className="pl-4 border-l-2 border-slate-200 dark:border-white/10">
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Rate (%)</label>
                                        <input type="number" value={holidayPayRate} onChange={e => setHolidayPayRate(parseFloat(e.target.value))} className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Breaks & Tracking</h3>
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-xl"><Clock className="w-6 h-6 text-slate-500" /></div>
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-slate-900 dark:text-white mb-1">Break Policy</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="breakType" value="unpaid" checked={breakType === 'unpaid'} onChange={() => setBreakType('unpaid')} className="text-brand-600 focus:ring-brand-500" />
                                            <span className="text-sm">Unpaid (Deducted)</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="radio" name="breakType" value="paid" checked={breakType === 'paid'} onChange={() => setBreakType('paid')} className="text-brand-600 focus:ring-brand-500" />
                                            <span className="text-sm">Paid</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Export Preferences</h3>
                            <div className="space-y-3">
                                <label className="flex items-center gap-2"><input type="checkbox" checked={exportShowTimesWeekly} onChange={e => setExportShowTimesWeekly(e.target.checked)} className="rounded text-brand-600" /><span className="text-sm">Show times in Weekly Matrix</span></label>
                                <label className="flex items-center gap-2"><input type="checkbox" checked={exportIncludeDeductions} onChange={e => setExportIncludeDeductions(e.target.checked)} className="rounded text-brand-600" /><span className="text-sm">Include deduction columns (Tax/NI)</span></label>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: ROTA */}
                {activeTab === 'rota' && (
                    <div className="space-y-6">
                        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rota System</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={rotaEnabled} onChange={e => setRotaEnabled(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                            
                            {rotaEnabled && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl space-y-3">
                                        <label className="flex items-center justify-between"><span className="text-sm font-medium">Show Finish Times on Rota</span><input type="checkbox" checked={rotaShowFinishTimes} onChange={e => setRotaShowFinishTimes(e.target.checked)} className="rounded text-brand-600" /></label>
                                        <label className="flex items-center justify-between"><span className="text-sm font-medium">Allow Shift Bidding</span><input type="checkbox" checked={allowShiftBidding} onChange={e => setAllowShiftBidding(e.target.checked)} className="rounded text-brand-600" /></label>
                                        <label className="flex items-center justify-between"><span className="text-sm font-medium">Require Approval for Time Off</span><input type="checkbox" checked={requireTimeOffApproval} onChange={e => setRequireTimeOffApproval(e.target.checked)} className="rounded text-brand-600" /></label>
                                    </div>
                                    
                                    <div className="border-t border-slate-100 dark:border-white/5 pt-4">
                                        <h4 className="font-bold text-sm mb-3">Enforcement Rules</h4>
                                        <label className="flex items-center justify-between">
                                            <div>
                                                <span className="text-sm font-medium">Block Early Clock-In</span>
                                                <p className="text-xs text-slate-500">Prevent staff starting before their scheduled time (within tolerance).</p>
                                            </div>
                                            <input type="checkbox" checked={blockEarlyClockIn} onChange={e => setBlockEarlyClockIn(e.target.checked)} className="rounded text-brand-600" />
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB: COMPLIANCE */}
                {activeTab === 'compliance' && (
                    <div className="space-y-6">
                        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Vetting & Docs</h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={vettingEnabled} onChange={e => setVettingEnabled(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                            {vettingEnabled && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">Vetting Standard</label>
                                    <select value={vettingLevel} onChange={e => setVettingLevel(e.target.value as VettingLevel)} className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                                        <option value="BS7858">BS7858 (Security)</option>
                                        <option value="BPSS">BPSS (Gov)</option>
                                        <option value="PCI_DSS">PCI DSS (Finance)</option>
                                        <option value="AIRSIDE">Airside (Airport)</option>
                                        <option value="CQC">CQC (Care)</option>
                                        <option value="CUSTOM">Custom</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-white/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Audit Thresholds (Minutes)</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold uppercase text-slate-500">Late In</label><input type="number" value={auditLateIn} onChange={e => setAuditLateIn(parseInt(e.target.value))} className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" /></div>
                                <div><label className="text-xs font-bold uppercase text-slate-500">Early In</label><input type="number" value={auditEarlyIn} onChange={e => setAuditEarlyIn(parseInt(e.target.value))} className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" /></div>
                                <div><label className="text-xs font-bold uppercase text-slate-500">Late Out</label><input type="number" value={auditLateOut} onChange={e => setAuditLateOut(parseInt(e.target.value))} className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" /></div>
                                <div><label className="text-xs font-bold uppercase text-slate-500">Early Out</label><input type="number" value={auditEarlyOut} onChange={e => setAuditEarlyOut(parseInt(e.target.value))} className="w-full mt-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900" /></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB: DANGER */}
                {activeTab === 'danger' && (
                    <div className="glass-panel p-6 rounded-2xl border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10">
                        <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">Danger Zone</h3>
                        <p className="text-sm text-red-700 dark:text-red-300 mb-4">Actions here cannot be undone.</p>
                        <button onClick={handleDeleteCompany} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition">Delete Company</button>
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};
