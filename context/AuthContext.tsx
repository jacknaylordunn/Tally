
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
            // A. Optimistic Load: Check Local Storage first to prevent UI flicker/redirect
            const cachedData = localStorage.getItem(CACHE_KEY);
            if (cachedData) {
                try {
                    const parsedUser = JSON.parse(cachedData);
                    // Only use cache if it matches current auth user
                    if (parsedUser.id === firebaseUser.uid) {
                        setUser(parsedUser);
                    }
                } catch (e) {
                    console.error("Cache parse error", e);
                }
            }

            // B. Network/Firestore Fetch (The Source of Truth)
            try {
                const profile = await getUserProfile(firebaseUser.uid);
                
                if (profile) {
                    setUser(profile);
                    // Update cache with fresh data
                    localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
                } else {
                    // Rare edge case: Auth exists but Firestore profile missing
                    console.warn("User authenticated but profile not found.");
                    
                    // Retry once after delay (fixes race conditions on new account creation)
                    setTimeout(async () => {
                        const retry = await getUserProfile(firebaseUser.uid);
                        if (retry) {
                            setUser(retry);
                            localStorage.setItem(CACHE_KEY, JSON.stringify(retry));
                        }
                    }, 2000);
                }
            } catch (e) {
                console.error("Error fetching profile", e);
                // If fetch fails (offline), we rely on the cached user set in step A.
                // If no cache and no network, user stays technically logged in via Firebase SDK
                // but might lack profile data until connection restores.
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
