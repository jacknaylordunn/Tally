
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

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize Persistence immediately
  useEffect(() => {
    // Ensure we default to local persistence for existing sessions to prevent Safari drift
    setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence init error:", err));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            try {
                // Fetch internal profile
                const profile = await getUserProfile(firebaseUser.uid);
                
                if (profile) {
                    setUser(profile);
                } else {
                    // Retry once after a delay if profile is missing (race condition fix)
                    console.warn("Profile not found immediately, retrying...");
                    setTimeout(async () => {
                        try {
                            const retryProfile = await getUserProfile(firebaseUser.uid);
                            if (retryProfile) setUser(retryProfile);
                            else console.error("User authenticated but profile permanently missing.");
                        } catch (e) {
                            console.error("Retry profile fetch failed", e);
                        }
                    }, 1000);
                }
            } catch (e) {
                console.error("Error fetching profile", e);
                // Important: We do NOT force logout here. 
                // If offline persistence works, we get the profile. 
                // If it fails, we keep the user logged in but maybe with limited data, 
                // though usually the UI will just wait or retry.
            }
        } else {
            setUser(null);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password?: string, remember: boolean = true) => {
    if (!password) throw new Error("Password required");
    
    // Set Persistence based on 'Remember Me' choice
    const persistence = remember 
        ? browserLocalPersistence 
        : browserSessionPersistence;
        
    await setPersistence(auth, persistence);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const refreshSession = async () => {
    if (auth.currentUser) {
        const profile = await getUserProfile(auth.currentUser.uid);
        setUser(profile);
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
