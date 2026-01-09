import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { User, Mail, Building, LogOut, Shield, Moon, Sun } from 'lucide-react';

export const StaffProfile = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Profile</h1>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100 dark:border-slate-700">
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
                <div>
                    <p className="text-xs text-slate-400 font-medium uppercase">Company ID</p>
                    <p className="text-slate-700 dark:text-slate-200 font-medium">{user?.currentCompanyId}</p>
                </div>
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

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 space-y-2">
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
           
           <button 
                onClick={logout}
                className="w-full flex items-center space-x-3 p-3 rounded-lg text-danger hover:bg-red-50 dark:hover:bg-red-900/10 transition font-medium"
           >
                <LogOut className="w-5 h-5" />
                <span>Sign Out</span>
           </button>
      </div>
    </div>
  );
};