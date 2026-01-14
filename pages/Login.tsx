
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, ArrowRight, Check, Calendar, MapPin, DollarSign, Clock, Zap, Shield } from 'lucide-react';
import { UserRole } from '../types';
import { LOGO_URL, APP_NAME } from '../constants';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

const FEATURES = [
    {
        title: "Smart Rostering",
        desc: "Build conflict-free schedules in minutes. Let staff bid on shifts and manage their own availability.",
        icon: Calendar,
        color: "text-blue-400",
        bg: "bg-blue-500/20",
        visual: (
            <div className="space-y-3 w-full">
                <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/40 animate-pulse"></div>
                    <div className="h-8 w-24 rounded-lg bg-white/10"></div>
                    <div className="h-8 w-full rounded-lg bg-white/5"></div>
                </div>
                <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-lg bg-purple-500/40 animate-pulse delay-75"></div>
                    <div className="h-8 w-32 rounded-lg bg-white/10"></div>
                    <div className="h-8 w-full rounded-lg bg-white/5"></div>
                </div>
                <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/40 animate-pulse delay-150"></div>
                    <div className="h-8 w-20 rounded-lg bg-white/10"></div>
                    <div className="h-8 w-full rounded-lg bg-white/5"></div>
                </div>
            </div>
        )
    },
    {
        title: "GPS Time Tracking",
        desc: "Ensure staff are exactly where they need to be. Geofenced clock-ins guarantee accurate attendance.",
        icon: MapPin,
        color: "text-emerald-400",
        bg: "bg-emerald-500/20",
        visual: (
            <div className="relative w-full h-32 flex items-center justify-center">
                <div className="absolute w-24 h-24 rounded-full border-2 border-emerald-500/30 animate-ping"></div>
                <div className="absolute w-32 h-32 rounded-full border border-emerald-500/10"></div>
                <div className="bg-emerald-500 rounded-full p-3 shadow-[0_0_20px_rgba(16,185,129,0.5)] z-10">
                    <MapPin className="w-6 h-6 text-white fill-current" />
                </div>
                <div className="absolute bottom-0 bg-slate-900/80 backdrop-blur px-3 py-1 rounded-full text-[10px] text-emerald-400 border border-emerald-500/30">
                    Location Verified
                </div>
            </div>
        )
    },
    {
        title: "Instant Payroll",
        desc: "From timesheet to paycheck in one click. Calculate hours, overtime, and holiday pay automatically.",
        icon: DollarSign,
        color: "text-amber-400",
        bg: "bg-amber-500/20",
        visual: (
            <div className="flex items-end justify-between w-full h-32 px-4 pb-2 gap-2">
                <div className="w-1/4 bg-white/5 rounded-t-lg h-[40%] relative group">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">Mon</div>
                </div>
                <div className="w-1/4 bg-white/10 rounded-t-lg h-[60%] relative group">
                     <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">Tue</div>
                </div>
                <div className="w-1/4 bg-amber-500/40 rounded-t-lg h-[85%] relative group shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                     <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded opacity-100">£££</div>
                </div>
                <div className="w-1/4 bg-white/5 rounded-t-lg h-[50%] relative group">
                     <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition">Thu</div>
                </div>
            </div>
        )
    }
];

export const Login = () => {
  const { isAuthenticated, login, user } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Carousel State
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
        setActiveFeature(prev => (prev + 1) % FEATURES.length);
    }, 5000);
    return () => clearInterval(interval);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
        await login(email, password, rememberMe);
    } catch (err: any) {
        if (err.code === 'auth/invalid-credential') {
            setError('Incorrect email or password.');
        } else if (err.code === 'auth/too-many-requests') {
            setError('Too many failed attempts. Try again later.');
        } else {
            setError('Login failed. Please check your connection.');
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
      if (!email) {
          setError('Please enter your email address first.');
          return;
      }
      try {
          await sendPasswordResetEmail(auth, email);
          setResetSent(true);
          setError('');
      } catch (err: any) {
          setError('Could not send reset email. Verify the address is correct.');
      }
  };

  return (
    <div className="min-h-screen flex bg-[#020617] text-white overflow-hidden font-sans">
      {/* Left: Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 relative z-10">
        <div className="w-full max-w-md space-y-10">
            <div>
                <div className="flex items-center gap-3 mb-8">
                    <img src={LOGO_URL} alt="Logo" className="w-10 h-10 rounded-xl bg-white object-cover shadow-lg" />
                    <span className="text-2xl font-extrabold tracking-tight text-white">{APP_NAME}</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight mb-2 text-white">Welcome Back</h1>
                <p className="text-slate-400">Enter your credentials to access the workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl flex items-center animate-shake">
                        <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                        {error}
                    </div>
                )}
                
                {resetSent && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-2xl flex items-center">
                        <Check className="w-5 h-5 mr-3 flex-shrink-0" />
                        Reset link sent to {email}
                    </div>
                )}

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400 ml-1">Email</label>
                        <input 
                            type="email" 
                            required 
                            className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/5 text-white placeholder:text-slate-600 focus:ring-1 focus:ring-brand-500 focus:border-brand-500/50 outline-none transition-all hover:bg-white/10"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-400 ml-1">Password</label>
                        <input 
                            type="password" 
                            required 
                            className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/5 text-white placeholder:text-slate-600 focus:ring-1 focus:ring-brand-500 focus:border-brand-500/50 outline-none transition-all hover:bg-white/10"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center space-x-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="rounded bg-white/10 border-white/10 text-brand-600 focus:ring-offset-slate-900 focus:ring-brand-500" 
                        />
                        <span className="text-slate-400 group-hover:text-slate-300 transition">Remember me</span>
                    </label>
                    <button type="button" onClick={handleForgotPassword} className="text-brand-400 hover:text-brand-300 font-medium transition">
                        Forgot Password?
                    </button>
                </div>

                <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-4 rounded-2xl transition-all transform active:scale-[0.98] shadow-lg shadow-brand-500/20 flex justify-center items-center gap-2 group"
                >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Sign In</span>}
                    {!isSubmitting && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </button>
            </form>

            <p className="text-center text-slate-500">
                New here? <Link to="/register" className="text-white font-semibold hover:underline">Create an account</Link>
            </p>
        </div>
      </div>

      {/* Right: Feature Showcase */}
      <div className="hidden lg:flex w-1/2 bg-[#020617] relative overflow-hidden items-center justify-center p-12">
          {/* Background Ambient Glows */}
          <div className="absolute inset-0 z-0">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-900/20 rounded-full blur-[100px] opacity-50"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[100px] opacity-30"></div>
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
                          <div className="w-full h-full glass-panel rounded-[2.5rem] border border-white/10 shadow-2xl p-8 flex flex-col relative overflow-hidden">
                                {/* Card Header */}
                                <div className="flex items-center justify-between mb-8">
                                    <div className={`p-3 rounded-2xl ${feature.bg}`}>
                                        <feature.icon className={`w-6 h-6 ${feature.color}`} />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-2 h-2 rounded-full bg-red-500/20"></div>
                                        <div className="w-2 h-2 rounded-full bg-yellow-500/20"></div>
                                        <div className="w-2 h-2 rounded-full bg-green-500/20"></div>
                                    </div>
                                </div>

                                {/* Dynamic Visual */}
                                <div className="flex-1 flex items-center justify-center relative">
                                    {feature.visual}
                                </div>

                                {/* Decorative Background Elements inside card */}
                                <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl"></div>
                          </div>
                      </div>
                  ))}
              </div>

              {/* Text Carousel */}
              <div className="relative h-32">
                  {FEATURES.map((feature, index) => (
                      <div 
                        key={index} 
                        className={`absolute top-0 left-0 w-full transition-all duration-500 ${
                            index === activeFeature ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                        }`}
                      >
                          <h2 className="text-3xl font-bold text-white mb-3">{feature.title}</h2>
                          <p className="text-lg text-slate-400 leading-relaxed">{feature.desc}</p>
                      </div>
                  ))}
              </div>

              {/* Progress Indicators */}
              <div className="flex gap-2 mt-8">
                  {FEATURES.map((_, index) => (
                      <button 
                        key={index}
                        onClick={() => setActiveFeature(index)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            index === activeFeature ? 'w-8 bg-brand-500' : 'w-2 bg-slate-700 hover:bg-slate-600'
                        }`}
                      />
                  ))}
              </div>

          </div>
      </div>
    </div>
  );
};
