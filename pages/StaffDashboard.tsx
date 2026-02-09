
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';
import { getStaffActivity, getCompany, getSchedule, updateUserProfile, uploadVettingDocument, toggleShiftBreak } from '../services/api';
import { Shift, Company, ScheduleShift, VettingItem, AddressData, EmploymentData, VettingSection } from '../types';
import { Clock, Scan, X, Calendar, RefreshCw, AlertCircle, Play, StopCircle, MapPin, ChevronRight, FileCheck, Upload, Check, Loader2, ShieldCheck, FileText, CheckCircle2, Clock as ClockIcon, Plus, Trash2, ChevronDown, ChevronUp, Briefcase, Home, Lock, Info, Coffee } from 'lucide-react';
import jsQR from 'jsqr';
import { useNavigate } from 'react-router-dom';
import { VETTING_TEMPLATES } from '../constants';

export const StaffDashboard = () => {
  const { user, refreshSession } = useAuth();
  const { startTutorial } = useTutorial();
  const navigate = useNavigate();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [nextScheduledShift, setNextScheduledShift] = useState<ScheduleShift | null>(null);
  const [greeting, setGreeting] = useState('Hello');
  
  // Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Vetting State
  const [vettingItems, setVettingItems] = useState<VettingItem[]>([]);
  const [expandedSection, setExpandedSection] = useState<string | null>('identity'); 
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  
  // Sub-forms State
  const [addressForm, setAddressForm] = useState<Partial<AddressData>>({ current: false });
  const [jobForm, setJobForm] = useState<Partial<EmploymentData>>({ current: false });

  // Break State
  const isOnBreak = activeShift?.breaks?.some(b => !b.endTime) || false;

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  const loadData = async () => {
      if (!user) return;
      const [shiftsData, companyData] = await Promise.all([
          getStaffActivity(user.id),
          user.currentCompanyId ? getCompany(user.currentCompanyId) : Promise.resolve(null)
      ]);
      setShifts(shiftsData);
      setCompany(companyData);
      
      const current = shiftsData.find(s => !s.endTime);
      setActiveShift(current || null);

      if (companyData?.settings.vettingEnabled) {
          const level = companyData.settings.vettingLevel || 'BS7858';
          const template = VETTING_TEMPLATES[level];
          
          const mergedItems = template.map(tItem => {
              const existing = user.vettingData?.find(uItem => uItem.id === tItem.id);
              return existing ? { ...tItem, ...existing } : tItem;
          });
          setVettingItems(mergedItems);
      }

      if (companyData?.settings.rotaEnabled && user.currentCompanyId) {
          try {
              const now = new Date();
              const endOfDay = new Date(); endOfDay.setHours(23, 59, 59);
              const todayShifts = await getSchedule(user.currentCompanyId, now.getTime(), endOfDay.getTime());
              const upcoming = todayShifts
                  .filter(s => s.userId === user.id && s.startTime > Date.now())
                  .sort((a,b) => a.startTime - b.startTime);
              
              if (upcoming.length > 0) {
                  setNextScheduledShift(upcoming[0]);
              }
          } catch (e) {
              console.error("Error fetching next shift", e);
          }
      }
      
      if (!companyData?.settings.vettingEnabled || user.vettingStatus === 'verified') {
          setTimeout(() => startTutorial(), 1000);
      }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Scanner Logic ...
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrame: number;

    const startScan = async () => {
        if (!isScanning) return;
        setCameraError('');
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.setAttribute("playsinline", "true"); 
                videoRef.current.play();
                requestAnimationFrame(tick);
            }
        } catch (err: any) {
            console.error("Camera error", err);
            if (err.name === 'NotAllowedError') setCameraError("Camera permission denied.");
            else if (err.name === 'NotFoundError') setCameraError("No camera found.");
            else setCameraError("Unable to access camera.");
        }
    };

    const tick = () => {
        if (!videoRef.current || !isScanning) return;
        if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
             const canvas = document.createElement("canvas");
             canvas.width = videoRef.current.videoWidth;
             canvas.height = videoRef.current.videoHeight;
             const ctx = canvas.getContext("2d");
             if (ctx) {
                 ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                 const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                 const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                 
                 if (code && code.data.includes('action')) {
                     try {
                         let targetPath = '';
                         if (code.data.startsWith('http')) {
                             const url = new URL(code.data);
                             targetPath = url.hash ? url.hash.substring(1) : (url.pathname + url.search);
                         } else {
                             targetPath = code.data;
                         }
                         setIsScanning(false);
                         if (stream) stream.getTracks().forEach(t => t.stop());
                         navigate(targetPath);
                         return; 
                     } catch (e) {
                         console.error("Parse error", e);
                     }
                 }
             }
        }
        animationFrame = requestAnimationFrame(tick);
    };

    if (isScanning) startScan();
    return () => {
        if (stream) stream.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(animationFrame);
    };
  }, [isScanning, navigate]);

  const calculateDuration = (startTime: number) => {
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return { h: hours, m: minutes };
  };

  const duration = activeShift ? calculateDuration(activeShift.startTime) : {h:0, m:0};

  const handleBreakToggle = async () => {
      if (!activeShift) return;
      const isStarting = !isOnBreak;
      await toggleShiftBreak(activeShift.id, isStarting);
      loadData();
  };

  // VETTING HANDLERS
  const saveVettingItemState = async (updatedItems: VettingItem[]) => {
      setVettingItems(updatedItems);
      if (!user) return;
      const cleanItems = JSON.parse(JSON.stringify(updatedItems));
      const completed = cleanItems.filter((i: VettingItem) => i.status === 'uploaded' || i.status === 'accepted').length;
      const progress = Math.round((completed / cleanItems.length) * 100);
      await updateUserProfile(user.id, {
          vettingStatus: 'in_progress',
          vettingData: cleanItems,
          vettingProgress: progress,
          vettingLastUpdated: Date.now()
      });
  };
  const handleFileUpload = async (item: VettingItem, file: File) => {
      if (!user?.currentCompanyId) return;
      setUploadingId(item.id);
      try {
          const url = await uploadVettingDocument(user.currentCompanyId, user.id, file);
          const newFile = { url, name: file.name, type: file.type, uploadedAt: Date.now() };
          const updatedItems = vettingItems.map(i => i.id === item.id ? { ...i, status: 'uploaded' as const, files: [...(i.files || []), newFile], submittedAt: Date.now() } : i);
          await saveVettingItemState(updatedItems);
      } catch (e) { console.error("Upload failed", e); alert("Failed to upload document."); } finally { setUploadingId(null); }
  };
  const removeFile = async (item: VettingItem, fileIndex: number) => {
      const updatedItems = vettingItems.map(i => i.id === item.id ? { ...i, files: (i.files || []).filter((_, idx) => idx !== fileIndex) } : i);
      await saveVettingItemState(updatedItems);
  };
  const handleFormFieldChange = async (item: VettingItem, key: string, value: string) => {
      const updatedItems = vettingItems.map(i => i.id === item.id ? { ...i, data: { ...i.data, formValues: { ...(i.data?.formValues || {}), [key]: value } }, status: 'uploaded' as const } : i);
      await saveVettingItemState(updatedItems);
  };
  const addAddress = async (item: VettingItem) => {
      if (!addressForm.line1 || !addressForm.city || !addressForm.postcode || !addressForm.dateFrom) return;
      const newAddr: AddressData = { id: `addr_${Date.now()}`, line1: addressForm.line1, line2: addressForm.line2, city: addressForm.city, postcode: addressForm.postcode, dateFrom: addressForm.dateFrom, dateTo: addressForm.dateTo, current: addressForm.current || false };
      const updatedItems = vettingItems.map(i => i.id === item.id ? { ...i, data: { ...i.data, addresses: [...(i.data?.addresses || []), newAddr] }, status: 'uploaded' as const } : i);
      await saveVettingItemState(updatedItems); setAddressForm({ current: false });
  };
  const removeAddress = async (item: VettingItem, addrId: string) => {
      const updatedItems = vettingItems.map(i => i.id === item.id ? { ...i, data: { ...i.data, addresses: i.data?.addresses?.filter(a => a.id !== addrId) } } : i);
      await saveVettingItemState(updatedItems);
  };
  const addJob = async (item: VettingItem) => {
      if (!jobForm.employerName || !jobForm.role || !jobForm.dateFrom) return;
      const newJob: EmploymentData = { id: `job_${Date.now()}`, employerName: jobForm.employerName, role: jobForm.role, dateFrom: jobForm.dateFrom, dateTo: jobForm.dateTo, current: jobForm.current || false, contactEmail: jobForm.contactEmail, contactPhone: jobForm.contactPhone };
      const updatedItems = vettingItems.map(i => i.id === item.id ? { ...i, data: { ...i.data, employment: [...(i.data?.employment || []), newJob] }, status: 'uploaded' as const } : i);
      await saveVettingItemState(updatedItems); setJobForm({ current: false });
  };
  const removeJob = async (item: VettingItem, jobId: string) => {
      const updatedItems = vettingItems.map(i => i.id === item.id ? { ...i, data: { ...i.data, employment: i.data?.employment?.filter(j => j.id !== jobId) } } : i);
      await saveVettingItemState(updatedItems);
  };
  const submitVetting = async () => { if (!user) return; await updateUserProfile(user.id, { vettingStatus: 'submitted' }); await refreshSession(); alert("Vetting submitted for review."); };
  
  // Helper Renders
  const renderFormFields = (item: VettingItem) => { if (!item.formFields) return null; return ( <div className="space-y-3 mb-4 bg-slate-50 dark:bg-black/10 p-3 rounded-lg border border-slate-200 dark:border-white/5"> {item.formFields.map(field => ( <div key={field.key}> <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{field.label}</label> <input type={field.type} value={item.data?.formValues?.[field.key] || ''} onChange={e => handleFormFieldChange(item, field.key, e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-500" placeholder={field.type === 'date' ? '' : 'Enter details...'} /> </div> ))} </div> ); };
  const renderFileSection = (item: VettingItem) => ( <div className="mt-4"> <p className="text-xs font-bold uppercase text-slate-500 mb-2">Attached Documents</p> <div className="space-y-2 mb-3"> {item.files?.map((f, idx) => ( <div key={idx} className="flex items-center justify-between p-2 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10"> <div className="flex items-center gap-2 overflow-hidden"> <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" /> <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{f.name}</span> </div> {item.status !== 'accepted' && ( <button onClick={() => removeFile(item, idx)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button> )} </div> ))} {(!item.files || item.files.length === 0) && ( <p className="text-xs text-slate-400 italic">No files uploaded yet.</p> )} </div> {item.status !== 'accepted' && ( <div className="relative"> <input type="file" id={`file-${item.id}`} className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(item, e.target.files[0]); }} /> <label htmlFor={`file-${item.id}`} className={`flex items-center justify-center w-full py-2 border-2 border-dashed rounded-lg text-xs font-bold cursor-pointer transition ${uploadingId === item.id ? 'opacity-50 cursor-wait' : 'border-slate-300 hover:border-brand-500 hover:text-brand-600'}`}> {uploadingId === item.id ? ( <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</span> ) : ( <span className="flex items-center gap-2"><Upload className="w-3 h-3" /> Upload Document</span> )} </label> </div> )} </div> );
  const renderAddressSection = (item: VettingItem) => ( <div className="mt-4"> <p className="text-xs font-bold uppercase text-slate-500 mb-2">Address History</p> <div className="space-y-2 mb-4"> {item.data?.addresses?.map((addr) => ( <div key={addr.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 relative group"> <div className="flex items-start justify-between"> <div> <p className="text-sm font-bold text-slate-900 dark:text-white">{addr.line1}, {addr.city}</p> <p className="text-xs text-slate-500 font-mono">{addr.postcode}</p> <p className="text-[10px] text-slate-400 mt-1"> {addr.dateFrom} - {addr.current ? 'Present' : addr.dateTo} </p> </div> {item.status !== 'accepted' && ( <button onClick={() => removeAddress(item, addr.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button> )} </div> </div> ))} </div> {item.status !== 'accepted' && ( <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-white/10 space-y-3"> <p className="text-xs font-bold text-brand-600">Add New Address</p> <input className="w-full text-xs p-2 rounded border bg-transparent" placeholder="Line 1" value={addressForm.line1 || ''} onChange={e => setAddressForm({...addressForm, line1: e.target.value})} /> <div className="grid grid-cols-2 gap-2"> <input className="text-xs p-2 rounded border bg-transparent" placeholder="City" value={addressForm.city || ''} onChange={e => setAddressForm({...addressForm, city: e.target.value})} /> <input className="text-xs p-2 rounded border bg-transparent" placeholder="Postcode" value={addressForm.postcode || ''} onChange={e => setAddressForm({...addressForm, postcode: e.target.value})} /> </div> <div className="grid grid-cols-2 gap-2"> <div> <label className="text-[10px] text-slate-400 block mb-1">From (YYYY-MM)</label> <input type="month" className="w-full text-xs p-2 rounded border bg-transparent" value={addressForm.dateFrom || ''} onChange={e => setAddressForm({...addressForm, dateFrom: e.target.value})} /> </div> <div> <label className="text-[10px] text-slate-400 block mb-1">To (YYYY-MM)</label> <input type="month" disabled={addressForm.current} className="w-full text-xs p-2 rounded border bg-transparent disabled:opacity-50" value={addressForm.dateTo || ''} onChange={e => setAddressForm({...addressForm, dateTo: e.target.value})} /> </div> </div> <label className="flex items-center gap-2 text-xs"> <input type="checkbox" checked={addressForm.current} onChange={e => setAddressForm({...addressForm, current: e.target.checked, dateTo: ''})} /> Current Address </label> <button onClick={() => addAddress(item)} className="w-full py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700">Add Address</button> </div> )} {renderFileSection(item)} </div> );
  const renderEmploymentSection = (item: VettingItem) => ( <div className="mt-4"> <p className="text-xs font-bold uppercase text-slate-500 mb-2">Employment History</p> <div className="space-y-2 mb-4"> {item.data?.employment?.map((job) => ( <div key={job.id} className="p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10 relative"> <div className="flex items-start justify-between"> <div> <p className="text-sm font-bold text-slate-900 dark:text-white">{job.employerName}</p> <p className="text-xs text-slate-600 dark:text-slate-300">{job.role}</p> <p className="text-[10px] text-slate-400 mt-1"> {job.dateFrom} - {job.current ? 'Present' : job.dateTo} </p> </div> {item.status !== 'accepted' && ( <button onClick={() => removeJob(item, job.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button> )} </div> </div> ))} </div> {item.status !== 'accepted' && ( <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-white/10 space-y-3"> <p className="text-xs font-bold text-brand-600">Add Employer</p> <input className="w-full text-xs p-2 rounded border bg-transparent" placeholder="Employer Name" value={jobForm.employerName || ''} onChange={e => setJobForm({...jobForm, employerName: e.target.value})} /> <input className="w-full text-xs p-2 rounded border bg-transparent" placeholder="Role / Position" value={jobForm.role || ''} onChange={e => setJobForm({...jobForm, role: e.target.value})} /> <div className="grid grid-cols-2 gap-2"> <div> <label className="text-[10px] text-slate-400 block mb-1">From</label> <input type="month" className="w-full text-xs p-2 rounded border bg-transparent" value={jobForm.dateFrom || ''} onChange={e => setJobForm({...jobForm, dateFrom: e.target.value})} /> </div> <div> <label className="text-[10px] text-slate-400 block mb-1">To</label> <input type="month" disabled={jobForm.current} className="w-full text-xs p-2 rounded border bg-transparent disabled:opacity-50" value={jobForm.dateTo || ''} onChange={e => setJobForm({...jobForm, dateTo: e.target.value})} /> </div> </div> <label className="flex items-center gap-2 text-xs"> <input type="checkbox" checked={jobForm.current} onChange={e => setJobForm({...jobForm, current: e.target.checked, dateTo: ''})} /> Current Employer </label> <button onClick={() => addJob(item)} className="w-full py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700">Add Job</button> </div> )} {renderFileSection(item)} </div> );
  
  // Group items by Section
  const groupedItems = {
      identity: vettingItems.filter(i => i.section === 'identity'),
      history: vettingItems.filter(i => i.section === 'history'),
      financial: vettingItems.filter(i => i.section === 'financial'),
      security: vettingItems.filter(i => i.section === 'security'),
      qualifications: vettingItems.filter(i => i.section === 'qualifications')
  };

  const SECTION_TITLES: Record<string, string> = {
      identity: 'Identity & Address',
      history: 'Employment History',
      financial: 'Financial Checks',
      security: 'Security Clearance',
      qualifications: 'Qualifications'
  };

  // 1. VETTING DASHBOARD RENDER
  if (company?.settings.vettingEnabled && user?.vettingStatus !== 'verified') {
      const status = user?.vettingStatus || 'not_started';
      const isSubmitted = status === 'submitted';
      const completedCount = vettingItems.filter(i => i.status === 'uploaded' || i.status === 'accepted').length;
      const totalCount = vettingItems.length;
      const progress = Math.round((completedCount / totalCount) * 100);

      return (
          <div className="max-w-md mx-auto space-y-8 animate-fade-in relative pb-20 pt-6 px-4">
              <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 rounded-2xl flex items-center justify-center mx-auto shadow-sm mb-4">
                      <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Onboarding Checklist</h1>
                  <p className="text-slate-500 text-sm">Complete these tasks to unlock your account.</p>
              </div>

              {/* Progress Card */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Completion</span>
                      <span className="text-xs font-bold text-brand-600 dark:text-brand-400">{completedCount}/{totalCount} Steps</span>
                  </div>
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>
              </div>

              {/* Checklist Sections */}
              <div className="space-y-4">
                  {(Object.keys(groupedItems) as VettingSection[]).map(sectionKey => {
                      const items = groupedItems[sectionKey];
                      if (items.length === 0) return null;
                      const isSectionExpanded = expandedSection === sectionKey;
                      const allDone = items.every(i => i.status === 'accepted' || i.status === 'uploaded');

                      return (
                          <div key={sectionKey} className="border border-slate-200 dark:border-white/10 rounded-2xl bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
                              <button 
                                onClick={() => setExpandedSection(isSectionExpanded ? null : sectionKey)}
                                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                              >
                                  <div className="flex items-center gap-3">
                                      {allDone ? (
                                          <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><Check className="w-3.5 h-3.5" /></div>
                                      ) : (
                                          <div className="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-slate-600"></div>
                                      )}
                                      <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{SECTION_TITLES[sectionKey]}</span>
                                  </div>
                                  {isSectionExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              </button>
                              
                              {isSectionExpanded && (
                                  <div className="p-4 pt-0 space-y-4">
                                      {items.map(item => (
                                          <div key={item.id} className="pl-9 relative">
                                               {/* Connection Line */}
                                               <div className="absolute left-[11px] top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-700 -z-10"></div>
                                               
                                               <div className={`p-4 rounded-xl border transition-all ${item.status === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5'}`}>
                                                   <div className="flex justify-between items-start mb-2">
                                                       <h4 className="font-bold text-sm text-slate-900 dark:text-white">{item.label}</h4>
                                                       <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                           item.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                                           item.status === 'uploaded' ? 'bg-blue-100 text-blue-700' :
                                                           item.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                           'bg-slate-200 text-slate-600'
                                                       }`}>
                                                           {item.status === 'not_started' ? 'To Do' : item.status.replace('_', ' ')}
                                                       </span>
                                                   </div>
                                                   
                                                   <p className="text-xs text-slate-500 mb-3">{item.description}</p>
                                                   
                                                   {item.adminOnly && (
                                                       <div className="bg-purple-50 text-purple-700 text-xs p-2 rounded flex items-center gap-2 mb-2">
                                                           <Lock className="w-3 h-3" />
                                                           <span>Internal Check (No action needed)</span>
                                                       </div>
                                                   )}

                                                   {/* Render inputs if not verified/uploaded */}
                                                   {item.status !== 'accepted' && !item.adminOnly && (
                                                       <div className="space-y-3">
                                                           {renderFormFields(item)}
                                                           {item.type === 'address_history' && renderAddressSection(item)}
                                                           {item.type === 'employment_history' && renderEmploymentSection(item)}
                                                           {(item.type === 'file' || item.type === 'check') && renderFileSection(item)}
                                                       </div>
                                                   )}
                                               </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      );
                  })}
              </div>

              {/* Submit Action */}
              {!isSubmitted && (
                  <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-white/10 md:static md:bg-transparent md:border-0 z-20">
                      <div className="max-w-md mx-auto">
                          <button 
                            onClick={submitVetting} 
                            disabled={vettingItems.some(i => i.required && !i.adminOnly && i.status === 'pending')} 
                            className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg flex items-center justify-center gap-2"
                          >
                              <span>Submit for Review</span>
                              <ChevronRight className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
              )}

              {isSubmitted && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-2xl text-center border border-amber-200 dark:border-amber-900/30">
                      <Clock className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                      <p className="text-amber-800 dark:text-amber-200 font-bold text-lg">In Review</p>
                      <p className="text-amber-600 dark:text-amber-300 text-sm mt-1">Your profile is being checked by an admin. You will be notified once approved.</p>
                  </div>
              )}
          </div>
      );
  }

  // 2. STANDARD STAFF DASHBOARD (Updated with Break)
  return (
    <div className="max-w-md mx-auto space-y-8 animate-fade-in relative pb-20">
       
       <header className="flex items-center justify-between glass-panel p-6 rounded-3xl border border-slate-200 dark:border-white/10">
          <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{greeting}, {user?.name.split(' ')[0]}</h1>
              <p className="text-slate-500 text-sm">Ready to work?</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-500/20 border border-brand-200 dark:border-brand-500/50 flex items-center justify-center text-brand-600 dark:text-brand-300 font-bold text-lg shadow-sm dark:shadow-glow">
              {user?.name.charAt(0)}
          </div>
       </header>

       {/* HERO CLOCK UI */}
       <div className="relative flex justify-center py-4">
           {activeShift ? (
               <div className="relative group flex flex-col items-center gap-6">
                   <div className="relative cursor-pointer" onClick={() => setIsScanning(true)}>
                       {/* Background Glow */}
                       <div className={`absolute inset-0 rounded-full blur-[60px] opacity-20 animate-pulse-slow ${isOnBreak ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                       
                       {/* Main Circle */}
                       <div className={`w-64 h-64 rounded-full bg-white dark:bg-slate-900 border-4 flex flex-col items-center justify-center relative z-10 shadow-2xl transition-all hover:scale-105 ${isOnBreak ? 'border-amber-500/20' : 'border-green-500/20'}`}>
                           <div className={`text-xs font-bold uppercase tracking-[0.2em] mb-2 ${isOnBreak ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                               {isOnBreak ? 'ON BREAK' : 'ACTIVE SHIFT'}
                           </div>
                           <div className="text-6xl font-mono font-bold text-slate-900 dark:text-white tracking-tighter tabular-nums">
                               {duration.h}:{duration.m.toString().padStart(2, '0')}
                           </div>
                           <div className="text-slate-400 mt-1 font-medium">hrs</div>
                           
                           <div className="absolute bottom-8 flex items-center gap-2 text-white bg-red-500 px-4 py-2 rounded-full shadow-lg">
                               <StopCircle className="w-4 h-4 fill-current" />
                               <span className="text-sm font-bold">Tap to End</span>
                           </div>
                       </div>
                   </div>

                   {/* Break Controls */}
                   <button 
                       onClick={handleBreakToggle}
                       className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition transform active:scale-95 ${
                           isOnBreak 
                           ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800' 
                           : 'bg-white dark:bg-white/10 text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 hover:bg-slate-50'
                       }`}
                   >
                       <Coffee className="w-5 h-5" />
                       <span>{isOnBreak ? 'End Break' : 'Start Break'}</span>
                   </button>
               </div>
           ) : (
               <div id="staff-clock-in-btn" className="relative group cursor-pointer" onClick={() => setIsScanning(true)}>
                   <div className="absolute inset-0 bg-brand-600 rounded-full blur-[60px] opacity-20 group-hover:opacity-40 transition duration-500"></div>
                   <div className="w-64 h-64 rounded-full bg-gradient-to-br from-brand-600 to-indigo-700 flex flex-col items-center justify-center relative z-10 shadow-2xl shadow-brand-900/50 border-4 border-white/20 transition-all hover:scale-105 hover:rotate-3 active:scale-95">
                       <Play className="w-16 h-16 text-white ml-2 mb-2 fill-current" />
                       <span className="text-2xl font-bold text-white tracking-tight">Clock In</span>
                       
                       {nextScheduledShift && (
                           <div className="absolute -bottom-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl text-xs font-medium flex items-center gap-2 shadow-lg">
                               <Calendar className="w-3 h-3 text-brand-500" />
                               {new Date(nextScheduledShift.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </div>
                       )}
                   </div>
               </div>
           )}
       </div>

       {/* SCANNER MODAL (Existing) */}
       {isScanning && (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fade-in">
                <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20">
                    <div className="text-white font-bold text-lg drop-shadow-md">Scanner</div>
                    <button onClick={() => { setIsScanning(false); setCameraError(''); }} className="p-3 bg-white/10 rounded-full backdrop-blur-md text-white hover:bg-white/20 transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {cameraError ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Camera Issue</h3>
                        <p className="text-slate-400 mb-6">{cameraError}</p>
                        <button onClick={() => {setIsScanning(false); setTimeout(() => setIsScanning(true), 100)}} className="px-6 py-3 bg-white text-black rounded-xl font-bold">Retry</button>
                    </div>
                ) : (
                    <>
                        <video ref={videoRef} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                             <div className="w-72 h-72 border-2 border-brand-500 rounded-[2rem] relative shadow-[0_0_0_100vh_rgba(0,0,0,0.7)]">
                                 <div className="absolute inset-0 border-4 border-white/20 rounded-[2rem] animate-pulse"></div>
                                 <Scan className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 text-white/50" />
                             </div>
                        </div>
                        <div className="absolute bottom-12 w-full text-center z-20">
                            <span className="bg-black/60 text-white px-6 py-3 rounded-full text-sm font-medium backdrop-blur-md border border-white/10">
                                Scan Code to {activeShift ? 'Clock Out' : 'Clock In'}
                            </span>
                        </div>
                    </>
                )}
            </div>
       )}

       {/* Activity List */}
       <div className="glass-panel rounded-3xl p-6 border border-slate-200 dark:border-white/10">
           <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-900 dark:text-white text-lg">Recent History</h3>
               <button onClick={() => navigate('/staff/activity')} className="text-brand-600 dark:text-brand-400 text-sm font-semibold hover:text-brand-500">View All</button>
           </div>
           
           <div className="space-y-3">
               {shifts.slice(0, 3).map(shift => (
                   <button 
                        key={shift.id} 
                        onClick={() => navigate('/staff/activity')}
                        className="w-full group bg-white dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-brand-200 dark:hover:bg-white/10 transition-colors flex items-center justify-between shadow-sm dark:shadow-none text-left"
                    >
                       <div className="flex items-center gap-4">
                           <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold ${shift.endTime ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400'}`}>
                               <span>{new Date(shift.startTime).getDate()}</span>
                               <span className="uppercase opacity-60 text-[10px]">{new Date(shift.startTime).toLocaleString('default', { month: 'short' })}</span>
                           </div>
                           <div>
                               <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                   {shift.endTime ? `${((shift.endTime - shift.startTime) / 3600000).toFixed(1)} hrs` : 'Active Now'}
                                </p>
                               <div className="flex items-center gap-1 text-xs text-slate-500">
                                   <MapPin className="w-3 h-3" />
                                   <span>{shift.companyId ? 'Office' : 'Remote'}</span>
                               </div>
                           </div>
                       </div>
                       <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition" />
                   </button>
               ))}
               {shifts.length === 0 && (
                   <div className="text-center py-8 text-slate-500 text-sm">No activity recorded yet.</div>
               )}
           </div>
       </div>
    </div>
  );
};
