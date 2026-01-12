
import React, { useEffect, useState } from 'react';
import { getCompany, updateCompanySettings, deleteCompanyFull } from '../services/api';
import { Company } from '../types';
import { Copy, Save, Building, Shield, Check, Palette, DollarSign, Image, Globe, Trash2, AlertOctagon, Share2, Percent, CalendarDays, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { APP_NAME } from '../constants';

export const AdminSettings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form State
  const [radius, setRadius] = useState(200);
  const [requireApproval, setRequireApproval] = useState(false);
  const [defaultRate, setDefaultRate] = useState(15);
  const [currency, setCurrency] = useState('£');
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9');
  const [logoUrl, setLogoUrl] = useState('');
  
  // Holiday Pay
  const [holidayPayEnabled, setHolidayPayEnabled] = useState(false);
  const [holidayPayRate, setHolidayPayRate] = useState(12.07);

  // Rota Settings
  const [rotaEnabled, setRotaEnabled] = useState(false);
  const [allowShiftBidding, setAllowShiftBidding] = useState(true);
  const [requireTimeOffApproval, setRequireTimeOffApproval] = useState(true);

  // Audit Settings
  const [auditLateIn, setAuditLateIn] = useState(15);
  const [auditEarlyOut, setAuditEarlyOut] = useState(15);
  const [auditLateOut, setAuditLateOut] = useState(15);
  const [auditShortShift, setAuditShortShift] = useState(5);
  const [auditLongShift, setAuditLongShift] = useState(14);

  useEffect(() => {
    const loadData = async () => {
        if (!user || !user.currentCompanyId) return;
        const data = await getCompany(user.currentCompanyId);
        setCompany(data);
        setRadius(data.settings.geofenceRadius);
        setRequireApproval(data.settings.requireApproval || false);
        setDefaultRate(data.settings.defaultHourlyRate || 15);
        setCurrency(data.settings.currency || '£');
        setPrimaryColor(data.settings.primaryColor || '#0ea5e9');
        setLogoUrl(data.settings.logoUrl || '');
        setHolidayPayEnabled(data.settings.holidayPayEnabled || false);
        setHolidayPayRate(data.settings.holidayPayRate || 12.07);
        
        // Rota
        setRotaEnabled(data.settings.rotaEnabled || false);
        setAllowShiftBidding(data.settings.allowShiftBidding !== undefined ? data.settings.allowShiftBidding : true);
        setRequireTimeOffApproval(data.settings.requireTimeOffApproval !== undefined ? data.settings.requireTimeOffApproval : true);
        
        // Audit
        setAuditLateIn(data.settings.auditLateInThreshold || 15);
        setAuditEarlyOut(data.settings.auditEarlyOutThreshold || 15);
        setAuditLateOut(data.settings.auditLateOutThreshold || 15);
        setAuditShortShift(data.settings.auditShortShiftThreshold || 5);
        setAuditLongShift(data.settings.auditLongShiftThreshold || 14);

        setLoading(false);
    };
    loadData();
  }, [user]);

  const handleCopyCode = () => {
      if (company?.code) {
          navigator.clipboard.writeText(company.code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      }
  };

  const handleShareCode = async () => {
        if (!company?.code) return;
        const text = `Hey, we are now using ${APP_NAME} for our clock-in system. Please create an account at tallyd.app. Use ${company.code} as invite code.`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Join ${company.name} on ${APP_NAME}`,
                    text: text,
                    url: 'https://tallyd.app'
                });
            } catch (err) {
                // User cancelled or not supported
            }
        } else {
            handleCopyCode();
            alert("Sharing not supported on this device. Code copied to clipboard.");
        }
  };

  const handleSave = async () => {
      if (!user?.currentCompanyId) return;
      setSaving(true);
      await updateCompanySettings(user.currentCompanyId, {
          geofenceRadius: radius,
          requireApproval,
          defaultHourlyRate: defaultRate,
          currency: currency,
          primaryColor,
          logoUrl,
          holidayPayEnabled,
          holidayPayRate,
          rotaEnabled,
          allowShiftBidding,
          requireTimeOffApproval,
          auditLateInThreshold: auditLateIn,
          auditEarlyOutThreshold: auditEarlyOut,
          auditLateOutThreshold: auditLateOut,
          auditShortShiftThreshold: auditShortShift,
          auditLongShiftThreshold: auditLongShift
      });
      setSaving(false);
      window.location.reload(); // Reload to update navigation state
  };

  const handleDeleteCompany = async () => {
      if (!user?.currentCompanyId) return;
      const confirmName = prompt(`To confirm deletion, please type the company name: ${company?.name}`);
      if (confirmName === company?.name) {
          try {
              await deleteCompanyFull(user.currentCompanyId);
              alert("Company deleted successfully.");
              window.location.reload();
          } catch (e) {
              console.error(e);
              alert("Failed to delete company.");
          }
      }
  };

  if (loading) return <div className="p-8 text-center flex justify-center"><div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Company Settings</h1>
            <p className="text-slate-500 dark:text-slate-400">Manage your organization preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Invite Code & Save */}
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
                                <button 
                                    onClick={handleCopyCode}
                                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition backdrop-blur-sm"
                                    title="Copy to clipboard"
                                >
                                    {copied ? <Check className="w-5 h-5 text-emerald-300" /> : <Copy className="w-5 h-5" />}
                                </button>
                                <button 
                                    onClick={handleShareCode}
                                    className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition backdrop-blur-sm"
                                    title="Share invite"
                                >
                                    <Share2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <p className="mt-4 text-white/80 text-sm">
                            Share this code with your staff.
                        </p>
                    </div>
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-20 rounded-full -translate-y-1/2 translate-x-1/4"></div>
                </div>

                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center space-x-2 bg-slate-900 dark:bg-slate-700 text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-800 transition disabled:opacity-70 shadow-lg"
                >
                    <Save className="w-5 h-5" />
                    <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
                </button>
            </div>

            {/* Right Column: Settings Forms */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* General */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500">
                            <Building className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">General & Security</h3>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                GPS Geofence Radius (meters)
                            </label>
                            <input 
                                type="number"
                                min="20"
                                value={radius}
                                onChange={(e) => setRadius(parseInt(e.target.value))}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <h4 className="font-medium text-slate-900 dark:text-white text-sm">Require Admin Approval</h4>
                                <p className="text-xs text-slate-500">New staff must be approved before they can clock in.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={requireApproval} 
                                    onChange={(e) => setRequireApproval(e.target.checked)}
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Audit Settings */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Attendance Auditing</h3>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">Configure when to flag shifts for review.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Late In Threshold (mins)</label>
                            <input 
                                type="number"
                                min="0"
                                value={auditLateIn}
                                onChange={(e) => setAuditLateIn(parseInt(e.target.value))}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Early Out Threshold (mins)</label>
                            <input 
                                type="number"
                                min="0"
                                value={auditEarlyOut}
                                onChange={(e) => setAuditEarlyOut(parseInt(e.target.value))}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Late Out Threshold (mins)</label>
                            <input 
                                type="number"
                                min="0"
                                value={auditLateOut}
                                onChange={(e) => setAuditLateOut(parseInt(e.target.value))}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Short Shift (mins)</label>
                            <input 
                                type="number"
                                min="0"
                                value={auditShortShift}
                                onChange={(e) => setAuditShortShift(parseInt(e.target.value))}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Long Shift / Forgotten Clock-out (hours)</label>
                            <input 
                                type="number"
                                min="0"
                                value={auditLongShift}
                                onChange={(e) => setAuditLongShift(parseInt(e.target.value))}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Rota System Settings */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
                        <div className="flex items-center space-x-3">
                             <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500">
                                <CalendarDays className="w-5 h-5" />
                            </div>
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Rota System</h3>
                        </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={rotaEnabled} 
                                onChange={(e) => setRotaEnabled(e.target.checked)}
                                className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                        </label>
                    </div>
                    
                    {rotaEnabled ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-medium text-slate-900 dark:text-white text-sm">Allow Shift Bidding</h4>
                                    <p className="text-xs text-slate-500">Staff can request to take Open shifts.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={allowShiftBidding} 
                                        onChange={(e) => setAllowShiftBidding(e.target.checked)}
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>

                             <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-medium text-slate-900 dark:text-white text-sm">Require Time Off Approval</h4>
                                    <p className="text-xs text-slate-500">Requests need admin review.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={requireTimeOffApproval} 
                                        onChange={(e) => setRequireTimeOffApproval(e.target.checked)}
                                        className="sr-only peer" 
                                    />
                                    <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                </label>
                            </div>
                        </div>
                    ) : (
                         <div className="text-sm text-slate-500 italic">Enable the Rota System to see more options.</div>
                    )}
                </div>

                {/* Payroll & Localization */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500">
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
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none"
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
                                    className="w-full pl-8 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Applied to new staff automatically.</p>
                        </div>
                    </div>

                    <div className="mt-6 border-t border-slate-100 dark:border-slate-700 pt-4">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h4 className="font-medium text-slate-900 dark:text-white text-sm">Calculate Holiday Pay</h4>
                                <p className="text-xs text-slate-500">Automatically calculate holiday accrual in exports.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={holidayPayEnabled} 
                                    onChange={(e) => setHolidayPayEnabled(e.target.checked)}
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
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
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                </div>
                                <p className="text-xs text-slate-500 mt-1">12.07% is standard for UK casual workers.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Branding */}
                 <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500">
                            <Palette className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">App Branding</h3>
                    </div>
                    <div className="space-y-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Primary Brand Color
                            </label>
                            <div className="flex items-center space-x-3">
                                <div className="relative">
                                    <input 
                                        type="color"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="h-12 w-12 rounded-lg border-0 cursor-pointer overflow-hidden p-0"
                                    />
                                </div>
                                <div className="flex-1">
                                    <input 
                                        type="text" 
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm"
                                        placeholder="#000000"
                                    />
                                </div>
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Company Logo URL
                            </label>
                            <div className="flex items-center space-x-3">
                                <div className="relative flex-1">
                                    <Image className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="url"
                                        value={logoUrl}
                                        onChange={(e) => setLogoUrl(e.target.value)}
                                        placeholder="https://example.com/logo.png"
                                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                {logoUrl && <img src={logoUrl} alt="Preview" className="h-10 w-10 object-contain rounded bg-slate-50" />}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-100 dark:border-red-900/30">
                    <div className="flex items-center space-x-3 pb-4 border-b border-red-200 dark:border-red-900/30 mb-4">
                        <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-lg text-red-600">
                            <AlertOctagon className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg text-red-700 dark:text-red-400">Danger Zone</h3>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="font-bold text-red-700 dark:text-red-400">Delete Company</h4>
                            <p className="text-sm text-red-600/80 dark:text-red-400/70">Permanently delete this organization, all locations, and remove staff associations. This cannot be undone.</p>
                        </div>
                        <button 
                            onClick={handleDeleteCompany}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-sm transition"
                        >
                            Delete Company
                        </button>
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};
