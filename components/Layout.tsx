
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { NAVIGATION_ITEMS } from '../constants';
import { LogOut, Menu, X, ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // If kiosk mode, don't show layout chrome
  if (location.pathname.includes('/kiosk')) {
    return <>{children}</>;
  }

  const navItems = user?.role === UserRole.ADMIN 
    ? NAVIGATION_ITEMS.ADMIN 
    : NAVIGATION_ITEMS.STAFF;

  return (
    <div className="min-h-screen flex bg-[#f8fafc] dark:bg-[#0b1120]">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 p-4 z-50 flex justify-between items-center">
        <div className="flex items-center space-x-2">
           <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/30">T</div>
           <span className="font-bold text-lg text-slate-900 dark:text-white tracking-tight">Tally</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-500">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white dark:bg-slate-900 pt-20 px-6 space-y-2 animate-in slide-in-from-top-10 duration-200">
           {navItems.map((item) => (
             <Link 
               key={item.path} 
               to={item.path}
               onClick={() => setMobileMenuOpen(false)}
               className={`flex items-center space-x-4 p-4 rounded-2xl transition-all ${
                   location.pathname === item.path 
                   ? 'bg-brand-50 dark:bg-slate-800 text-brand-600 font-semibold' 
                   : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
               }`}
             >
               <item.icon className={`w-5 h-5 ${location.pathname === item.path ? 'text-brand-500' : 'text-slate-400'}`} />
               <span>{item.name}</span>
             </Link>
           ))}
           <div className="pt-8 mt-8 border-t border-slate-100 dark:border-slate-800">
               <button onClick={logout} className="flex items-center space-x-4 p-4 w-full text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-colors">
                  <LogOut className="w-5 h-5" />
                  <span>Sign Out</span>
               </button>
           </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 h-screen sticky top-0 py-8 px-6">
        <div className="flex items-center space-x-3 mb-12 px-2">
           <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/20">T</div>
           <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">Tally</span>
        </div>
        
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
                <Link 
                  key={item.path} 
                  to={item.path}
                  className={`group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive 
                      ? 'bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white font-medium' 
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                      <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-brand-500' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                      <span>{item.name}</span>
                  </div>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>}
                </Link>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3 mb-6 px-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-100 to-blue-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-brand-600 dark:text-white font-bold text-sm">
              {user?.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.role === 'admin' ? 'Administrator' : 'Staff Member'}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center space-x-3 px-4 py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors w-full text-left text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto pt-24 md:pt-12">
        <div className="max-w-6xl mx-auto animate-fade-in">
            {children}
        </div>
      </main>
    </div>
  );
};
