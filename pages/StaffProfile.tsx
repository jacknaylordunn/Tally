
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { User, Mail, Building, LogOut, Shield, Moon, Sun, Edit2, Key, Trash2, ArrowRightLeft, X, Save, AlertTriangle } from 'lucide-react';
import { updateUserProfile, deleteUser, switchUserCompany } from '../services/api';
import { auth } from '../lib/firebase';
import { sendPasswordResetEmail, deleteUser as deleteAuthUser } from 'firebase/auth';

export const StaffProfile = () => {
  const { user, logout, refreshSession } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Modals State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  
  // Forms
  const [newName, setNewName] = useState(user?.name || '');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleEditProfile = async () => {
      if (!user) return;
      setLoading(true);
      try {
          await updateUserProfile(user.id, { name: newName });
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

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>
        
      {msg && (
          <div className={`p-4 rounded-xl text-sm font-medium ${msg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {msg.text}
          </div>
      )}

      {/* Main Profile Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100 dark:border-slate-700 relative">
            <button 
                onClick={() => setIsEditOpen(true)}
                className="absolute top-0 right-0 p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition"
            >
                <Edit2 className="w-4 h-4" />
            </button>
            <div className="w-24 h-24 bg-brand-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-3xl font-bold text-brand-600 dark:text-brand-400 mb-4">
                {user?.name.charAt(0)}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{user?.name}</h2>
            <p className="text-slate-500 capitalize">{user?.role} Member</p>
        </div>

        <div className="pt-6 space-y-4">
            <div className="flex items-center space-x-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition">
                <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500">
                    <Mail className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs text-slate-400 font-medium uppercase">Email</p>
                    <p className="text-slate-700 dark:text-slate-200 font-medium">{user?.email}</p>
                </div>
            </div>

            <div className="flex items-center space-x-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition">
                <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500">
                    <Building className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <p className="text-xs text-slate-400 font-medium uppercase">Company ID</p>
                    <p className="text-slate-700 dark:text-slate-200 font-medium">{user?.currentCompanyId}</p>
                </div>
                <button 
                    onClick={() => setIsJoinOpen(true)}
                    className="text-xs font-bold text-brand-600 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition border border-brand-200"
                >
                    Switch Team
                </button>
            </div>

             <div className="flex items-center space-x-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition">
                <div className="bg-slate-100 dark:bg-slate-700 p-2 rounded-lg text-slate-500">
                    <Shield className="w-5 h-5" />
                </div>
                <div>
                    <p className="text-xs text-slate-400 font-medium uppercase">Access Level</p>
                    <p className="text-slate-700 dark:text-slate-200 font-medium capitalize">{user?.role}</p>
                </div>
            </div>
        </div>
      </div>

      {/* Security & Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 space-y-2">
           <button 
                onClick={handleResetPassword}
                className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
                <Key className="w-5 h-5 text-slate-500" />
                <span className="font-medium text-slate-700 dark:text-slate-200">Reset Password</span>
           </button>

           <button 
                onClick={toggleTheme}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              <div className="flex items-center space-x-3">
                  {theme === 'dark' ? <Moon className="w-5 h-5 text-slate-500" /> : <Sun className="w-5 h-5 text-slate-500" />}
                  <span className="font-medium text-slate-700 dark:text-slate-200">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
              </div>
              <div className={`relative inline-block w-12 h-6 rounded-full transition-colors duration-200 ease-in-out ${theme === 'dark' ? 'bg-brand-600' : 'bg-slate-200'}`}>
                  <span className={`absolute left-1 top-1 block w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out ${theme === 'dark' ? 'translate-x-6' : 'translate-x-0'}`}></span>
              </div>
           </button>
           
           <div className="h-px bg-slate-100 dark:bg-slate-700 my-2"></div>

           <button 
                onClick={logout}
                className="w-full flex items-center space-x-3 p-3 rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition font-medium"
           >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
           </button>

           <button 
                onClick={handleDeleteAccount}
                className="w-full flex items-center space-x-3 p-3 rounded-lg text-danger hover:bg-red-50 dark:hover:bg-red-900/10 transition font-medium"
           >
                <Trash2 className="w-5 h-5" />
                <span>Delete Account</span>
           </button>
      </div>

      {/* Edit Modal */}
      {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-800 w-full max-w-sm p-6 rounded-2xl shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">Edit Profile</h3>
                      <button onClick={() => setIsEditOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Full Name</label>
                          <input 
                            type="text" 
                            value={newName} 
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900"
                          />
                      </div>
                      <button 
                        onClick={handleEditProfile}
                        disabled={loading}
                        className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700"
                      >
                          {loading ? 'Saving...' : 'Save Changes'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Join Company Modal */}
      {isJoinOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-800 w-full max-w-sm p-6 rounded-2xl shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">Join New Team</h3>
                      <button onClick={() => setIsJoinOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  <div className="space-y-4">
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg flex items-start space-x-2 text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <p>You will leave your current company. Past shifts will remain in history, but you will no longer be able to clock in for them.</p>
                      </div>
                      <div>
                          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Company Invite Code</label>
                          <input 
                            type="text" 
                            value={inviteCode} 
                            onChange={(e) => setInviteCode(e.target.value)}
                            placeholder="e.g. AMS-999"
                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 uppercase tracking-wider"
                          />
                      </div>
                      <button 
                        onClick={handleJoinCompany}
                        disabled={loading || !inviteCode}
                        className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50"
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
