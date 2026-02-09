
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole } from '../types';
import { getUserProfile, createUserProfile } from '../services/api';
import { auth, googleProvider } from '../lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  sendEmailVerification,
  User as FirebaseUser
} from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password?: string, remember?: boolean) => Promise<void>; 
  loginWithGoogle: () => Promise<void>;
  loginWithMagicLink: (email: string) => Promise<void>;
  completeMagicLinkLogin: (email: string, href: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Key for local storage backup
const CACHE_KEY = 'tally_user_backup';

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  useEffect(() => {
    // 1. Enforce Long-Term Persistence
    setPersistence(auth, browserLocalPersistence).catch(console.error);

    // 2. Auth Listener
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            setIsEmailVerified(firebaseUser.emailVerified);

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
                    // Do not setUser(null) here immediately if we have a cache
                }
            } catch (e) {
                console.error("Error fetching profile", e);
            }
        } else {
            // User definitely logged out
            setUser(null);
            setIsEmailVerified(false);
            localStorage.removeItem(CACHE_KEY);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const ensureProfileExists = async (firebaseUser: FirebaseUser) => {
      let profile = await getUserProfile(firebaseUser.uid);
      
      if (!profile) {
          // Create basic shell profile for OAuth/MagicLink users
          const fullName = firebaseUser.displayName || 'Staff Member';
          const parts = fullName.split(' ');
          const firstName = parts[0] || 'Staff';
          const lastName = parts.slice(1).join(' ') || '';

          const newProfile: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              name: fullName,
              firstName: firstName,
              lastName: lastName,
              role: UserRole.STAFF, // Default to staff
              isApproved: true, // Auto-approve OAuth accounts for access, but they need company join
              vettingStatus: 'not_started',
              vettingData: []
          };
          await createUserProfile(newProfile);
          profile = newProfile;
      }
      return profile;
  };

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

  const loginWithGoogle = async () => {
      try {
          const result = await signInWithPopup(auth, googleProvider);
          const profile = await ensureProfileExists(result.user);
          setUser(profile);
          localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
      } catch (error) {
          console.error("Google Sign In Error", error);
          throw error;
      }
  };

  const loginWithMagicLink = async (email: string) => {
      // Construct a clean, absolute URL for the redirect
      // Using origin ensures protocol and host are correct (e.g. http://localhost:5173 or https://myapp.com)
      const origin = window.location.origin;
      const cleanUrl = `${origin}/#/login`;

      console.log(`Attempting Magic Link to: ${cleanUrl}`);

      const actionCodeSettings = {
          url: cleanUrl, 
          handleCodeInApp: true,
      };
      
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      // Save email for completion step
      window.localStorage.setItem('emailForSignIn', email);
  };

  const completeMagicLinkLogin = async (email: string, href: string) => {
      if (isSignInWithEmailLink(auth, href)) {
          const result = await signInWithEmailLink(auth, email, href);
          window.localStorage.removeItem('emailForSignIn');
          const profile = await ensureProfileExists(result.user);
          setUser(profile);
          localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
      } else {
          throw new Error("Invalid sign-in link");
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
        await auth.currentUser.reload();
        setIsEmailVerified(auth.currentUser.emailVerified);
    }
  };

  const sendVerificationEmail = async () => {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
          try {
              await sendEmailVerification(auth.currentUser);
          } catch (e) {
              console.error("Failed to send verification email", e);
              // Don't throw, just log
          }
      }
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        loading, 
        login, 
        loginWithGoogle, 
        loginWithMagicLink, 
        completeMagicLinkLogin, 
        logout, 
        refreshSession, 
        sendVerificationEmail, 
        isAuthenticated: !!user,
        isEmailVerified
    }}>
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
