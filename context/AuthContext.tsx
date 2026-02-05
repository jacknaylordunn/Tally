
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getUserProfile } from '../services/api';
import { auth } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password?: string, remember?: boolean) => Promise<void>; 
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Key for local storage backup
const CACHE_KEY = 'tally_user_backup';

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Enforce Long-Term Persistence
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    // 2. Auth Listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            // A. Optimistic Load: Check Local Storage first to prevent UI flicker
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (cachedData && !user) {
                try {
                    const parsedUser = JSON.parse(cachedData);
                    if (parsedUser.id === firebaseUser.uid) {
                        setUser(parsedUser);
                    }
                } catch (e) {
                    console.error("Cache parse error", e);
                }
            }

            // B. Network/Firestore Fetch (The Source of Truth)
            try {
                let profile = await getUserProfile(firebaseUser.uid);
                
                // Retry logic for registration race conditions
                if (!profile) {
                    console.warn("User authenticated but profile not found. Retrying...");
                    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s
                    profile = await getUserProfile(firebaseUser.uid);
                }

                if (profile) {
                    setUser(profile);
                    localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
                } else {
                    console.error("Profile missing after retry.");
                    // Do not setUser(null) here immediately if we have a cache, 
                    // but if cache was empty, user stays null and app will redirect to login.
                }
            } catch (e) {
                console.error("Error fetching profile", e);
            }
        } else {
            // User definitely logged out
            setUser(null);
            localStorage.removeItem(CACHE_KEY);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password?: string, remember: boolean = true) => {
    if (!password) throw new Error("Password required");
    
    const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    
    const credential = await signInWithEmailAndPassword(auth, email, password);
    
    // Immediate fetch to prime state
    const profile = await getUserProfile(credential.user.uid);
    if (profile) {
        setUser(profile);
        localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    localStorage.removeItem(CACHE_KEY);
  };

  const refreshSession = async () => {
    if (auth.currentUser) {
        const profile = await getUserProfile(auth.currentUser.uid);
        if (profile) {
            setUser(profile);
            localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
        }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshSession, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
