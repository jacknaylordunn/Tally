
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { UserRole } from '../types';
import { LOGO_URL } from '../constants';

export const Login = () => {
  const { isAuthenticated, login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated && user) {
      // Check for pending scan redirect
      const pendingScan = sessionStorage.getItem('pendingScan');
      if (pendingScan) {
        sessionStorage.removeItem('pendingScan');
        try {
            const url = new URL(pendingScan);
            
            // For HashRouter, the actual route is inside the hash (e.g. #/action?...)
            // If it's a legacy URL or plain path, fall back to pathname+search
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
        await login(email, password);
    } catch (err: any) {
        setError('Invalid credentials.');
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#0b1120] p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
            <img src={LOGO_URL} alt="Logo" className="w-16 h-16 mx-auto mb-4 rounded-xl object-contain bg-white p-1 shadow-lg shadow-brand-500/20" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome back</h1>
            <p className="text-slate-500 mt-2">Enter your details to access your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    {error}
                </div>
            )}
            
            <div className="space-y-4">
                <input 
                    type="email" 
                    required 
                    className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <input 
                    type="password" 
                    required 
                    className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>

            <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold py-4 rounded-xl hover:opacity-90 transition-all flex justify-center items-center space-x-2"
            >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Sign In</span>}
                {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-500">
            Don't have an account? <Link to="/register" className="text-brand-600 font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
};
