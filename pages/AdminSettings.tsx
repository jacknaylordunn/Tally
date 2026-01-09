
import React, { useEffect, useState } from 'react';
import { getCompany, updateCompanySettings } from '../services/api';
import { Company } from '../types';
import { Copy, Save, Building, Shield, Check, Palette, DollarSign, Image } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AdminSettings = () => {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form State
  const [radius, setRadius] = useState(200);
  const [manualClockIn, setManualClockIn] = useState(true);
  const [defaultRate, setDefaultRate] = useState(15);
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const loadData = async () => {
        if (!user || !user.currentCompanyId) return;
        const data = await getCompany(user.currentCompanyId);
        setCompany(data);
        setRadius(data.settings.geofenceRadius);
        setManualClockIn(data.settings.allowManualClockIn);
        setDefaultRate(data.settings.defaultHourlyRate || 15);
        setPrimaryColor(data.settings.primaryColor || '#0ea5e9');
        setLogoUrl(data.settings.logoUrl || '');
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

  const handleSave = async () => {
      if (!user?.currentCompanyId) return;
      setSaving(true);
      await updateCompanySettings(user.currentCompanyId, {
          geofenceRadius: radius,
          allowManualClockIn: manualClockIn,
          defaultHourlyRate: defaultRate,
          primaryColor,
          logoUrl
      });
      setSaving(false);
  };

  if (loading) return <div className="p-8 text-center">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Company Settings</h1>
            <p className="text-slate-500 dark:text-slate-400">Manage your organization preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Invite Code & Save */}
            <div className="space-y-6">
                <div 
                    className="rounded-2xl p-8 text-white relative overflow-hidden shadow-lg"
                    style={{ backgroundColor: primaryColor }}
                >
                    <div className="relative z-10">
                        <h2 className="text-white/80 font-medium mb-1 uppercase tracking-wider text-xs">Company Invite Code</h2>
                        <div className="flex items-center space-x-4">
                            <span className="text-4xl font-bold tracking-widest">{company?.code}</span>
                            <button 
                                onClick={handleCopyCode}
                                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition backdrop-blur-sm"
                            >
                                {copied ? <Check className="w-5 h-5 text-emerald-300" /> : <Copy className="w-5 h-5" />}
                            </button>
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
                                value={radius}
                                onChange={(e) => setRadius(parseInt(e.target.value))}
                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <h4 className="font-medium text-slate-900 dark:text-white text-sm">Allow Manual Clock-In</h4>
                                <p className="text-xs text-slate-500">Enable button for staff to clock in without QR.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={manualClockIn} 
                                    onChange={(e) => setManualClockIn(e.target.checked)}
                                    className="sr-only peer" 
                                />
                                <div className="w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:bg-brand-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Payroll */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
                        <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">Payroll Configuration</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Default Hourly Rate
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={defaultRate}
                                    onChange={(e) => setDefaultRate(parseFloat(e.target.value))}
                                    className="w-full pl-8 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Applied to new staff automatically.</p>
                        </div>
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
                                <input 
                                    type="color"
                                    value={primaryColor}
                                    onChange={(e) => setPrimaryColor(e.target.value)}
                                    className="h-10 w-10 rounded-lg border-0 cursor-pointer"
                                />
                                <span className="text-sm font-mono text-slate-500">{primaryColor}</span>
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
                                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                </div>
                                {logoUrl && <img src={logoUrl} alt="Preview" className="h-10 w-10 object-contain rounded bg-slate-50" />}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};
