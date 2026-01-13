
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getCompany } from '../services/api';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setBrandColor: (hex: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to lighten/darken hex color
const adjustColor = (color: string, amount: number) => {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('tally_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const setBrandColor = (hex: string) => {
      const root = document.documentElement;
      
      // Simple logic to generate a palette from a single hex
      // Note: This is a basic approximation. A real color library would be better for HSL manipulation.
      // Assuming hex is roughly the 500 shade.
      
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

  useEffect(() => {
    localStorage.setItem('tally_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setBrandColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
