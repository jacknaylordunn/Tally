
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Building, LogOut, Edit2, Key, Trash2, X, AlertTriangle, MapPin, Camera, Settings } from 'lucide-react';
import { updateUserProfile, deleteUser, switchUserCompany, getCompany } from '../services/api';
import { auth } from '../lib/firebase';
import { sendPasswordResetEmail, deleteUser as deleteAuthUser } from 'firebase/auth';

export const StaffProfile = () => {
  const { user, logout, refreshSession } = useAuth();

  // Modals State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  
  // Forms
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Permissions State
  const [locStatus, setLocStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [camStatus, setCamStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  
  const [companyName, setCompanyName] = useState('Loading...');

  useEffect(() => {
    const fetchCompany = async () => {
        if (user?.currentCompanyId) {
            try {
                const c = await getCompany(user.currentCompanyId);
                setCompanyName(c.name);
            } catch (e) {
                setCompanyName('Unknown Company');
            }
        } else {
            setCompanyName('No Company');
        }
    };
    fetchCompany();
    checkPermissions();
  }, [user]);

  // Pre-fill form when modal opens
  useEffect(() => {
      if (isEditOpen && user) {
          if (user.firstName && user.lastName) {
              setEditFirstName(user.firstName);
              setEditLastName(user.lastName);
          } else {
              // Fallback for legacy users
              const parts = user.name.split(' ');
              setEditFirstName(parts[0] || '');
              setEditLastName(parts.slice(1).join(' ') || '');
          }
      }
  }, [isEditOpen, user]);

  const checkPermissions = async () => {
      // Best effort initial check
      if (navigator.permissions && navigator.permissions.query) {
          try {
              const loc = await navigator.permissions.query({ name: 'geolocation' });
              if (loc.state === 'granted') setLocStatus('granted');
              else if (loc.state === 'denied') setLocStatus('denied');
          } catch(e) {}
      }
  };

  const capitalize = (str: string) => str.replace(/\b\w/g, l => l.toUpperCase());

  const handleEditProfile = async () => {
      if (!user) return;
      setLoading(true);
      try {
          const finalFirst = capitalize(editFirstName.trim());
          const finalLast = capitalize(editLastName.trim());
          const fullName = `${finalFirst} ${finalLast}`;

          await updateUserProfile(user.id, { 
              name: fullName,
              firstName: finalFirst,
              lastName: finalLast
          });
          await refreshSession();
          setIsEditOpen(false);
          setMsg({ type: 'success', text: 'Profile updated successfully.' });
      } catch (e) {
          setMsg({ type: 'error', text: 'Failed to update profile.' });
      } finally {
          setLoading(false);
      }
  };

  const handleJoinCompany = async () => {
      if (!user || !inviteCode) return;
      setLoading(true);
      try {
          const result = await switchUserCompany(user.id, inviteCode);
          if (result.success) {
              await refreshSession();
              setIsJoinOpen(false);
              setInviteCode('');
              setMsg({ type: 'success', text: result.message });
          } else {
              setMsg({ type: 'error', text: result.message });
          }
      } catch (e) {
          setMsg({ type: 'error', text: 'Failed to join company.' });
      } finally {
          setLoading(false);
      }
  };

  const handleResetPassword = async () => {
      if (!user) return;
      if (confirm(`Send password reset email to ${user.email}?`)) {
          try {
              await sendPasswordResetEmail(auth, user.email);
              alert("Password reset email sent. Please check your inbox.");
          } catch (e) {
              alert("Error sending reset email.");
          }
      }
  };

  const handleDeleteAccount = async () => {
      if (!user) return;
      const confirmText = prompt("Type 'DELETE' to confirm account deletion. This cannot be undone.");
      if (confirmText === 'DELETE') {
          try {
              // Delete Firestore Data
              await deleteUser(user.id);
              // Delete Auth User
              if (auth.currentUser) {
                  await deleteAuthUser(auth.currentUser);
              }
              // Auth listener will handle redirect
          } catch (e: any) {
              if (e.code === 'auth/requires-recent-login') {
                  alert("For security, please sign out and sign in again before deleting your account.");
              } else {
                  console.error(e);
                  alert("Failed to delete account.");
              }
          }
      }
  };

  const testLocation = () => {
      setLocStatus('unknown');
      navigator.geolocation.getCurrentPosition(
          () => setLocStatus('granted'),
          (err) => {
              console.error(err);
              setLocStatus('denied');
          },
          { timeout: 10000, enableHighAccuracy: true }
      );
  };

  const testCamera = async () => {
      setCamStatus('unknown');
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(t => t.stop());
          setCamStatus('granted');
      } catch (e) {
          setCamStatus('denied');
      }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>
        
      {msg && (
          <div className={`p-4 rounded-xl text-sm font-medium border ${msg.type === 'success' ? 'bg-green-100 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'}`}>
              {msg.text}
          </div>
      )}

      {/* Main Profile Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-white/10 relative">
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100 dark:border-white/5 relative">
            <button 
                onClick={() => setIsEditOpen(true)}
                className="absolute top-0 right-0 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition"
            >
                <Edit2 className="w-4 h-4" />
            </button>
            <div className="w-24 h-24 bg-gradient-to-tr from-brand-600 to-indigo-600 rounded-full flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-lg border-4 border-white dark:border-white/5">
                {user?.name.charAt(0)}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user?.name}</h2>
            <p className="text-slate-500 dark:text-slate-400 capitalize">{user?.role} Member</p>
        </div>

        <div className="pt-6 space-y-4">
            <div className="flex items-center space-x-4 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition">
                <div className="bg-slate-100 dark:bg-slate-900 p-2 rounded-lg text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5">
                    <Mail className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Email</p>
                    <p className="text-slate-900 dark:text-slate-200 font-medium">{user?.email}</p>
                </div>
            </div>

            <div className="flex items-center space-x-4 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition">
                <div className="bg-slate-100 dark:bg-slate-900 p-2 rounded-lg text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5">
                    <Building className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Company</p>
                    <p className="text-slate-900 dark:text-slate-200 font-medium">{companyName}</p>
                </div>
                <button 
                    onClick={() => setIsJoinOpen(true)}
                    className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-white px-3 py-1.5 rounded-lg transition border border-brand-200 dark:border-brand-500/30 hover:bg-brand-50 dark:hover:bg-brand-500/20"
                >
                    Switch Team
                </button>
            </div>
        </div>
      </div>

      {/* Permissions Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-white/10">
          <div className="flex items-center space-x-2 mb-4">
              <Settings className="w-5 h-5 text-slate-400" />
              <h3 className="font-bold text-slate-900 dark:text-white">Device Permissions</h3>
          </div>
          
          <div className="space-y-4">
              {/* Location Row */}
              <div className="flex flex-col space-y-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                  <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${locStatus === 'granted' ? 'bg-green-100 text-green-600' : (locStatus === 'denied' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500')} dark:bg-slate-800`}>
                              <MapPin className="w-5 h-5" />
                          </div>
                          <div>
                              <p className="font-bold text-sm text-slate-900 dark:text-white">Location</p>
                              <p className="text-xs text-slate-500">Required for GPS clock-in</p>
                          </div>
                      </div>
                      <button 
                        onClick={testLocation}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${locStatus === 'granted' ? 'bg-green-100 text-green-700' : (locStatus === 'denied' ? 'bg-red-100 text-red-700' : 'bg-brand-600 text-white hover:bg-brand-700')}`}
                      >
                          {locStatus === 'granted' ? 'Active' : (locStatus === 'denied' ? 'Check Again' : 'Enable')}
                      </button>
                  </div>

                  {/* Enhanced Help Text for Denied State */}
                  {locStatus === 'denied' && (
                      <div className="text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200 dark:border-white/10">
                          <p className="font-bold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Permission Blocked
                          </p>
                          <ol className="list-decimal pl-4 space-y-1">
                              <li>Tap the <strong>'Aa'</strong> or <strong>Lock</strong> icon in the address bar.</li>
                              <li>Select <strong>Website Settings</strong>.</li>
                              <li>Change Location to <strong>Allow</strong>.</li>
                              <li>Come back here and tap <strong>Check Again</strong>.</li>
                          </ol>
                      </div>
                  )}
              </div>

              {/* Camera Row */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                  <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${camStatus === 'granted' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'} dark:bg-slate-800`}>
                          <Camera className="w-5 h-5" />
                      </div>
                      <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">Camera</p>
                          <p className="text-xs text-slate-500">Required for scanning</p>
                      </div>
                  </div>
                  <button 
                    onClick={testCamera}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${camStatus === 'granted' ? 'bg-green-100 text-green-700' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                  >
                      {camStatus === 'granted' ? 'Active' : 'Enable'}
                  </button>
              </div>
          </div>
      </div>

      {/* Security & Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-white/10 space-y-2">
           <button 
                onClick={handleResetPassword}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition group"
            >
                <Key className="w-5 h-5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition" />
                <span className="font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">Reset Password</span>
           </button>
           
           <div className="h-px bg-slate-100 dark:bg-white/5 my-2"></div>

           <button 
                onClick={logout}
                className="w-full flex items-center space-x-3 p-3 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition font-medium"
           >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
           </button>

           <button 
                onClick={handleDeleteAccount}
                className="w-full flex items-center space-x-3 p-3 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition font-medium"
           >
                <Trash2 className="w-5 h-5" />
                <span>Delete Account</span>
           </button>
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="glass-panel w-full max-w-sm p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Profile</h3>
                      <button onClick={() => setIsEditOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-900 dark:hover:text-white" /></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">First Name</label>
                          <input 
                            type="text" 
                            value={editFirstName} 
                            onChange={(e) => setEditFirstName(capitalize(e.target.value))}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                          />
                      </div>
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Last Name</label>
                          <input 
                            type="text" 
                            value={editLastName} 
                            onChange={(e) => setEditLastName(capitalize(e.target.value))}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none"
                          />
                      </div>
                      <button 
                        onClick={handleEditProfile}
                        disabled={loading}
                        className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 transition"
                      >
                          {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Join Company Modal */}
      {isJoinOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
              <div className="glass-panel w-full max-w-sm p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">Join New Team</h3>
                      <button onClick={() => setIsJoinOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-900 dark:hover:text-white" /></button>
                  </div>
                  <div className="space-y-4">
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg flex items-start space-x-2 text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <p>You will leave your current company. Past shifts will remain in history, but you will no longer be able to clock in for them.</p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">Company Invite Code</label>
                          <input 
                            type="text" 
                            value={inviteCode} 
                            onChange={(e) => setInviteCode(e.target.value)}
                            placeholder="e.g. AMS-999"
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-500 outline-none uppercase tracking-wider"
                          />
                      </div>
                      <button 
                        onClick={handleJoinCompany}
                        disabled={loading || !inviteCode}
                        className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 transition"
                      >
                          {loading ? 'Joining...' : 'Join Team'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
