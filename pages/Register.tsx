
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole, Company, User as UserType } from '../types';
import { Building, User, ArrowRight, Check, AlertCircle, Loader2, ChevronLeft, Briefcase, Key, Mail, ShieldCheck } from 'lucide-react';
import { createUserProfile, createCompany, getCompanyByCode } from '../services/api';
import { auth } from '../lib/firebase';
import { APP_NAME, LOGO_URL } from '../constants';
import { createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth';

export const Register = () => {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  
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
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      let formatted = raw;
      if (raw.length > 3) formatted = raw.slice(0, 3) + '-' + raw.slice(3);
      updateField('companyCode', formatted);
  };

  const handleNext = () => {
      if (step === 1 && !role) {
          setError("Please select an option to continue.");
          return;
      }
      if (step === 2) {
          if (role === UserRole.STAFF && formData.companyCode.length < 7) {
              setError("Please enter a valid Invite Code (e.g. ABC-123).");
              return;
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

  const handleSubmit = async (e: React.FormEvent) => {
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
        let companyId = '';
        let isApproved = true;
        let vettingEnabled = false;

        // 2. Resolve Company Logic
        if (role === UserRole.STAFF) {
            const company = await getCompanyByCode(formData.companyCode);
            if (!company) throw new Error("Invalid Company Invite Code. Please check with your manager.");
            companyId = company.id;
            isApproved = !company.settings.requireApproval;
            vettingEnabled = !!company.settings.vettingEnabled;
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
                    // Defaults
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
            email: formData.email,
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
        
        await refreshSession();
        navigate('/onboarding');

    } catch (err: any) {
        console.error("Registration Error:", err);
        if (userCredential?.user) await userCredential.user.delete().catch(() => {}); // Cleanup
        
        if (err.code === 'auth/email-already-in-use') setError("Email is already registered. Try signing in.");
        else setError(err.message || "Registration failed.");
    } finally {
        setIsSubmitting(false);
    }
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
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Invite Code</label>
                      <div className="relative">
                          <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                          <input 
                              type="text" 
                              value={formData.companyCode} 
                              onChange={handleCodeChange}
                              className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-lg font-mono tracking-widest uppercase focus:ring-2 focus:ring-brand-500 outline-none"
                              placeholder="ABC-123"
                              autoFocus
                          />
                      </div>
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
              <p className="text-slate-500 text-sm">Set your login credentials.</p>
          </div>

          <div className="space-y-4">
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
          </div>
      </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 font-sans">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-auto md:h-[600px] border border-slate-200 dark:border-slate-700">
        
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

            <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-12 overflow-y-auto">
                
                {/* Form Content */}
                <div className="w-full max-w-md mx-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-start animate-shake">
                            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {step === 1 && renderStep1()}
                        {step === 2 && renderStep2()}
                        {step === 3 && renderStep3()}
                        {step === 4 && renderStep4()}

                        {/* Action Bar */}
                        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div className="flex space-x-2">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className={`h-2 w-2 rounded-full transition-colors duration-300 ${i === step ? (role === UserRole.ADMIN ? 'bg-purple-600' : 'bg-brand-600') : i < step ? (role === UserRole.ADMIN ? 'bg-purple-200' : 'bg-brand-200') : 'bg-slate-200 dark:bg-slate-700'}`} />
                                ))}
                            </div>

                            {step < 4 ? (
                                <button 
                                    type="button"
                                    onClick={handleNext}
                                    className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center space-x-2 ${role === UserRole.ADMIN ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'}`}
                                >
                                    <span>Continue</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button 
                                    type="submit"
                                    disabled={isSubmitting || !isPasswordValid || (formData.password !== formData.confirmPassword)}
                                    className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed ${role === UserRole.ADMIN ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'}`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="w-4 h-4" />
                                            <span>Create Account</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
