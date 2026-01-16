
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getCompany } from '../services/api';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  setBrandColor: (hex: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to lighten/darken hex color
const adjustColor = (color: string, amount: number) => {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<ThemeMode>(() => {
      return (localStorage.getItem('tally_theme') as ThemeMode) || 'system';
  });

  const setTheme = (newTheme: ThemeMode) => {
      setThemeState(newTheme);
      localStorage.setItem('tally_theme', newTheme);
  };

  // Apply Theme Class
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
    } else {
        root.classList.add(theme);
    }
  }, [theme]);

  const setBrandColor = (hex: string) => {
      const root = document.documentElement;
      root.style.setProperty('--brand-500', hex);
      root.style.setProperty('--brand-600', adjustColor(hex, -20)); // Darker
      root.style.setProperty('--brand-900', adjustColor(hex, -60)); // Much Darker
      root.style.setProperty('--brand-100', adjustColor(hex, 160)); // Very Light
      root.style.setProperty('--brand-50', adjustColor(hex, 180));  // Almost White
  };

  // Load brand color from user's company on startup
  useEffect(() => {
      const loadBrand = async () => {
          if (user?.currentCompanyId) {
              try {
                  const company = await getCompany(user.currentCompanyId);
                  if (company.settings.primaryColor) {
                      setBrandColor(company.settings.primaryColor);
                  }
              } catch (e) {
                  // Fallback or error suppression
              }
          }
      };
      loadBrand();
  }, [user]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, setBrandColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
