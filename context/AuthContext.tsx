
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
  registerWithGoogle: (profileData: Partial<User>) => Promise<void>;
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

            // A. Optimistic Load
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

            // B. Network/Firestore Fetch
            try {
                let profile = await getUserProfile(firebaseUser.uid);
                
                if (profile) {
                    setUser(profile);
                    localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
                } else {
                    // Profile doesn't exist yet (could be midway through registration)
                    // We do NOT auto-create here. User stays null until profile is created.
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

  const login = async (email: string, password?: string, remember: boolean = true) => {
    if (!password) throw new Error("Password required");
    
    const persistence = remember ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    
    const credential = await signInWithEmailAndPassword(auth, email, password);
    
    // Strict check: Profile must exist
    const profile = await getUserProfile(credential.user.uid);
    if (!profile) {
        await signOut(auth);
        throw new Error("ACCOUNT_NOT_FOUND");
    }
    
    setUser(profile);
    localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  };

  // Login ONLY - Fails if no profile
  const loginWithGoogle = async () => {
      try {
          const result = await signInWithPopup(auth, googleProvider);
          const profile = await getUserProfile(result.user.uid);
          
          if (!profile) {
              await result.user.delete().catch(() => signOut(auth));
              throw new Error("ACCOUNT_NOT_FOUND");
          }

          setUser(profile);
          localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
      } catch (error: any) {
          console.error("Google Sign In Error", error);
          if (error.message === "ACCOUNT_NOT_FOUND") throw error;
          throw error;
      }
  };

  // Registration ONLY - Creates profile
  const registerWithGoogle = async (profileData: Partial<User>) => {
      try {
          const result = await signInWithPopup(auth, googleProvider);
          const firebaseUser = result.user;

          // Safety check: If profile already exists, just log in
          const existingProfile = await getUserProfile(firebaseUser.uid);
          if (existingProfile) {
              setUser(existingProfile);
              localStorage.setItem(CACHE_KEY, JSON.stringify(existingProfile));
              return;
          }

          // Create new profile
          const newProfile: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              name: profileData.name || firebaseUser.displayName || 'Staff Member',
              firstName: profileData.firstName || 'Staff',
              lastName: profileData.lastName || '',
              role: profileData.role || UserRole.STAFF,
              currentCompanyId: profileData.currentCompanyId,
              isApproved: profileData.isApproved ?? true,
              vettingStatus: profileData.vettingStatus,
              vettingData: []
          };

          await createUserProfile(newProfile);
          setUser(newProfile);
          localStorage.setItem(CACHE_KEY, JSON.stringify(newProfile));

      } catch (error) {
          console.error("Google Registration Error", error);
          throw error;
      }
  };

  const loginWithMagicLink = async (email: string) => {
      const origin = window.location.origin;
      const cleanUrl = `${origin}/#/login`;

      console.log(`[Auth] Preparing Magic Link. Redirect URL: ${cleanUrl}`);

      const actionCodeSettings = {
          url: cleanUrl, 
          handleCodeInApp: true,
      };
      
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
  };

  const completeMagicLinkLogin = async (email: string, href: string) => {
      if (isSignInWithEmailLink(auth, href)) {
          const result = await signInWithEmailLink(auth, email, href);
          window.localStorage.removeItem('emailForSignIn');
          
          // Strict check: Profile must exist
          const profile = await getUserProfile(result.user.uid);
          if (!profile) {
              await result.user.delete().catch(() => signOut(auth));
              throw new Error("ACCOUNT_NOT_FOUND");
          }

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
          }
      }
  };

  return (
    <AuthContext.Provider value={{ 
        user, 
        loading, 
        login, 
        loginWithGoogle, 
        registerWithGoogle,
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
