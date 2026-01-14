
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getCompany } from '../services/api';

interface ThemeContextType {
  setBrandColor: (hex: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper to lighten/darken hex color
const adjustColor = (color: string, amount: number) => {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Enforce Dark Mode on Mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
    // Ensure body background matches the dark theme (Slate-950)
    document.body.style.backgroundColor = '#020617'; 
  }, []);

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
    <ThemeContext.Provider value={{ setBrandColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
