
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, ArrowRight, Check, Calendar, MapPin, DollarSign, Mail, Wand2 } from 'lucide-react';
import { UserRole } from '../types';
import { LOGO_URL, APP_NAME } from '../constants';
import { auth } from '../lib/firebase';
import { sendPasswordResetEmail, isSignInWithEmailLink } from 'firebase/auth';

const FEATURES = [
    {
        title: "Smart Rostering",
        desc: "Build conflict-free schedules in minutes. Let staff bid on shifts and manage their own availability.",
        icon: Calendar,
        color: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-500/20",
        visual: (
            <div className="space-y-3 w-full">
                <div className="flex gap-2 items-center">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 dark:bg-blue-500/40 animate-pulse border border-blue-500/30"></div>
                    <div className="h-4 w-24 rounded-full bg-slate-300 dark:bg-white/10"></div>
                    <div className="h-4 w-full rounded-full bg-slate-100 dark:bg-white/5"></div>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="h-8 w-8 rounded-lg bg-purple-500/20 dark:bg-purple-500/40 animate-pulse delay-75 border border-purple-500/30"></div>
                    <div className="h-4 w-32 rounded-full bg-slate-300 dark:bg-white/10"></div>
                    <div className="h-4 w-full rounded-full bg-slate-100 dark:bg-white/5"></div>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/20 dark:bg-emerald-500/40 animate-pulse delay-150 border border-emerald-500/30"></div>
                    <div className="h-4 w-20 rounded-full bg-slate-300 dark:bg-white/10"></div>
                    <div className="h-4 w-full rounded-full bg-slate-100 dark:bg-white/5"></div>
                </div>
            </div>
        )
    },
    {
        title: "GPS Time Tracking",
        desc: "Ensure staff are exactly where they need to be. Geofenced clock-ins guarantee accurate attendance.",
        icon: MapPin,
        color: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-100 dark:bg-emerald-500/20",
        visual: (
            <div className="relative w-full h-32 flex items-center justify-center">
                <div className="absolute w-24 h-24 rounded-full border-2 border-emerald-500/30 animate-ping"></div>
                <div className="absolute w-32 h-32 rounded-full border border-emerald-500/20 dark:border-emerald-500/10 bg-emerald-50/50 dark:bg-transparent"></div>
                <div className="bg-emerald-500 rounded-full p-3 shadow-[0_0_20px_rgba(16,185,129,0.4)] z-10 relative">
                    <MapPin className="w-6 h-6 text-white fill-current" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-white dark:bg-slate-900 rounded-full border-2 border-emerald-500"></div>
                </div>
                <div className="absolute bottom-0 bg-white/90 dark:bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 shadow-sm">
                    Location Verified
                </div>
            </div>
        )
    },
    {
        title: "Instant Payroll",
        desc: "From timesheet to paycheck in one click. Calculate hours, overtime, and holiday pay automatically.",
        icon: DollarSign,
        color: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-100 dark:bg-amber-500/20",
        visual: (
            <div className="flex items-end justify-between w-full h-32 px-6 pb-2 gap-3">
                <div className="w-1/4 bg-slate-200 dark:bg-white/5 rounded-t-lg h-[40%] relative group hover:bg-slate-300 dark:hover:bg-white/10 transition-colors"></div>
                <div className="w-1/4 bg-slate-300 dark:bg-white/10 rounded-t-lg h-[60%] relative group hover:bg-slate-400 dark:hover:bg-white/20 transition-colors"></div>
                <div className="w-1/4 bg-gradient-to-t from-amber-500 to-amber-400 dark:to-amber-500/40 rounded-t-lg h-[85%] relative group shadow-lg shadow-amber-500/20">
                     <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-amber-100 dark:bg-amber-500 text-amber-700 dark:text-slate-900 text-[10px] font-bold px-2 py-1 rounded-md opacity-100 shadow-sm border border-amber-200 dark:border-transparent transform scale-110">£££</div>
                </div>
                <div className="w-1/4 bg-slate-200 dark:bg-white/5 rounded-t-lg h-[50%] relative group hover:bg-slate-300 dark:hover:bg-white/10 transition-colors"></div>
            </div>
        )
    }
];

export const Login = () => {
  const { isAuthenticated, login, loginWithGoogle, loginWithMagicLink, completeMagicLinkLogin, user } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  
  // Modes: 'password' | 'magic'
  const [loginMode, setLoginMode] = useState<'password' | 'magic'>('password');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<React.ReactNode>('');
  const [statusMsg, setStatusMsg] = useState('');

  // Carousel State
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
        setActiveFeature(prev => (prev + 1) % FEATURES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Handle Magic Link Completion on Load
  useEffect(() => {
      if (isSignInWithEmailLink(auth, window.location.href)) {
          let emailForSignIn = window.localStorage.getItem('emailForSignIn');
          if (!emailForSignIn) {
              emailForSignIn = window.prompt('Please provide your email for confirmation');
          }
          if (emailForSignIn) {
              setIsSubmitting(true);
              completeMagicLinkLogin(emailForSignIn, window.location.href)
                  .then(() => {
                      setStatusMsg('Successfully verified! Signing you in...');
                  })
                  .catch((err) => {
                      handleAuthError(err);
                      setIsSubmitting(false);
                  });
          }
      }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const pendingScan = sessionStorage.getItem('pendingScan');
      if (pendingScan) {
        sessionStorage.removeItem('pendingScan');
        try {
            const url = new URL(pendingScan);
            const route = url.hash ? url.hash.substring(1) : (url.pathname + url.search);
            navigate(route);
            return;
        } catch (e) {
            console.error("Invalid pending URL", e);
        }
      }
      navigate(user.role === UserRole.ADMIN ? '/admin' : '/staff'); 
    }
  }, [isAuthenticated, user, navigate]);

  const handleAuthError = (err: any) => {
      console.error("Auth Error:", err);
      if (err.message === 'ACCOUNT_NOT_FOUND') {
          setError(
              <span>
                  Account not found. Please <Link to="/register" className="font-bold underline hover:text-brand-600">Create an Account</Link> first.
              </span>
          );
      } else if (err.code === 'auth/invalid-credential') {
          setError('Incorrect email or password.');
      } else if (err.code === 'auth/too-many-requests') {
          setError('Too many failed attempts. Try again later.');
      } else if (err.code === 'auth/operation-not-allowed') {
          setError('This sign-in method is currently disabled.');
      } else if (err.code === 'auth/unauthorized-domain') {
          setError(`Configuration Error: Domain "${window.location.hostname}" not authorized in Firebase.`);
      } else {
          setError(err.message || 'Login failed. Please check your connection.');
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setStatusMsg('');

    try {
        if (loginMode === 'password') {
            await login(email, password, rememberMe);
        } else {
            await loginWithMagicLink(email);
            setStatusMsg(`Magic link sent to ${email}. Click the link in your email to sign in.`);
        }
    } catch (err: any) {
        handleAuthError(err);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
      setIsSubmitting(true);
      setError('');
      try {
          await loginWithGoogle();
      } catch (err: any) {
          handleAuthError(err);
          setIsSubmitting(false);
      }
  };

  const handleForgotPassword = async () => {
      if (!email) {
          setError('Please enter your email address first.');
          return;
      }
      try {
          const actionCodeSettings = {
              url: `${window.location.origin}/#/login`,
              handleCodeInApp: true,
          };
          await sendPasswordResetEmail(auth, email, actionCodeSettings);
          setStatusMsg(`Reset link sent to ${email}. Check spam folder if not received.`);
          setError('');
      } catch (err: any) {
          console.error("Password reset error", err);
          setError('Could not send reset email. Verify the address is correct.');
      }
  };

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#020617] text-slate-900 dark:text-white overflow-hidden font-sans transition-colors duration-300">
      {/* Left: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 relative z-10">
        <div className="w-full max-w-md space-y-8">
            <div>
                <div className="flex items-center gap-3 mb-8">
                    <img src={LOGO_URL} alt="Logo" className="w-10 h-10 rounded-xl bg-white object-cover shadow-lg border border-slate-200 dark:border-transparent" />
                    <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{APP_NAME}</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight mb-2 text-slate-900 dark:text-white">Welcome Back</h1>
                <p className="text-slate-500 dark:text-slate-400">Enter your credentials to access the workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm rounded-2xl flex items-center animate-shake">
                        <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                        <span className="flex-1">{error}</span>
                    </div>
                )}
                
                {statusMsg && (
                    <div className="p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400 text-sm rounded-2xl flex items-center">
                        <Check className="w-5 h-5 mr-3 flex-shrink-0" />
                        {statusMsg}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-400 ml-1" htmlFor="email">Email</label>
                        <input 
                            id="email"
                            name="email"
                            type="email" 
                            autoComplete="username"
                            required 
                            className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    
                    {loginMode === 'password' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-400" htmlFor="password">Password</label>
                                <button type="button" onClick={handleForgotPassword} className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300">
                                    Forgot Password?
                                </button>
                            </div>
                            <input 
                                id="password"
                                name="password"
                                type="password" 
                                autoComplete="current-password"
                                required 
                                className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    )}
                </div>

                {loginMode === 'password' && (
                    <div className="flex items-center space-x-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            id="remember"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="rounded bg-slate-200 dark:bg-white/10 border-slate-300 dark:border-white/10 text-brand-600 focus:ring-offset-white dark:focus:ring-offset-slate-900 focus:ring-brand-500" 
                        />
                        <label htmlFor="remember" className="text-sm text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition">Remember me</label>
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-2xl transition-all transform active:scale-[0.98] shadow-lg shadow-brand-500/20 flex justify-center items-center gap-2 group"
                >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        loginMode === 'password' ? <span>Sign In</span> : <span>Send Magic Link</span>
                    )}
                    {!isSubmitting && loginMode === 'password' && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    {!isSubmitting && loginMode === 'magic' && <Wand2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
                </button>
            </form>

            <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-white/10"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white dark:bg-[#020617] text-slate-500">Or continue with</span></div>
            </div>

            <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSubmitting}
                className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white font-bold py-4 rounded-2xl transition-all hover:bg-slate-50 dark:hover:bg-white/10 flex justify-center items-center gap-3"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
            </button>

            <div className="flex justify-center">
                <button 
                    type="button"
                    onClick={() => { setLoginMode(prev => prev === 'password' ? 'magic' : 'password'); setError(''); }}
                    className="text-sm font-semibold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition"
                >
                    {loginMode === 'password' ? 'Use Magic Link instead (Passwordless)' : 'Use Password instead'}
                </button>
            </div>

            <p className="text-center text-slate-500">
                New here? <Link to="/register" className="text-brand-600 dark:text-white font-semibold hover:underline">Create an account</Link>
            </p>
        </div>
      </div>

      {/* Right: Feature Showcase (Adaptive Light/Dark Mode) */}
      <div className="hidden lg:flex w-1/2 bg-slate-50 dark:bg-[#020617] relative overflow-hidden items-center justify-center p-12 transition-colors duration-300 border-l border-slate-100 dark:border-white/5">
          {/* Background Ambient Glows */}
          <div className="absolute inset-0 z-0">
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-500/5 dark:bg-brand-900/20 rounded-full blur-[120px] opacity-60"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 dark:bg-purple-900/20 rounded-full blur-[100px] opacity-40"></div>
          </div>
          
          {/* Main Content Container */}
          <div className="relative z-10 w-full max-w-lg">
              
              {/* Feature Mockup Card */}
              <div className="relative aspect-square mb-12">
                  {FEATURES.map((feature, index) => (
                      <div 
                        key={index}
                        className={`absolute inset-0 transition-all duration-700 ease-in-out transform ${
                            index === activeFeature 
                            ? 'opacity-100 scale-100 rotate-0 translate-y-0' 
                            : 'opacity-0 scale-95 rotate-3 translate-y-8'
                        }`}
                      >
                          {/* Glass Card */}
                          <div className="w-full h-full glass-panel rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl p-10 flex flex-col relative overflow-hidden bg-white/80 dark:bg-white/5 backdrop-blur-xl">
                                {/* Card Header */}
                                <div className="flex items-center justify-between mb-8">
                                    <div className={`p-4 rounded-2xl ${feature.bg}`}>
                                        <feature.icon className={`w-8 h-8 ${feature.color}`} />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-white/20"></div>
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-white/20"></div>
                                    </div>
                                </div>

                                {/* Dynamic Visual */}
                                <div className="flex-1 flex items-center justify-center relative">
                                    {feature.visual}
                                </div>

                                {/* Decorative Background Elements inside card */}
                                <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-gradient-to-br from-slate-100 dark:from-white/5 to-transparent rounded-full blur-3xl opacity-50"></div>
                          </div>
                      </div>
                  ))}
              </div>

              {/* Text Carousel */}
              <div className="relative h-32 pl-4">
                  {FEATURES.map((feature, index) => (
                      <div 
                        key={index} 
                        className={`absolute top-0 left-0 w-full transition-all duration-500 ${
                            index === activeFeature ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                        }`}
                      >
                          <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">{feature.title}</h2>
                          <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{feature.desc}</p>
                      </div>
                  ))}
              </div>

              {/* Progress Indicators */}
              <div className="flex gap-3 mt-8 pl-4">
                  {FEATURES.map((_, index) => (
                      <button 
                        key={index}
                        onClick={() => setActiveFeature(index)}
                        className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                            index === activeFeature ? 'w-10 bg-brand-600 dark:bg-brand-500' : 'w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
                        }`}
                      />
                  ))}
              </div>

          </div>
      </div>
    </div>
  );
};
