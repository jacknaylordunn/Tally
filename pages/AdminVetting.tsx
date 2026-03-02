
import React, { useEffect, useState } from 'react';
import { getCompanyStaff, updateUserProfile, purgeVettingData, getCompany } from '../services/api';
import { User, Company, VettingItem, VettingSection } from '../types';
import { Search, Filter, ShieldCheck, Check, X, AlertOctagon, FileText, ExternalLink, ChevronDown, ChevronUp, Lock, Trash2, Home, Briefcase, AlertTriangle, Globe, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TableRowSkeleton } from '../components/Skeleton';

// Verification Helper Links
const CHECK_RESOURCES: Record<string, { label: string; url: string }[]> = {
    'sia_license': [
        { label: 'Check SIA Register', url: 'https://services.sia.homeoffice.gov.uk/ROL/' }
    ],
    'right_to_work': [
        { label: 'Check Share Code', url: 'https://www.gov.uk/view-right-to-work' }
    ],
    'id_check': [
        { label: 'Validate Identity Docs', url: 'https://www.gov.uk/validate-identity-document-for-employers' }
    ],
    'financial_bankruptcy': [
        { label: 'Search Insolvency Register', url: 'https://www.gov.uk/search-bankruptcy-insolvency-register' }
    ],
    'criminal_basic': [
        { label: 'Verify DBS Certificate', url: 'https://secure.crbonline.gov.uk/crsc/check?execution=e1s1' }
    ]
};

const SECTION_TITLES: Record<string, string> = {
    identity: 'Identity & Address',
    history: 'Employment History',
    financial: 'Financial Checks',
    security: 'Security Clearance',
    qualifications: 'Qualifications'
};

export const AdminVetting = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'verified' | 'pending'>('submitted');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [expandedSection, setExpandedSection] = useState<VettingSection>('identity');
  const [adminOverride, setAdminOverride] = useState(false);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user || !user.currentCompanyId) return;
    setLoading(true);
    const staffData = await getCompanyStaff(user.currentCompanyId);
    // Sort by: Submitted first, then In Progress, then Verified
    setStaff(staffData.sort((a,b) => {
        const score = (s: string | undefined) => s === 'submitted' ? 3 : s === 'in_progress' ? 2 : 1;
        return score(b.vettingStatus) - score(a.vettingStatus);
    }));
    setLoading(false);
  };

  const filteredStaff = staff.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const status = s.vettingStatus || 'not_started';
      
      let matchesFilter = true;
      if (filterStatus === 'submitted') matchesFilter = status === 'submitted';
      if (filterStatus === 'verified') matchesFilter = status === 'verified';
      if (filterStatus === 'pending') matchesFilter = status === 'in_progress' || status === 'not_started';

      return matchesSearch && matchesFilter;
  });

  const handleVettingAction = async (targetUser: User, itemId: string, status: 'accepted' | 'rejected' | 'pending') => {
      const updatedData = targetUser.vettingData?.map(item => {
          if (item.id === itemId) {
              if (status === 'pending') {
                  return { ...item, status, verifiedAt: undefined, verifiedBy: undefined };
              }
              return { ...item, status, verifiedAt: Date.now(), verifiedBy: user?.name || 'Admin' };
          }
          return item;
      });

      // Optimistic Update
      const updatedUser = { ...targetUser, vettingData: updatedData };
      setSelectedUser(updatedUser);
      setStaff(prev => prev.map(u => u.id === targetUser.id ? updatedUser : u));

      await updateUserProfile(targetUser.id, { vettingData: updatedData });
  };

  const handleFinalize = async () => {
      if (!selectedUser) return;
      const allVerified = selectedUser.vettingData?.every(i => i.status === 'accepted' || (!i.required));
      
      if (!allVerified && !adminOverride) {
          alert("Cannot finalize. Not all required checks are verified.");
          return;
      }

      await updateUserProfile(selectedUser.id, { vettingStatus: 'verified' });
      
      // Update local
      const updatedUser = { ...selectedUser, vettingStatus: 'verified' as const };
      setSelectedUser(updatedUser);
      setStaff(prev => prev.map(u => u.id === selectedUser.id ? updatedUser : u));
      alert("Vetting finalized. User marked as verified.");
  };

  const handlePurgeData = async () => {
      if (!selectedUser) return;
      const confirmText = prompt(`Type 'DELETE' to confirm deletion of all vetting documents for ${selectedUser.name}. This helps comply with GDPR/Right to be Forgotten.`);
      
      if (confirmText === 'DELETE') {
          await purgeVettingData(selectedUser.id, selectedUser.vettingData || []);
          setSelectedUser(null);
          loadData();
          alert("Vetting data purged successfully.");
      }
  };

  const renderItemDetails = (item: VettingItem) => {
      return (
          <div className="space-y-3 mt-3 pl-4 border-l-2 border-slate-100 dark:border-white/5">
              {/* Instructions shown to user */}
              {item.instruction && <p className="text-xs text-slate-400 italic mb-2">User Instruction: {item.instruction}</p>}

              {/* Form Data */}
              {item.formFields && item.data?.formValues && (
                  <div className="grid grid-cols-2 gap-4 mb-2 bg-slate-50 dark:bg-black/20 p-3 rounded-lg border border-slate-100 dark:border-white/5">
                      {item.formFields.map(field => (
                          <div key={field.key}>
                              <span className="block text-[10px] text-slate-400 uppercase font-bold">{field.label}</span>
                              <span className="text-sm font-mono text-slate-800 dark:text-slate-200 select-all">
                                  {item.data?.formValues?.[field.key] || 'N/A'}
                              </span>
                          </div>
                      ))}
                  </div>
              )}

              {/* Address History */}
              {item.type === 'address_history' && item.data?.addresses && (
                  <div className="space-y-2">
                      {item.data.addresses.map(addr => (
                          <div key={addr.id} className="text-xs flex items-start gap-2 text-slate-600 dark:text-slate-300">
                              <Home className="w-3 h-3 mt-0.5 text-slate-400" />
                              <span>
                                  <strong className="text-slate-900 dark:text-white">{addr.line1}, {addr.city} {addr.postcode}</strong>
                                  <br/>
                                  <span className="opacity-70">{addr.dateFrom} - {addr.current ? 'Present' : addr.dateTo}</span>
                              </span>
                          </div>
                      ))}
                  </div>
              )}

              {/* Employment History + Gap Analysis */}
              {item.type === 'employment_history' && item.data?.employment && (
                  <div className="space-y-2">
                      {(() => {
                          const sortedJobs = [...item.data?.employment || []].sort((a,b) => a.dateFrom.localeCompare(b.dateFrom));
                          const timeline = [];
                          
                          for(let i=0; i < sortedJobs.length; i++) {
                              const job = sortedJobs[i];
                              const prevJob = sortedJobs[i-1];
                              
                              // Gap Check
                              if (prevJob) {
                                  const prevEnd = prevJob.current ? new Date() : new Date(prevJob.dateTo!);
                                  const currStart = new Date(job.dateFrom);
                                  const diffTime = Math.abs(currStart.getTime() - prevEnd.getTime());
                                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                                  
                                  if (diffDays > 31) {
                                      timeline.push(
                                          <div key={`gap-${i}`} className="bg-red-50 dark:bg-red-900/20 p-2 rounded text-xs flex items-center gap-2 text-red-600 border border-red-100 dark:border-red-900/30">
                                              <AlertTriangle className="w-3 h-3" />
                                              <span><strong>Gap: {Math.round(diffDays/30)} Months</strong> ({prevJob.employerName} ➝ {job.employerName})</span>
                                          </div>
                                      );
                                  }
                              }

                              timeline.push(
                                  <div key={job.id} className="text-xs flex items-start gap-2 text-slate-600 dark:text-slate-300">
                                      <Briefcase className="w-3 h-3 mt-0.5 text-slate-400" />
                                      <span>
                                          <strong className="text-slate-900 dark:text-white">{job.employerName}</strong> - {job.role}
                                          <br/>
                                          <span className="opacity-70">{job.dateFrom} - {job.current ? 'Present' : job.dateTo}</span>
                                      </span>
                                  </div>
                              );
                          }
                          return timeline;
                      })()}
                  </div>
              )}

              {/* Documents */}
              {(item.files && item.files.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                      {item.files.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs bg-slate-100 dark:bg-white/10 px-3 py-2 rounded-lg hover:bg-brand-50 hover:text-brand-600 transition border border-slate-200 dark:border-white/10">
                              <FileText className="w-3 h-3" />
                              <span className="truncate max-w-[150px]">{f.name}</span>
                              <ExternalLink className="w-3 h-3 opacity-50" />
                          </a>
                      ))}
                  </div>
              )}

              {/* External Checks */}
              {CHECK_RESOURCES[item.id] && (
                  <div className="flex gap-2 mt-2">
                      {CHECK_RESOURCES[item.id].map((res, idx) => (
                          <a key={idx} href={res.url} target="_blank" rel="noreferrer" className="text-[10px] font-bold uppercase text-brand-600 hover:underline flex items-center gap-1 bg-brand-50 dark:bg-brand-900/10 px-2 py-1 rounded">
                              <Globe className="w-3 h-3" /> {res.label}
                          </a>
                      ))}
                  </div>
              )}
          </div>
      );
  };

  const getGroupedItems = () => {
      if (!selectedUser?.vettingData) return {};
      const groups: Record<string, VettingItem[]> = {};
      selectedUser.vettingData.forEach(item => {
          if (!groups[item.section]) groups[item.section] = [];
          groups[item.section].push(item);
      });
      return groups;
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6">
        
        {/* LEFT LIST */}
        <div className="w-1/3 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Vetting Queue</h2>
                    <span className="text-xs font-bold bg-slate-100 dark:bg-white/10 px-2 py-1 rounded text-slate-500">{filteredStaff.length}</span>
                </div>
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button onClick={() => setFilterStatus('submitted')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${filterStatus === 'submitted' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-700 dark:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Review</button>
                    <button onClick={() => setFilterStatus('pending')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${filterStatus === 'pending' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-700 dark:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Pending</button>
                    <button onClick={() => setFilterStatus('verified')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${filterStatus === 'verified' ? 'bg-white dark:bg-slate-700 shadow-sm text-green-700 dark:text-white' : 'text-slate-500 hover:text-slate-900'}`}>Done</button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search name..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm outline-none focus:border-brand-500"
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {loading ? <TableRowSkeleton /> : filteredStaff.map(u => {
                    const totalItems = u.vettingData?.length || 0;
                    const acceptedItems = u.vettingData?.filter(i => i.status === 'accepted').length || 0;
                    
                    return (
                        <div 
                            key={u.id}
                            onClick={() => setSelectedUser(u)}
                            className={`p-3 rounded-xl border cursor-pointer transition relative overflow-hidden ${selectedUser?.id === u.id ? 'bg-brand-50 border-brand-500 dark:bg-brand-900/20 dark:border-brand-500' : 'bg-white dark:bg-slate-800 border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}
                        >
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{u.name}</h4>
                                    <div className="flex items-center gap-2 mt-1">
                                        {u.vettingStatus === 'submitted' && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Ready</span>}
                                        <span className="text-xs text-slate-500">{acceptedItems}/{totalItems} Checks</span>
                                    </div>
                                </div>
                                {u.vettingStatus === 'verified' ? (
                                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400"><Check className="w-3 h-3" /></div>
                                ) : (
                                    <div className="w-6 h-6 bg-slate-100 dark:bg-white/10 rounded-full flex items-center justify-center text-slate-400"><Clock className="w-3 h-3" /></div>
                                )}
                            </div>
                            {/* Progress Bar Background */}
                            <div className="absolute bottom-0 left-0 h-1 bg-slate-100 dark:bg-white/5 w-full">
                                <div className="h-full bg-brand-500 transition-all" style={{ width: `${(acceptedItems/totalItems)*100}%` }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* RIGHT DETAIL */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm flex flex-col">
            {selectedUser ? (
                <>
                    <div className="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-start bg-slate-50 dark:bg-black/20">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedUser.name}</h2>
                            <p className="text-sm text-slate-500 mb-2">{selectedUser.email} • {selectedUser.employeeNumber || 'No ID'}</p>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase flex items-center gap-1 ${selectedUser.vettingStatus === 'verified' ? 'bg-green-100 text-green-700' : selectedUser.vettingStatus === 'submitted' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {selectedUser.vettingStatus === 'verified' ? <ShieldCheck className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
                                    {selectedUser.vettingStatus || 'Not Started'}
                                </span>
                                {selectedUser.vettingLastUpdated && (
                                    <span className="text-xs text-slate-400">Last Activity: {new Date(selectedUser.vettingLastUpdated).toLocaleDateString()}</span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <button onClick={handlePurgeData} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-3 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition border border-transparent hover:border-red-200">
                                <Trash2 className="w-3 h-3" /> Purge Data (GDPR)
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                        {!selectedUser.vettingData || selectedUser.vettingData.length === 0 ? (
                            <div className="text-center py-12 text-slate-500">
                                <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>No vetting data initialized for this user.</p>
                            </div>
                        ) : (
                            Object.entries(getGroupedItems()).map(([section, items]) => (
                                <div key={section} className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm">
                                    <button 
                                        onClick={() => setExpandedSection(prev => prev === section ? null : section as VettingSection)}
                                        className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wide">{SECTION_TITLES[section]}</span>
                                            <span className="text-xs text-slate-400 font-normal">({items.filter(i => i.status === 'accepted').length}/{items.length})</span>
                                        </div>
                                        {expandedSection === section ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    
                                    {expandedSection === section && (
                                        <div className="p-4 space-y-4 bg-white dark:bg-slate-900">
                                            {items.map(item => (
                                                <div key={item.id} className={`border rounded-lg p-4 relative transition-colors ${item.status === 'accepted' ? 'border-green-200 bg-green-50/30 dark:border-green-900/30 dark:bg-green-900/5' : 'border-slate-100 dark:border-white/5'}`}>
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{item.label}</h4>
                                                                {item.adminOnly && <span className="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Internal Check</span>}
                                                            </div>
                                                            <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                                                            {renderItemDetails(item)}
                                                        </div>
                                                        <div className="ml-4 flex flex-col gap-2 min-w-[110px]">
                                                            {item.status === 'accepted' ? (
                                                                <div className="text-right">
                                                                    <div className="text-green-600 font-bold text-xs flex items-center justify-end gap-1"><CheckCircle2 className="w-4 h-4" /> Verified</div>
                                                                    <button onClick={() => handleVettingAction(selectedUser, item.id, 'pending')} className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:underline mt-1">Undo</button>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => handleVettingAction(selectedUser, item.id, 'accepted')} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition shadow-sm">
                                                                        {item.adminOnly ? 'Pass Check' : 'Accept'}
                                                                    </button>
                                                                    <button onClick={() => handleVettingAction(selectedUser, item.id, 'rejected')} className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                                                                        Reject
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20">
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={adminOverride} 
                                    onChange={e => setAdminOverride(e.target.checked)}
                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4" 
                                />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Force Approve (Override Checks)</span>
                            </label>
                            
                            <button 
                                onClick={handleFinalize}
                                disabled={!adminOverride && selectedUser.vettingData?.some(i => i.required && i.status !== 'accepted')}
                                className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                            >
                                <ShieldCheck className="w-5 h-5" />
                                <span>Finalize & Verify User</span>
                            </button>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8" />
                    </div>
                    <p className="font-medium">Select a staff member to review.</p>
                </div>
            )}
        </div>
    </div>
  );
};
