
import React, { useEffect, useState } from 'react';
import { getCompanyStaff, updateUserProfile, updateUserRateAndActiveShift, removeUserFromCompany, getCompany } from '../services/api';
import { User, Company, UserRole, VettingItem, VettingSection } from '../types';
import { Search, Save, Edit2, X, DollarSign, Briefcase, Trash2, Download, ArrowRightLeft, Users, ShieldCheck, CheckCircle, Clock, ChevronDown, Plus, UserMinus, Hash, FileText, ExternalLink, Check, AlertOctagon, Home, Lock, AlertTriangle, ChevronUp, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TableRowSkeleton } from '../components/Skeleton';
import { deleteField } from 'firebase/firestore';

// External Verification Tools
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
    ],
    'gap_reference': [
        { label: 'HMRC Employment History', url: 'https://www.gov.uk/get-proof-employment-history' }
    ]
};

export const AdminStaff = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<User[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Edit Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [roleInput, setRoleInput] = useState('');
  const [editApproveUser, setEditApproveUser] = useState(false); 
  const [saving, setSaving] = useState(false);

  // Vetting Modal
  const [vettingUser, setVettingUser] = useState<User | null>(null);
  const [vettingExpandedSection, setVettingExpandedSection] = useState<VettingSection>('identity');

  // Bulk Update Modal
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkOldRate, setBulkOldRate] = useState('');
  const [bulkNewRate, setBulkNewRate] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  // Helper for sorting by last name
  const sortByLastName = (a: User, b: User) => {
      // Use structured names if available
      const nameA = a.lastName ? a.lastName.toLowerCase() : a.name.trim().split(' ').pop()?.toLowerCase() || '';
      const nameB = b.lastName ? b.lastName.toLowerCase() : b.name.trim().split(' ').pop()?.toLowerCase() || '';
      
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
  };

  const loadData = async () => {
    if (!user || !user.currentCompanyId) return;
    setLoading(true);
    const [staffData, companyData] = await Promise.all([
        getCompanyStaff(user.currentCompanyId),
        getCompany(user.currentCompanyId)
    ]);
    
    // Sort Staff Alphabetically by Last Name
    const sortedStaff = staffData.sort(sortByLastName);
    
    setStaff(sortedStaff);
    setCompany(companyData);
    setLoading(false);
  };

  const filteredStaff = staff.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.employeeNumber && s.employeeNumber.includes(searchTerm))
  );

  // Derive unique existing positions for the dropdown suggestions
  const allRoles = Array.from(new Set(
      staff.flatMap(u => u.roles || (u.position ? [u.position] : []))
  )).sort().filter(Boolean);

  const handleEdit = (u: User) => {
      setEditingUser(u);
      
      // Split Names Logic
      if (u.firstName && u.lastName) {
          setEditFirstName(u.firstName);
          setEditLastName(u.lastName);
      } else {
          // Fallback split for legacy users
          const parts = u.name.split(' ');
          setEditFirstName(parts[0] || '');
          setEditLastName(parts.slice(1).join(' ') || '');
      }

      setEditRate(u.customHourlyRate?.toString() || '');
      setEditEmployeeId(u.employeeNumber || '');
      // Initialize roles from roles array OR legacy position field
      setEditRoles(u.roles && u.roles.length > 0 ? u.roles : (u.position ? [u.position] : []));
      setRoleInput('');
      setEditApproveUser(u.isApproved === true); // Set initial check state
  };

  // Smart Approval: Open Edit Modal directly but visually distinct logic handled by UX
  const handleApproveClick = (u: User) => {
      // Trigger standard edit logic but force the approval tick internally
      handleEdit(u);
      setEditApproveUser(true); // Default to approving
  };

  const capitalize = (str: string) => str.replace(/\b\w/g, l => l.toUpperCase());

  const addRole = (role: string) => {
      if (role && !editRoles.includes(role)) {
          setEditRoles([...editRoles, role]);
      }
      setRoleInput('');
  };

  const removeRole = (role: string) => {
      setEditRoles(editRoles.filter(r => r !== role));
  };

  const handleSave = async () => {
      if (!editingUser || !user?.currentCompanyId) return;
      setSaving(true);
      try {
          const finalFirst = capitalize(editFirstName.trim());
          const finalLast = capitalize(editLastName.trim());
          const fullName = `${finalFirst} ${finalLast}`;

          // Flatten first role to legacy 'position' field for backward compat
          const primaryPosition = editRoles.length > 0 ? editRoles[0] : null;

          const updates: any = {
              name: fullName,
              firstName: finalFirst,
              lastName: finalLast,
              position: primaryPosition || deleteField(),
              roles: editRoles,
              employeeNumber: editEmployeeId || deleteField(),
              isApproved: editApproveUser 
          };

          let newRate: number | null = null;

          if (editRate && editRate.trim() !== '' && !isNaN(parseFloat(editRate))) {
              newRate = parseFloat(editRate);
          } 

          await updateUserRateAndActiveShift(editingUser.id, user.currentCompanyId, newRate, updates);
          
          await loadData();
          setEditingUser(null);
      } catch (e) {
          console.error(e);
          alert("Failed to update staff member.");
      } finally {
          setSaving(false);
      }
  };

  const handleDelete = async () => {
      if (!editingUser) return;
      if (confirm(`Are you sure you want to remove ${editingUser.name} from the company? They will keep their account but lose access to this team.`)) {
          setSaving(true);
          try {
            await removeUserFromCompany(editingUser.id);
            await loadData();
            setEditingUser(null);
          } catch (e) {
            console.error(e);
            alert("Failed to remove staff.");
          } finally {
            setSaving(false);
          }
      }
  };

  // Vetting Actions
  const handleVettingAction = async (itemId: string, status: 'accepted' | 'rejected' | 'pending') => {
      if (!vettingUser) return;
      
      const updatedData = vettingUser.vettingData?.map(item => {
          if (item.id === itemId) {
              if (status === 'pending') {
                  return { ...item, status, verifiedAt: undefined, verifiedBy: undefined };
              }
              return { ...item, status, verifiedAt: Date.now(), verifiedBy: user?.name };
          }
          return item;
      });

      // Optimistic Update
      setVettingUser({ ...vettingUser, vettingData: updatedData });

      await updateUserProfile(vettingUser.id, { vettingData: updatedData });
  };

  const handleCompleteVetting = async () => {
      if (!vettingUser) return;
      
      // Mark as verified
      await updateUserProfile(vettingUser.id, { vettingStatus: 'verified' });
      await loadData();
      setVettingUser(null);
  };

  // Distinct promote action (separate from general save)
  const handlePromote = async () => {
      if (!editingUser) return;
      if (!confirm(`Are you sure you want to make ${editingUser.name} an Admin? They will have full access to company settings.`)) return;
      
      setSaving(true);
      try {
          await updateUserProfile(editingUser.id, { 
              role: UserRole.ADMIN,
              isApproved: true // Implicit approval
          });
          await loadData();
          setEditingUser(null);
      } catch (e) {
          console.error(e);
          alert("Failed to promote user.");
      } finally {
          setSaving(false);
      }
  };

  const handleDemote = async () => {
      if (!editingUser) return;
      if (!confirm(`Are you sure you want to remove Admin rights from ${editingUser.name}? They will return to Staff level.`)) return;
      
      setSaving(true);
      try {
          await updateUserProfile(editingUser.id, { 
              role: UserRole.STAFF 
          });
          await loadData();
          setEditingUser(null);
      } catch (e) {
          console.error(e);
          alert("Failed to demote user.");
      } finally {
          setSaving(false);
      }
  };

  const handleBulkUpdate = async () => {
      if (!bulkOldRate || !bulkNewRate || !company || !user?.currentCompanyId) return;
      
      const oldR = parseFloat(bulkOldRate);
      const newR = parseFloat(bulkNewRate);
      
      // Find affected users (match effective rate)
      const affectedUsers = staff.filter(u => {
          const effectiveRate = u.customHourlyRate ?? company.settings.defaultHourlyRate ?? 0;
          return Math.abs(effectiveRate - oldR) < 0.01;
      });

      if (affectedUsers.length === 0) {
          alert("No staff members found with that rate.");
          return;
      }

      if (!confirm(`This will update the hourly rate for ${affectedUsers.length} staff members from ${oldR} to ${newR}. Continue?`)) return;

      setSaving(true);
      try {
          // Use the smart update for bulk actions too
          await Promise.all(affectedUsers.map(u => 
             updateUserRateAndActiveShift(u.id, user.currentCompanyId!, newR)
          ));
          await loadData();
          setIsBulkOpen(false);
          setBulkOldRate('');
          setBulkNewRate('');
      } catch (e) {
          console.error(e);
          alert("Failed to update rates.");
      } finally {
          setSaving(false);
      }
  };

  const exportUserData = () => {
     if(!editingUser) return;
     const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(editingUser, null, 2));
     const downloadAnchorNode = document.createElement('a');
     downloadAnchorNode.setAttribute("href", dataStr);
     downloadAnchorNode.setAttribute("download", `${editingUser.name.replace(' ', '_')}_data.json`);
     document.body.appendChild(downloadAnchorNode);
     downloadAnchorNode.click();
     downloadAnchorNode.remove();
  }

  const currency = company?.settings.currency || '£';

  // --- RENDER HELPERS ---
  const renderItemDetails = (item: VettingItem) => {
      return (
          <div className="space-y-3 mt-2">
              {/* Form Data Visualization */}
              {item.formFields && item.data?.formValues && (
                  <div className="grid grid-cols-2 gap-2 mb-2 bg-white dark:bg-white/5 p-2 rounded border border-slate-200 dark:border-white/10">
                      {item.formFields.map(field => (
                          <div key={field.key}>
                              <span className="block text-[10px] text-slate-400 uppercase">{field.label}</span>
                              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-mono select-all">
                                  {item.data?.formValues?.[field.key] || 'N/A'}
                              </span>
                          </div>
                      ))}
                  </div>
              )}

              {/* Address Logic */}
              {item.type === 'address_history' && item.data?.addresses && (
                  <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase">History</p>
                      {item.data.addresses.map(addr => (
                          <div key={addr.id} className="text-xs bg-white dark:bg-white/5 p-2 rounded border border-slate-200 dark:border-white/10 flex items-start gap-2">
                              <Home className="w-3 h-3 mt-0.5 text-slate-400" />
                              <div>
                                  <span className="font-bold">{addr.line1}, {addr.city} {addr.postcode}</span>
                                  <div className="text-slate-500">{addr.dateFrom} - {addr.current ? 'Present' : addr.dateTo}</div>
                              </div>
                          </div>
                      ))}
                  </div>
              )}

              {/* Employment Logic with Gaps */}
              {item.type === 'employment_history' && item.data?.employment && (
                  <div className="space-y-2">
                      <div className="flex justify-between items-center">
                          <p className="text-xs font-bold text-slate-500 uppercase">History</p>
                          <span className="text-[10px] text-blue-500 font-bold bg-blue-50 dark:bg-blue-900/20 px-2 rounded">Gap Analysis Auto-Run</span>
                      </div>
                      
                      {/* Calculate Gaps Visualization */}
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
                                          <div key={`gap-${i}`} className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-900/50 flex items-center gap-2">
                                              <AlertTriangle className="w-4 h-4 text-red-500" />
                                              <div>
                                                  <span className="text-xs font-bold text-red-600 dark:text-red-400">{Math.round(diffDays/30)} Month Gap</span>
                                                  <div className="text-[10px] text-red-500">Between {prevJob.employerName} and {job.employerName}</div>
                                              </div>
                                          </div>
                                      );
                                  }
                              }

                              timeline.push(
                                  <div key={job.id} className="text-xs bg-white dark:bg-white/5 p-2 rounded border border-slate-200 dark:border-white/10 flex items-start gap-2">
                                      <Briefcase className="w-3 h-3 mt-0.5 text-slate-400" />
                                      <div>
                                          <span className="font-bold">{job.employerName}</span> - {job.role}
                                          <div className="text-slate-500">{job.dateFrom} - {job.current ? 'Present' : job.dateTo}</div>
                                      </div>
                                  </div>
                              );
                          }
                          return timeline;
                      })()}
                  </div>
              )}

              {/* Show Files (Support for multiple) */}
              {(item.files && item.files.length > 0) && (
                  <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-500 uppercase">Documents</p>
                      {item.files.map((f, i) => (
                          <a key={i} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:underline p-1 hover:bg-blue-50 rounded">
                              <FileText className="w-3 h-3" />
                              <span>{f.name}</span>
                              <ExternalLink className="w-3 h-3 opacity-50" />
                          </a>
                      ))}
                  </div>
              )}
              {/* Legacy Single File Support */}
              {(!item.files || item.files.length === 0) && item.fileUrl && (
                  <a href={item.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-blue-600 hover:underline p-1">
                      <FileText className="w-3 h-3" />
                      <span>{item.fileName || 'View Document'}</span>
                      <ExternalLink className="w-3 h-3 opacity-50" />
                  </a>
              )}

              {/* Admin Check Resources */}
              {CHECK_RESOURCES[item.id] && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Verification Tools</p>
                      <div className="flex flex-wrap gap-2">
                          {CHECK_RESOURCES[item.id].map((res, idx) => (
                              <a 
                                  key={idx} 
                                  href={res.url} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-brand-50 hover:text-brand-600 dark:hover:text-brand-400 hover:border-brand-200 transition"
                              >
                                  <Globe className="w-3 h-3" />
                                  {res.label}
                                  <ExternalLink className="w-3 h-3 opacity-50" />
                              </a>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      );
  };

  const SECTION_TITLES: Record<string, string> = {
      identity: 'Identity & Address',
      history: 'Employment History',
      financial: 'Financial Checks',
      security: 'Security Clearance',
      qualifications: 'Qualifications'
  };

  // Group items for display
  const getGroupedVettingItems = () => {
      if (!vettingUser?.vettingData) return {};
      const groups: Record<string, VettingItem[]> = {};
      vettingUser.vettingData.forEach(item => {
          if (!groups[item.section]) groups[item.section] = [];
          groups[item.section].push(item);
      });
      return groups;
  };

  // ... (Main Render) ...
  return (
    <div className="space-y-6">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Staff Management</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage employees, roles, and pay rates.</p>
            </div>
            <button 
                id="staff-bulk-btn"
                onClick={() => setIsBulkOpen(true)}
                className="glass-panel text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-lg flex items-center space-x-2 font-medium hover:bg-slate-100 dark:hover:bg-white/10 transition"
            >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Bulk Adjust Rates</span>
            </button>
        </header>

        {/* Search */}
        <div className="glass-panel p-4 rounded-xl shadow-sm border border-slate-200 dark:border-white/10">
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search name, ID, or email..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />
            </div>
        </div>

        {/* Table */}
        <div className="glass-panel rounded-2xl shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-white/5 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">
                        <tr>
                            <th className="px-6 py-4">Employee</th>
                            <th className="px-6 py-4">Roles / Position</th>
                            <th className="px-6 py-4">Hourly Rate</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                        {loading ? (
                            <>
                                <TableRowSkeleton />
                                <TableRowSkeleton />
                            </>
                        ) : filteredStaff.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">No staff found. Share your invite code to get started.</td></tr>
                        ) : filteredStaff.map((u) => {
                            const effectiveRate = u.customHourlyRate ?? company?.settings.defaultHourlyRate ?? 0;
                            const isCustom = u.customHourlyRate !== undefined;
                            const isPending = u.isApproved === false;
                            const roles = u.roles && u.roles.length > 0 ? u.roles : (u.position ? [u.position] : []);
                            const needsVettingReview = company?.settings.vettingEnabled && u.vettingStatus === 'submitted';
                            
                            return (
                                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center space-x-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400' : 'bg-brand-50 text-brand-600 dark:bg-brand-900/50 dark:text-brand-400'}`}>
                                                {u.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center space-x-1">
                                                    <p className="font-medium text-slate-900 dark:text-white">{u.lastName ? `${u.firstName} ${u.lastName}` : u.name}</p>
                                                    {u.role === 'admin' && <ShieldCheck className="w-3 h-3 text-purple-500" />}
                                                </div>
                                                <div className="flex items-center text-xs text-slate-500">
                                                    {u.employeeNumber && <span className="mr-2 font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{u.employeeNumber}</span>}
                                                    {u.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {roles.length > 0 ? roles.map((r, i) => (
                                                <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-slate-50 text-brand-700 dark:bg-slate-900/30 dark:text-brand-300 border border-brand-100 dark:border-brand-500/20">
                                                    {r}
                                                </span>
                                            )) : <span className="text-slate-400 italic">None</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-700 dark:text-slate-300">
                                        {currency}{effectiveRate.toFixed(2)}
                                        {!isCustom && (
                                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                Default
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {isPending ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700/50">
                                                <Clock className="w-3 h-3 mr-1" /> Pending
                                            </span>
                                        ) : needsVettingReview ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50">
                                                Vetting
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/50">
                                                Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            {isPending ? (
                                                <button 
                                                    onClick={() => handleApproveClick(u)}
                                                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 transition"
                                                >
                                                    Approve
                                                </button>
                                            ) : needsVettingReview ? (
                                                <button 
                                                    onClick={() => setVettingUser(u)}
                                                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                                                >
                                                    Review Vetting
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => handleEdit(u)}
                                                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition flex items-center gap-1"
                                                >
                                                    <Edit2 className="w-3 h-3" /> Edit
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
             </div>
        </div>

        {/* Edit Modal */}
        {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                            {editingUser.isApproved === false ? 'Approve New Staff' : 'Edit Staff'}
                        </h2>
                        <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-4 mb-8">
                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">First Name</label>
                                <input 
                                    type="text" 
                                    value={editFirstName}
                                    onChange={(e) => setEditFirstName(capitalize(e.target.value))}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Last Name</label>
                                <input 
                                    type="text" 
                                    value={editLastName}
                                    onChange={(e) => setEditLastName(capitalize(e.target.value))}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* Streamlined Approval Checkbox */}
                        {editingUser.isApproved === false && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/30 p-4 rounded-xl flex items-center justify-between">
                                <div className="text-sm text-yellow-700 dark:text-yellow-400 font-medium flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Account Pending
                                </div>
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={editApproveUser} 
                                        onChange={(e) => setEditApproveUser(e.target.checked)} 
                                        className="w-5 h-5 rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500" 
                                    />
                                    <span className="ml-2 text-sm font-bold text-slate-700 dark:text-slate-300">Approve User</span>
                                </label>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Access Level</p>
                                <p className="font-bold text-slate-900 dark:text-white capitalize">{editingUser.role}</p>
                            </div>
                            {editingUser.role !== 'admin' ? (
                                <button 
                                    onClick={handlePromote}
                                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 underline"
                                >
                                    Promote to Admin
                                </button>
                            ) : (
                                <button 
                                    onClick={handleDemote}
                                    className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 underline"
                                >
                                    Demote to Staff
                                </button>
                            )}
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Roles / Positions</label>
                            
                            <div className="flex flex-wrap gap-2 mb-2">
                                {editRoles.map((role, i) => (
                                    <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-slate-50 text-brand-700 dark:bg-slate-900/30 dark:text-brand-300 border border-brand-100 dark:border-brand-500/20">
                                        {role}
                                        <button onClick={() => removeRole(role)} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
                                    </span>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="text"
                                        value={roleInput}
                                        onChange={(e) => setRoleInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addRole(roleInput);
                                            }
                                        }}
                                        list="roles-list"
                                        placeholder="Add role..."
                                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    />
                                    <datalist id="roles-list">
                                        {allRoles.map(r => <option key={r} value={r} />)}
                                    </datalist>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => addRole(roleInput)}
                                    className="px-3 py-2 text-white bg-brand-600 hover:bg-brand-700 rounded-lg font-bold"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Employee ID / Payroll #</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <input 
                                    type="text"
                                    value={editEmployeeId}
                                    onChange={(e) => setEditEmployeeId(e.target.value)}
                                    placeholder="e.g. 1045"
                                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                                />
                            </div>
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Hourly Rate</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">{currency}</span>
                                <input 
                                    type="number"
                                    step="0.01"
                                    value={editRate}
                                    onChange={(e) => setEditRate(e.target.value)}
                                    placeholder={`Default: ${company?.settings.defaultHourlyRate}`}
                                    className="w-full pl-8 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Leave empty to use company default ({currency}{company?.settings.defaultHourlyRate})</p>
                        </div>

                        <div className="pt-4 border-t border-slate-200 dark:border-white/5 flex justify-between">
                             <button onClick={exportUserData} className="text-xs text-brand-600 dark:text-brand-400 font-medium flex items-center space-x-1 hover:underline">
                                <Download className="w-3 h-3" />
                                <span>Export Data (GDPR)</span>
                             </button>
                             <button onClick={handleDelete} className="text-xs text-red-500 dark:text-red-400 font-medium flex items-center space-x-1 hover:underline">
                                <Trash2 className="w-3 h-3" />
                                <span>Remove Staff</span>
                             </button>
                        </div>
                    </div>

                     <div className="flex gap-3">
                         <button 
                            onClick={() => setEditingUser(null)}
                            className="flex-1 py-3 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition flex items-center justify-center space-x-2"
                        >
                            <Save className="w-4 h-4" />
                            <span>{saving ? 'Saving...' : (editingUser.isApproved === false && editApproveUser ? 'Confirm & Approve' : 'Save Changes')}</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Vetting Review Modal */}
        {vettingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel w-full max-w-3xl p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Review Vetting</h2>
                            <p className="text-sm text-slate-500">{vettingUser.name} ({company?.settings.vettingLevel})</p>
                        </div>
                        <button onClick={() => setVettingUser(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                        {(() => {
                            const grouped = getGroupedVettingItems();
                            return Object.keys(grouped).map(sectionKey => {
                                const items = grouped[sectionKey];
                                const isExpanded = vettingExpandedSection === sectionKey;
                                
                                return (
                                    <div key={sectionKey} className="border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                                        <button 
                                            onClick={() => setVettingExpandedSection(isExpanded ? null : sectionKey as VettingSection)}
                                            className="w-full flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-4 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition"
                                        >
                                            <span className="uppercase text-xs tracking-wider">{SECTION_TITLES[sectionKey]}</span>
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                        
                                        {isExpanded && (
                                            <div className="p-4 space-y-4 bg-white dark:bg-slate-900/50">
                                                {items.map(item => (
                                                    <div key={item.id} className="border border-slate-100 dark:border-white/5 rounded-lg p-4 relative group">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1">
                                                                <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                                                                    {item.label}
                                                                    {item.adminOnly && <span className="bg-purple-100 text-purple-700 text-[9px] px-1.5 py-0.5 rounded uppercase">Admin Check</span>}
                                                                </h4>
                                                                <p className="text-xs text-slate-500 mb-2">{item.description}</p>
                                                                
                                                                {renderItemDetails(item)}
                                                                
                                                                {item.submittedAt && <p className="text-[10px] text-slate-400 mt-2">Submitted: {new Date(item.submittedAt).toLocaleString()}</p>}
                                                                {item.verifiedAt && <p className="text-[10px] text-green-600 mt-1 font-bold">Verified by {item.verifiedBy} on {new Date(item.verifiedAt).toLocaleDateString()}</p>}
                                                            </div>
                                                            <div className="flex flex-col items-end gap-2 ml-4">
                                                                {item.status === 'accepted' ? (
                                                                    <div className="text-right">
                                                                        <span className="text-green-600 text-xs font-bold flex items-center gap-1"><Check className="w-4 h-4" /> Verified</span>
                                                                        <button onClick={() => handleVettingAction(item.id, 'pending')} className="text-[10px] text-slate-400 hover:underline mt-1">Undo</button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => handleVettingAction(item.id, 'rejected')} className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded hover:bg-red-200 dark:hover:bg-red-900/50">Reject</button>
                                                                        <button onClick={() => handleVettingAction(item.id, 'accepted')} className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded hover:bg-green-200 dark:hover:bg-green-900/50">
                                                                            {item.adminOnly ? 'Mark Complete' : 'Accept'}
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    <div className="pt-6 border-t border-slate-200 dark:border-white/5">
                        <button 
                            onClick={handleCompleteVetting}
                            disabled={vettingUser.vettingData?.some(i => i.required && i.status !== 'accepted')}
                            className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                        >
                            <ShieldCheck className="w-5 h-5" />
                            <span>Finalize Verification</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Bulk Update Modal (Unchanged) */}
        {isBulkOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                {/* ... (Same as previous) ... */}
                <div id="bulk-update-container" className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Bulk Adjust Rates</h2>
                        <button id="bulk-close-btn" onClick={() => setIsBulkOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white"><X className="w-6 h-6" /></button>
                    </div>
                    <div className="space-y-4 mb-6">
                        <p className="text-sm text-slate-500 dark:text-slate-400">Find staff on a specific rate and update them all at once.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Find Rate</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">{currency}</span>
                                    <input type="number" step="0.01" value={bulkOldRate} onChange={(e) => setBulkOldRate(e.target.value)} className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" placeholder="12.21" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Replace With</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">{currency}</span>
                                    <input type="number" step="0.01" value={bulkNewRate} onChange={(e) => setBulkNewRate(e.target.value)} className="w-full pl-7 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm" placeholder="12.56" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                         <button onClick={() => setIsBulkOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl">Cancel</button>
                        <button onClick={handleBulkUpdate} disabled={saving || !bulkOldRate || !bulkNewRate} className="flex-1 bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-70"><ArrowRightLeft className="w-4 h-4 mr-2 inline" /> Update All</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
