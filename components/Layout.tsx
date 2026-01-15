
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { NAVIGATION_ITEMS, APP_NAME, LOGO_URL } from '../constants';
import { LogOut, Menu, X, ChevronRight, LayoutGrid } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getCompany } from '../services/api';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [rotaEnabled, setRotaEnabled] = useState(false);

  useEffect(() => {
    const checkSettings = async () => {
        if (user?.currentCompanyId) {
            try {
                const company = await getCompany(user.currentCompanyId);
                setRotaEnabled(!!company.settings.rotaEnabled);
            } catch (e) {
                console.error("Error fetching settings", e);
            }
        }
    };
    checkSettings();
  }, [user]);

  if (location.pathname.includes('/kiosk')) {
    return <>{children}</>;
  }

  const baseNavItems = user?.role === UserRole.ADMIN 
    ? NAVIGATION_ITEMS.ADMIN 
    : NAVIGATION_ITEMS.STAFF;

  const navItems = baseNavItems.filter(item => {
      if (item.name.includes('Rota') && !rotaEnabled) return false;
      return true;
  });

  // Helper to generate ID for tutorial targeting
  const getNavId = (name: string) => {
      if (name.includes('Live Board') || name.includes('Status')) return 'nav-dashboard';
      if (name.includes('Rota')) return 'nav-rota';
      if (name.includes('Timesheets')) return 'nav-timesheets';
      if (name.includes('Activity')) return 'nav-activity';
      if (name.includes('Locations')) return 'nav-locations';
      if (name.includes('Settings')) return 'nav-settings';
      return `nav-${name.toLowerCase().replace(' ', '-')}`;
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative overflow-hidden bg-slate-900 text-slate-100 print:bg-white print:text-black">
      
      {/* --- DESKTOP SIDEBAR (Floating Dock) --- */}
      <aside className="hidden md:flex flex-col w-20 lg:w-72 fixed left-4 top-4 bottom-4 glass-panel rounded-3xl z-50 transition-all duration-300 shadow-2xl print:hidden">
        <div className="flex items-center gap-4 p-6 mb-4">
           <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-75 transition duration-200"></div>
                <img src={LOGO_URL} alt="Logo" className="relative w-10 h-10 rounded-xl object-cover bg-white" />
           </div>
           <span className="font-extrabold text-xl tracking-tight text-white hidden lg:block">{APP_NAME}</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
                <Link 
                  key={item.path} 
                  to={item.path}
                  id={getNavId(item.name)}
                  className={`group flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 relative overflow-hidden ${
                      isActive 
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="font-medium hidden lg:block tracking-wide">{item.name}</span>
                  {isActive && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-white/20 rounded-l-full"></div>}
                </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 mt-auto">
          <button 
            onClick={logout}
            className="flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-colors w-full text-left"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="hidden lg:block font-medium">Sign Out</span>
          </button>
          
          <div className="mt-4 flex items-center gap-3 px-2 lg:bg-white/5 lg:p-3 lg:rounded-2xl">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-lg">
              {user?.name.charAt(0)}
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* --- MOBILE HEADER & BOTTOM NAV --- */}
      <div className="md:hidden fixed top-0 left-0 right-0 glass-panel z-50 px-6 py-4 flex justify-between items-center border-b border-white/5 print:hidden">
        <div className="flex items-center gap-3">
           <img src={LOGO_URL} alt="Logo" className="w-8 h-8 rounded-lg bg-white" />
           <span className="font-bold text-lg text-white">{APP_NAME}</span>
        </div>
        <button onClick={logout} className="p-2 text-slate-400 hover:text-white">
            <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="md:hidden fixed bottom-0 left-0 right-0 glass-panel z-50 border-t border-white/5 pb-safe print:hidden">
          <div className="flex justify-around items-center p-2">
            {navItems.slice(0, 4).map((item) => { // Limit to 4 for mobile bar
                const isActive = location.pathname === item.path;
                return (
                    <Link 
                        key={item.path} 
                        to={item.path}
                        id={`mobile-${getNavId(item.name)}`}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl w-full transition-all ${
                            isActive ? 'text-brand-400 bg-brand-500/10' : 'text-slate-500'
                        }`}
                    >
                        <item.icon className={`w-6 h-6 mb-1 ${isActive ? 'fill-current' : ''}`} />
                        <span className="text-[10px] font-medium">{item.name}</span>
                    </Link>
                )
            })}
          </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 md:ml-24 lg:ml-80 p-6 md:p-10 pt-24 md:pt-10 pb-24 md:pb-10 min-h-screen overflow-x-hidden print:m-0 print:p-0">
        <div className="max-w-7xl mx-auto animate-fade-in print:max-w-none">
            {children}
        </div>
      </main>
    </div>
  );
};
