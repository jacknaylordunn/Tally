
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Building, User, ArrowRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import { createUserProfile, createCompany, getCompanyByCode } from '../services/api';
import { Company, User as UserType } from '../types';
import { auth } from '../lib/firebase';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';

export const Register = () => {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  
  const [activeTab, setActiveTab] = useState<UserRole>(UserRole.STAFF);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    
    let userCredential;

    try {
        // 1. Create Authentication User FIRST
        // This ensures we are authenticated when we try to query the database
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        let companyId = '';

        // 2. Validate / Prepare Company Logic
        if (activeTab === UserRole.STAFF) {
            if (!companyCode) {
                 throw new Error("Please enter a Company Invite Code.");
            }
            // Now we are authenticated, this query works against Firestore rules
            const company = await getCompanyByCode(companyCode);
            if (!company) throw new Error("Invalid Company Invite Code.");
            companyId = company.id;
        } 
        else if (activeTab === UserRole.ADMIN) {
            // Generate a code like "AMS-999"
            const initials = companyName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
            const randomNum = Math.floor(100 + Math.random() * 900);
            const inviteCode = `${initials}-${randomNum}`;
            
            companyId = `comp_${Date.now()}`; 
            
            const newCompany: Company = {
                id: companyId,
                name: companyName,
                ownerId: uid,
                code: inviteCode,
                settings: {
                    geofenceRadius: 200,
                    adminSecret: 'secret',
                    allowManualClockIn: true,
                    requireApproval: false,
                    defaultHourlyRate: 15.00
                }
            };
            await createCompany(newCompany);
        }

        // 3. Create User Profile
        const newUser: UserType = {
            id: uid,
            email,
            name,
            role: activeTab,
            currentCompanyId: companyId,
            activeShiftId: null
        };
        await createUserProfile(newUser);
        
        // 4. Force Refresh Session to grab new profile and Redirect
        await refreshSession();
        navigate('/onboarding');

    } catch (err: any) {
        console.error("Registration Error:", err);
        
        // Cleanup: If we created an auth user but failed to link profile/company, delete the auth user
        if (userCredential && userCredential.user) {
            await deleteUser(userCredential.user).catch(cleanupErr => 
                console.error("Failed to cleanup orphaned user", cleanupErr)
            );
        }

        let msg = "Registration failed. Please try again.";
        
        if (err.code === 'auth/email-already-in-use') {
            msg = "Email is already in use.";
        } else if (err.code === 'auth/weak-password') {
            msg = "Password should be at least 6 characters.";
        } else if (err.code === 'permission-denied' || err.message.includes('permission')) {
             msg = "Database permission denied. Please ensure your internet is connected or contact support.";
        } else if (err.message === "Invalid Company Invite Code.") {
            msg = "The Company Invite Code is invalid. Please check with your manager.";
        } else if (err.message) {
            msg = err.message;
        }

        setError(msg);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Branding/Info */}
        <div className="hidden md:flex flex-col justify-between w-2/5 bg-brand-600 p-8 text-white relative overflow-hidden">
             <div className="z-10">
                <div className="flex items-center space-x-2 mb-8">
                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-brand-600 font-bold text-xl">T</div>
                    <span className="font-bold text-2xl">Tally</span>
                </div>
                <h2 className="text-3xl font-bold mb-4">Start tracking time effortlessly.</h2>
                <ul className="space-y-4 text-brand-100">
                    <li className="flex items-center space-x-3">
                        <Check className="w-5 h-5" /> <span>Native Camera Scanning</span>
                    </li>
                    <li className="flex items-center space-x-3">
                        <Check className="w-5 h-5" /> <span>Geolocation Fencing</span>
                    </li>
                    <li className="flex items-center space-x-3">
                        <Check className="w-5 h-5" /> <span>Instant Payroll Export</span>
                    </li>
                </ul>
             </div>
             <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-brand-500 rounded-full opacity-50"></div>
             <div className="absolute top-24 -left-24 w-48 h-48 bg-brand-400 rounded-full opacity-20"></div>
        </div>

        {/* Right Side: Form */}
        <div className="flex-1 p-8 md:p-12">
            <div className="flex justify-end mb-8">
                <p className="text-sm text-slate-500 dark:text-slate-400">Already have an account? <Link to="/login" className="text-brand-600 font-semibold hover:underline">Sign In</Link></p>
            </div>

            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Create an account</h1>
                <p className="text-slate-500 text-sm">Choose your account type to get started.</p>
            </div>

            {error && (
                <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-start">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Tabs */}
            <div className="grid grid-cols-2 gap-4 mb-8">
                <button
                    type="button"
                    onClick={() => setActiveTab(UserRole.STAFF)}
                    className={`flex items-center justify-center space-x-2 py-4 rounded-xl border-2 transition-all ${activeTab === UserRole.STAFF ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400' : 'border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-500'}`}
                >
                    <User className="w-5 h-5" />
                    <span className="font-semibold">Join a Team</span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab(UserRole.ADMIN)}
                    className={`flex items-center justify-center space-x-2 py-4 rounded-xl border-2 transition-all ${activeTab === UserRole.ADMIN ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400' : 'border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-500'}`}
                >
                    <Building className="w-5 h-5" />
                    <span className="font-semibold">Start Company</span>
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                        <input 
                            type="text" required
                            value={name} onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" 
                            placeholder="John Doe"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                        <input 
                            type="email" required
                            value={email} onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" 
                            placeholder="john@example.com"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                    <input 
                        type="password" required
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" 
                        placeholder="••••••••"
                        minLength={6}
                    />
                </div>

                {activeTab === UserRole.STAFF ? (
                    <div className="space-y-1 pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Company Invite Code</label>
                        <input 
                            type="text" required
                            value={companyCode} onChange={(e) => setCompanyCode(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal" 
                            placeholder="e.g. AMS-999"
                        />
                        <p className="text-xs text-slate-500">Ask your manager for this code.</p>
                    </div>
                ) : (
                    <div className="space-y-1 pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
                         <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Company Name</label>
                         <input 
                            type="text" required
                            value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none" 
                            placeholder="Acme Inc."
                        />
                    </div>
                )}

                <div className="pt-4">
                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center space-x-2 disabled:opacity-70"
                    >
                        {isSubmitting ? (
                             <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                            <>
                                <span>Get Started</span>
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};
