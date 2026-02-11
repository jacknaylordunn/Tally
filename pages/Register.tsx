
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole, Company, User as UserType } from '../types';
import { Building, User, ArrowRight, Check, AlertCircle, Loader2, ChevronLeft, Briefcase, Key, Mail, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { createUserProfile, createCompany, getCompanyByCode } from '../services/api';
import { auth } from '../lib/firebase';
import { APP_NAME, LOGO_URL } from '../constants';
import { createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';

export const Register = () => {
  const navigate = useNavigate();
  const { refreshSession, sendVerificationEmail, registerWithGoogle } = useAuth();
  
  // Wizard State
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form Data
  const [formData, setFormData] = useState({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      companyCode: '',
      companyName: ''
  });

  // Validation State
  const [verifiedCompany, setVerifiedCompany] = useState<Company | null>(null);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  // Password Requirements
  const [passwordCriteria, setPasswordCriteria] = useState({
      length: false,
      upper: false,
      lower: false,
      number: false,
      special: false
  });

  useEffect(() => {
    const p = formData.password;
    setPasswordCriteria({
        length: p.length >= 6,
        upper: /[A-Z]/.test(p),
        lower: /[a-z]/.test(p),
        number: /[0-9]/.test(p),
        special: /[^A-Za-z0-9]/.test(p)
    });
  }, [formData.password]);

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  const updateField = (field: string, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      setError(''); // Clear errors on type
      
      // Reset verification if code changes
      if(field === 'companyCode') {
          setVerifiedCompany(null);
      }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      let formatted = raw;
      if (raw.length > 3) formatted = raw.slice(0, 3) + '-' + raw.slice(3);
      updateField('companyCode', formatted);
  };

  const verifyInviteCode = async () => {
      if (formData.companyCode.length < 7) {
          setError("Please enter a valid Invite Code (e.g. ABC-123).");
          return;
      }
      setIsVerifyingCode(true);
      try {
          const comp = await getCompanyByCode(formData.companyCode);
          if (comp) {
              setVerifiedCompany(comp);
              setError('');
          } else {
              setError("Invalid Invite Code. Please check with your manager.");
              setVerifiedCompany(null);
          }
      } catch (e) {
          setError("Error verifying code.");
      } finally {
          setIsVerifyingCode(false);
      }
  };

  const handleNext = async () => {
      if (step === 1 && !role) {
          setError("Please select an option to continue.");
          return;
      }
      if (step === 2) {
          if (role === UserRole.STAFF) {
              if (!verifiedCompany) {
                  setError("Please verify your Invite Code before continuing.");
                  return;
              }
          }
          if (role === UserRole.ADMIN && formData.companyName.trim().length < 2) {
              setError("Please enter a valid Company Name.");
              return;
          }
      }
      if (step === 3) {
          if (!formData.firstName.trim() || !formData.lastName.trim()) {
              setError("Please enter your full name.");
              return;
          }
      }
      setStep(prev => prev + 1);
      setError('');
  };

  const handleBack = () => {
      setStep(prev => prev - 1);
      setError('');
  };

  // --- SUBMISSION HANDLERS ---

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) return setError("Password does not meet requirements.");
    if (formData.password !== formData.confirmPassword) return setError("Passwords do not match.");

    setIsSubmitting(true);
    setError('');

    let userCredential;

    try {
        await setPersistence(auth, browserLocalPersistence);

        // 1. Create Auth User
        userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const uid = userCredential.user.uid;
        
        await finalizeRegistration(uid, formData.email);

    } catch (err: any) {
        console.error("Registration Error:", err);
        if (userCredential?.user) await userCredential.user.delete().catch(() => {}); // Cleanup
        
        if (err.code === 'auth/email-already-in-use') setError("Email is already registered. Try signing in.");
        else setError(err.message || "Registration failed.");
        setIsSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
      setIsSubmitting(true);
      setError('');
      try {
          await setPersistence(auth, browserLocalPersistence);
          // Pass the collected profile data to the specific registration function
          const fullName = `${formData.firstName} ${formData.lastName}`.trim();
          
          let companyId = '';
          let isApproved = true;
          let vettingEnabled = false;

          if (role === UserRole.STAFF && verifiedCompany) {
              companyId = verifiedCompany.id;
              isApproved = !verifiedCompany.settings.requireApproval;
              vettingEnabled = !!verifiedCompany.settings.vettingEnabled;
          } else {
              // Admin: Company creation happens inside finalize logic usually, 
              // but for Google, we need to do it after auth.
              // Logic is split below.
          }

          // If ADMIN, we need to create the company first or during the profile creation process.
          // Since Google Auth is atomic, we handle company creation *after* successful auth but *before* profile creation
          // by passing a callback or handling it inside the context if we refactored further.
          // For now, simpler to replicate the logic:
          
          if (role === UserRole.ADMIN) {
              // Admin Strategy:
              // 1. Generate Company ID now.
              // 2. Pass it to registerWithGoogle.
              // 3. If successful, create the company doc.
              
              const initials = formData.companyName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
              const randomNum = Math.floor(100 + Math.random() * 900);
              const inviteCode = `${initials}-${randomNum}`;
              companyId = `comp_${Date.now()}`; 
              
              // Pass data to context
              await registerWithGoogle({
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  name: fullName,
                  role: role!,
                  currentCompanyId: companyId,
                  isApproved: true,
                  vettingStatus: 'not_started'
              });

              // If we are here, Auth & Profile are created. Now create Company.
              if (auth.currentUser) {
                  const newCompany: Company = {
                      id: companyId,
                      name: formData.companyName,
                      ownerId: auth.currentUser.uid,
                      code: inviteCode,
                      settings: {
                          geofenceRadius: 200,
                          adminSecret: 'secret',
                          allowManualClockIn: true,
                          requireApproval: false,
                          defaultHourlyRate: 15.00,
                          currency: '£',
                          rotaEnabled: true,
                          vettingEnabled: false
                      }
                  };
                  await createCompany(newCompany);
              }
          } else {
              // Staff Strategy
              await registerWithGoogle({
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  name: fullName,
                  role: role!,
                  currentCompanyId: companyId,
                  isApproved: isApproved,
                  vettingStatus: vettingEnabled ? 'not_started' : undefined
              });
          }

          // Success Flow
          alert("Account created successfully!");
          navigate('/onboarding');

      } catch (err: any) {
          console.error("Google Sign Up Error:", err);
          setError(err.message || "Google Sign Up failed.");
          setIsSubmitting(false);
      }
  };

  const finalizeRegistration = async (uid: string, email: string) => {
      let companyId = '';
      let isApproved = true;
      let vettingEnabled = false;

      // 2. Resolve Company Logic
      if (role === UserRole.STAFF) {
          // Re-verify strictly to be safe, though UI prevents it
          if (!verifiedCompany) throw new Error("Company not verified.");
          companyId = verifiedCompany.id;
          isApproved = !verifiedCompany.settings.requireApproval;
          vettingEnabled = !!verifiedCompany.settings.vettingEnabled;
      } 
      else {
          // Admin: Create Company
          const initials = formData.companyName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
          const randomNum = Math.floor(100 + Math.random() * 900);
          const inviteCode = `${initials}-${randomNum}`;
          companyId = `comp_${Date.now()}`; 
          
          const newCompany: Company = {
              id: companyId,
              name: formData.companyName,
              ownerId: uid,
              code: inviteCode,
              settings: {
                  geofenceRadius: 200,
                  adminSecret: 'secret',
                  allowManualClockIn: true,
                  requireApproval: false,
                  defaultHourlyRate: 15.00,
                  currency: '£',
                  rotaEnabled: true,
                  vettingEnabled: false
              }
          };
          await createCompany(newCompany);
      }

      // 3. Create Profile
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();
      const newUser: UserType = {
          id: uid,
          email: email,
          name: fullName,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: role!,
          currentCompanyId: companyId,
          activeShiftId: null,
          isApproved: isApproved,
          vettingStatus: vettingEnabled ? 'not_started' : undefined,
          vettingData: []
      };
      await createUserProfile(newUser);
      
      // 4. Send Verification Email & Refresh
      await sendVerificationEmail();
      await refreshSession();
      
      alert("Account created successfully! Please check your email to verify your account.");
      navigate('/onboarding');
  };

  // --- RENDER STEPS ---

  const renderStep1 = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">How will you use {APP_NAME}?</h2>
              <p className="text-slate-500 text-sm">Select an option to customize your setup.</p>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
              <button
                  type="button"
                  onClick={() => setRole(UserRole.STAFF)}
                  className={`p-6 rounded-2xl border-2 transition-all text-left flex items-start space-x-4 group ${role === UserRole.STAFF ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/10 ring-1 ring-brand-500' : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-slate-500'}`}
              >
                  <div className={`p-3 rounded-xl ${role === UserRole.STAFF ? 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <User className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className={`font-bold text-lg ${role === UserRole.STAFF ? 'text-brand-700 dark:text-brand-300' : 'text-slate-900 dark:text-white'}`}>Join a Team</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">I have an invite code from my employer and need to clock in.</p>
                  </div>
                  {role === UserRole.STAFF && <div className="ml-auto"><Check className="w-5 h-5 text-brand-600" /></div>}
              </button>

              <button
                  type="button"
                  onClick={() => setRole(UserRole.ADMIN)}
                  className={`p-6 rounded-2xl border-2 transition-all text-left flex items-start space-x-4 group ${role === UserRole.ADMIN ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10 ring-1 ring-purple-500' : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-slate-500'}`}
              >
                  <div className={`p-3 rounded-xl ${role === UserRole.ADMIN ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <Building className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className={`font-bold text-lg ${role === UserRole.ADMIN ? 'text-purple-700 dark:text-purple-300' : 'text-slate-900 dark:text-white'}`}>Create Company</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">I want to set up my organization, manage staff, and run payroll.</p>
                  </div>
                  {role === UserRole.ADMIN && <div className="ml-auto"><Check className="w-5 h-5 text-purple-600" /></div>}
              </button>
          </div>
      </div>
  );

  const renderStep2 = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {role === UserRole.STAFF ? "Find your team" : "Name your workspace"}
              </h2>
              <p className="text-slate-500 text-sm">
                  {role === UserRole.STAFF ? "Enter the code provided by your manager." : "This will be displayed on rotas and payslips."}
              </p>
          </div>

          <div className="py-2">
              {role === UserRole.STAFF ? (
                  <div className="space-y-4">
                      <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invite Code</label>
                          <div className="flex gap-2">
                              <div className="relative flex-1">
                                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                  <input 
                                      type="text" 
                                      value={formData.companyCode} 
                                      onChange={handleCodeChange}
                                      className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-lg font-mono tracking-widest uppercase focus:ring-2 focus:ring-brand-500 outline-none"
                                      placeholder="ABC-123"
                                      autoFocus
                                      disabled={!!verifiedCompany}
                                  />
                              </div>
                              <button 
                                onClick={verifyInviteCode}
                                disabled={isVerifyingCode || !!verifiedCompany || formData.companyCode.length < 7}
                                className={`px-4 rounded-xl font-bold transition flex items-center gap-2 ${verifiedCompany ? 'bg-green-100 text-green-700' : 'bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50'}`}
                              >
                                  {isVerifyingCode ? <Loader2 className="w-5 h-5 animate-spin" /> : (verifiedCompany ? <Check className="w-5 h-5" /> : 'Verify')}
                              </button>
                          </div>
                      </div>

                      {verifiedCompany && (
                          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                              <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded-full">
                                  <Building className="w-5 h-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                  <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase">Verified Company</p>
                                  <p className="text-lg font-bold text-slate-900 dark:text-white">{verifiedCompany.name}</p>
                              </div>
                              <button onClick={() => { setVerifiedCompany(null); updateField('companyCode', ''); }} className="ml-auto text-xs text-slate-400 hover:text-red-500 underline">Change</button>
                          </div>
                      )}
                  </div>
              ) : (
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Company Name</label>
                      <div className="relative">
                          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                          <input 
                              type="text" 
                              value={formData.companyName} 
                              onChange={e => updateField('companyName', e.target.value)}
                              className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-lg focus:ring-2 focus:ring-purple-500 outline-none"
                              placeholder="Acme Inc."
                              autoFocus
                          />
                      </div>
                  </div>
              )}
          </div>
      </div>
  );

  const renderStep3 = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">What should we call you?</h2>
              <p className="text-slate-500 text-sm">Your profile details.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">First Name</label>
                  <input 
                      type="text" 
                      value={formData.firstName} 
                      onChange={e => updateField('firstName', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder="John"
                      autoFocus
                  />
              </div>
              <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Last Name</label>
                  <input 
                      type="text" 
                      value={formData.lastName} 
                      onChange={e => updateField('lastName', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder="Doe"
                  />
              </div>
          </div>
      </div>
  );

  const renderStep4 = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Secure your account</h2>
              <p className="text-slate-500 text-sm">Choose how you want to sign in.</p>
          </div>

          {/* Social Sign Up Option */}
          <button 
              type="button"
              onClick={handleGoogleSignUp}
              disabled={isSubmitting}
              className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white font-bold py-4 rounded-xl transition-all hover:bg-slate-50 dark:hover:bg-white/10 flex justify-center items-center gap-3 relative group"
          >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              <span>Sign up with Google</span>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin absolute right-4" />}
          </button>

          <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-xs font-bold text-slate-400 uppercase">Or use password</span>
              <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
          </div>

          <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                      <input 
                          type="email" 
                          value={formData.email} 
                          onChange={e => updateField('email', e.target.value)}
                          className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none"
                          placeholder="john@example.com"
                      />
                  </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Password</label>
                      <input 
                          type="password" 
                          value={formData.password} 
                          onChange={e => updateField('password', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-brand-500 outline-none"
                          placeholder="••••••••"
                      />
                  </div>
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Confirm</label>
                      <input 
                          type="password" 
                          value={formData.confirmPassword} 
                          onChange={e => updateField('confirmPassword', e.target.value)}
                          className={`w-full px-4 py-3 rounded-xl border focus:ring-2 outline-none dark:bg-slate-900 ${
                              formData.confirmPassword && formData.password !== formData.confirmPassword 
                              ? 'border-red-500 focus:ring-red-200 dark:focus:ring-red-900/30' 
                              : 'border-slate-200 dark:border-slate-700 focus:ring-brand-500'
                          }`}
                          placeholder="••••••••"
                      />
                  </div>
              </div>

              {/* Requirements Checklist */}
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg grid grid-cols-2 gap-2 border border-slate-100 dark:border-white/5">
                  <div className={`flex items-center text-xs ${passwordCriteria.length ? 'text-green-600' : 'text-slate-400'}`}><Check className={`w-3 h-3 mr-1 ${passwordCriteria.length ? 'opacity-100' : 'opacity-0'}`} /> Min 6 chars</div>
                  <div className={`flex items-center text-xs ${passwordCriteria.upper ? 'text-green-600' : 'text-slate-400'}`}><Check className={`w-3 h-3 mr-1 ${passwordCriteria.upper ? 'opacity-100' : 'opacity-0'}`} /> Uppercase</div>
                  <div className={`flex items-center text-xs ${passwordCriteria.number ? 'text-green-600' : 'text-slate-400'}`}><Check className={`w-3 h-3 mr-1 ${passwordCriteria.number ? 'opacity-100' : 'opacity-0'}`} /> Number</div>
                  <div className={`flex items-center text-xs ${passwordCriteria.special ? 'text-green-600' : 'text-slate-400'}`}><Check className={`w-3 h-3 mr-1 ${passwordCriteria.special ? 'opacity-100' : 'opacity-0'}`} /> Special Char</div>
              </div>

              <button 
                  type="submit"
                  disabled={isSubmitting || !isPasswordValid || (formData.password !== formData.confirmPassword)}
                  className={`w-full mt-4 px-8 py-4 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed ${role === UserRole.ADMIN ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'}`}
              >
                  {isSubmitting ? (
                      <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating Account...</span>
                      </>
                  ) : (
                      <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Create Account</span>
                      </>
                  )}
              </button>
          </form>
      </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 font-sans">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-auto md:h-[650px] border border-slate-200 dark:border-slate-700 transition-all duration-300">
        
        {/* Left Side: Dynamic Branding */}
        <div className={`
            hidden md:flex flex-col justify-between w-1/3 p-10 text-white relative overflow-hidden transition-all duration-500
            ${role === UserRole.ADMIN ? 'bg-purple-600' : 'bg-brand-600'}
        `}>
             <div className="z-10 relative">
                <div className="flex items-center space-x-3 mb-10">
                    <img src={LOGO_URL} alt="Logo" className="w-10 h-10 rounded-xl object-contain bg-white shadow-lg" />
                    <span className="font-bold text-2xl tracking-tight">{APP_NAME}</span>
                </div>
                
                <h1 className="text-4xl font-extrabold mb-6 leading-tight">
                    {step === 1 ? "Start your journey." : 
                     step === 2 ? (role === UserRole.STAFF ? "Join the team." : "Build your empire.") :
                     step === 3 ? "Introduce yourself." : 
                     "Final step."}
                </h1>
                
                <p className="text-white/80 text-lg leading-relaxed">
                    {step === 1 ? "The modern workforce OS for teams of all sizes." :
                     step === 2 ? (role === UserRole.STAFF ? "Connect with your company to start logging shifts." : "Set up your company workspace in seconds.") :
                     step === 3 ? "Let's personalize your profile." :
                     "Secure your data with industry standard encryption."}
                </p>
             </div>

             {/* Dynamic Background Shapes */}
             <div className={`absolute -bottom-24 -right-24 w-80 h-80 rounded-full opacity-20 blur-3xl transition-colors duration-500 ${role === UserRole.ADMIN ? 'bg-purple-300' : 'bg-white'}`}></div>
             <div className={`absolute top-24 -left-24 w-64 h-64 rounded-full opacity-10 blur-3xl transition-colors duration-500 ${role === UserRole.ADMIN ? 'bg-purple-900' : 'bg-black'}`}></div>
             
             <div className="z-10 text-xs text-white/50 font-medium uppercase tracking-widest">
                 Step {step} of 4
             </div>
        </div>

        {/* Right Side: Wizard Form */}
        <div className="flex-1 flex flex-col relative">
            
            {/* Progress Bar (Mobile Only) */}
            <div className="md:hidden h-1.5 w-full bg-slate-100 dark:bg-slate-700">
                <div className={`h-full transition-all duration-500 ${role === UserRole.ADMIN ? 'bg-purple-600' : 'bg-brand-600'}`} style={{ width: `${(step/4)*100}%` }}></div>
            </div>

            {/* Back Button */}
            {step > 1 && (
                <button 
                    onClick={handleBack}
                    className="absolute top-6 left-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-900 dark:hover:text-white transition z-20"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
            )}

            {/* Login Link */}
            <div className="absolute top-6 right-6 z-20">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Has account? <Link to="/login" className="text-brand-600 font-bold hover:underline">Sign In</Link>
                </p>
            </div>

            <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-12 overflow-y-auto custom-scrollbar">
                
                {/* Form Content */}
                <div className="w-full max-w-md mx-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-start animate-shake">
                            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 1 && renderStep1()}
                    {step === 2 && renderStep2()}
                    {step === 3 && renderStep3()}
                    {step === 4 && renderStep4()}

                    {/* Action Bar (Steps 1-3 only) */}
                    {step < 4 && (
                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div className="flex space-x-2">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className={`h-2 w-2 rounded-full transition-colors duration-300 ${i === step ? (role === UserRole.ADMIN ? 'bg-purple-600' : 'bg-brand-600') : i < step ? (role === UserRole.ADMIN ? 'bg-purple-200' : 'bg-brand-200') : 'bg-slate-200 dark:bg-slate-700'}`} />
                                ))}
                            </div>

                            <button 
                                type="button"
                                onClick={handleNext}
                                className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center space-x-2 ${role === UserRole.ADMIN ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'}`}
                            >
                                <span>Continue</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
