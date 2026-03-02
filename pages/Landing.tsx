
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Smartphone, Zap, Check, ArrowRight, Menu, X, QrCode, MapPin, Users, CalendarDays, Clock, Layout } from 'lucide-react';
import { APP_NAME, LOGO_URL } from '../constants';

export const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white font-sans selection:bg-brand-500/30">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
                <img src={LOGO_URL} alt="Logo" className="w-9 h-9 rounded-lg object-contain bg-white" />
                <span className="font-bold text-xl tracking-tight">{APP_NAME}</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-8 items-center font-medium text-slate-500 dark:text-slate-400 text-sm">
                <button onClick={() => scrollToSection('features')} className="hover:text-brand-600 transition">Features</button>
                <button onClick={() => scrollToSection('how-it-works')} className="hover:text-brand-600 transition">How it Works</button>
                <button onClick={() => scrollToSection('pricing')} className="hover:text-brand-600 transition">Pricing</button>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>
                <Link to="/login" className="hover:text-brand-600 transition">Sign In</Link>
                <Link to="/register" className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-full font-bold hover:opacity-90 transition shadow-lg shadow-brand-500/10">
                    Get Started
                </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-500">
                    {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 p-6 flex flex-col space-y-4 shadow-xl">
                <button onClick={() => scrollToSection('features')} className="text-left py-2 font-medium text-slate-600 dark:text-slate-300">Features</button>
                <button onClick={() => scrollToSection('how-it-works')} className="text-left py-2 font-medium text-slate-600 dark:text-slate-300">How it Works</button>
                <button onClick={() => scrollToSection('pricing')} className="text-left py-2 font-medium text-slate-600 dark:text-slate-300">Pricing</button>
                <Link to="/login" className="text-left py-2 font-medium text-brand-600">Sign In</Link>
                <Link to="/register" className="bg-brand-600 text-white py-3 rounded-xl font-bold text-center">
                    Get Started
                </Link>
            </div>
        )}
      </nav>

      {/* Hero */}
      <header className="container mx-auto px-6 pt-32 pb-16 md:py-32 flex flex-col items-center text-center relative z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-brand-500/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
        
        <div className="inline-flex items-center space-x-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-4 py-1.5 rounded-full text-xs font-bold mb-8 animate-fade-in shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>New: Integrated Rota System</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight max-w-4xl animate-slide-up">
           Plan shifts. Track hours. <br className="hidden md:block"/>
           <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-purple-600">Pay accurately.</span>
        </h1>
        
        <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mb-12 leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
            The all-in-one platform for workforce management. Create rotas, manage shift bids, and track attendance via secure QR codes—all in one app.
        </p>

        <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4 w-full md:w-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <Link to="/register" className="w-full md:w-auto bg-brand-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-brand-700 transition shadow-xl shadow-brand-500/20 flex items-center justify-center space-x-2">
                <span>Start Free Trial</span>
                <ArrowRight className="w-5 h-5" />
            </Link>
            <button onClick={() => scrollToSection('how-it-works')} className="w-full md:w-auto bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition">
                How it Works
            </button>
        </div>
      </header>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto px-6">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold mb-4">Complete Workforce Control</h2>
                <p className="text-slate-500">From planning the week to paying the wages.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {/* Rota */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 hover:border-brand-500 transition duration-300 group">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6 group-hover:scale-110 transition">
                        <CalendarDays className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">Smart Rota</h3>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        Build weekly schedules, repeat shifts, and let staff bid on open slots. Publish instantly to their phones.
                    </p>
                </div>

                {/* Clock In */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 hover:border-brand-500 transition duration-300 group">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6 group-hover:scale-110 transition">
                        <Smartphone className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">Secure Clock-In</h3>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        Staff scan dynamic QR codes to clock in. We automatically link the scan to their scheduled shift.
                    </p>
                </div>

                {/* Locations */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 hover:border-brand-500 transition duration-300 group">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-6 group-hover:scale-110 transition">
                        <MapPin className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">Geo-Fencing</h3>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        Ensure staff are physically on-site. Set GPS radius rules for every location you manage.
                    </p>
                </div>

                {/* Payroll */}
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 hover:border-brand-500 transition duration-300 group">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400 mb-6 group-hover:scale-110 transition">
                        <Layout className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">Instant Payroll</h3>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        Compare scheduled hours vs actual hours. Export detailed CSV timesheets in one click.
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold mb-4">Set up in 60 seconds.</h2>
                  <p className="text-slate-500">No hardware to buy. No apps to install.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                  <div className="hidden md:block absolute top-8 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>

                  <div className="relative z-10 flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-white dark:bg-slate-800 border-4 border-slate-50 dark:border-slate-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg text-lg font-bold text-slate-400">1</div>
                      <h3 className="text-xl font-bold mb-2">Create Rota</h3>
                      <p className="text-slate-500 text-sm px-4">Admin creates the schedule and publishes it. Staff get notified of their shifts.</p>
                  </div>

                  <div className="relative z-10 flex flex-col items-center text-center">
                       <div className="w-16 h-16 bg-white dark:bg-slate-800 border-4 border-slate-50 dark:border-slate-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg text-lg font-bold text-slate-400">2</div>
                      <h3 className="text-xl font-bold mb-2">Staff Clock In</h3>
                      <p className="text-slate-500 text-sm px-4">Staff arrive and scan the QR code. The system matches it to their rota slot.</p>
                  </div>

                   <div className="relative z-10 flex flex-col items-center text-center">
                       <div className="w-16 h-16 bg-white dark:bg-slate-800 border-4 border-slate-50 dark:border-slate-700 rounded-2xl flex items-center justify-center mb-6 shadow-lg text-lg font-bold text-slate-400">3</div>
                      <h3 className="text-xl font-bold mb-2">Export Data</h3>
                      <p className="text-slate-500 text-sm px-4">Download exact timesheets with holiday pay calculations ready for payroll.</p>
                  </div>
              </div>
          </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
          <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold mb-4">Simple, transparent pricing.</h2>
                  <p className="text-slate-500">Choose the plan that's right for your team.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                  
                  {/* Starter */}
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
                      <div className="mb-6">
                          <h3 className="text-lg font-bold mb-2">Starter</h3>
                          <div className="flex items-baseline space-x-1">
                              <span className="text-4xl font-extrabold">Free</span>
                          </div>
                          <p className="text-slate-500 text-sm mt-2">Perfect for small teams starting out.</p>
                      </div>
                      <ul className="space-y-4 mb-8 flex-1">
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-green-500" /> <span>Up to 5 Staff</span>
                          </li>
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-green-500" /> <span>Basic Time Tracking</span>
                          </li>
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-green-500" /> <span>1 Location</span>
                          </li>
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-green-500" /> <span>14 Day History</span>
                          </li>
                      </ul>
                      <Link to="/register" className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition text-center">
                          Get Started
                      </Link>
                  </div>

                  {/* Pro */}
                  <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-3xl p-8 shadow-xl flex flex-col relative transform md:-translate-y-4">
                      <div className="absolute top-0 right-0 bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">POPULAR</div>
                      <div className="mb-6">
                          <h3 className="text-lg font-bold mb-2">Professional</h3>
                          <div className="flex items-baseline space-x-1">
                              <span className="text-4xl font-extrabold">$49</span>
                              <span className="opacity-70">/mo</span>
                          </div>
                          <p className="opacity-70 text-sm mt-2">For growing businesses needing control.</p>
                      </div>
                      <ul className="space-y-4 mb-8 flex-1">
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-brand-400 dark:text-brand-600" /> <span>Up to 50 Staff</span>
                          </li>
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-brand-400 dark:text-brand-600" /> <span>Full Rota System</span>
                          </li>
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-brand-400 dark:text-brand-600" /> <span>Unlimited Locations</span>
                          </li>
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-brand-400 dark:text-brand-600" /> <span>Advanced Payroll Export</span>
                          </li>
                      </ul>
                      <Link to="/register" className="w-full py-3 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-500 transition text-center shadow-lg shadow-brand-500/30">
                          Start 14-Day Trial
                      </Link>
                  </div>

                  {/* Enterprise */}
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
                      <div className="mb-6">
                          <h3 className="text-lg font-bold mb-2">Enterprise</h3>
                          <div className="flex items-baseline space-x-1">
                              <span className="text-4xl font-extrabold">Custom</span>
                          </div>
                          <p className="text-slate-500 text-sm mt-2">For large multi-site organizations.</p>
                      </div>
                      <ul className="space-y-4 mb-8 flex-1">
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-green-500" /> <span>Unlimited Staff</span>
                          </li>
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-green-500" /> <span>Dedicated Success Manager</span>
                          </li>
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-green-500" /> <span>Custom Integrations</span>
                          </li>
                          <li className="flex items-center space-x-3 text-sm">
                              <Check className="w-5 h-5 text-green-500" /> <span>SLA Support</span>
                          </li>
                      </ul>
                      <button className="w-full py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition text-center">
                          Contact Sales
                      </button>
                  </div>

              </div>
          </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 py-12">
          <div className="container mx-auto px-6 text-center">
              <div className="flex items-center justify-center space-x-2 mb-6 opacity-50">
                  <img src={LOGO_URL} alt="Logo" className="w-6 h-6 rounded-md grayscale" />
                  <span className="font-bold text-lg tracking-tight">{APP_NAME}</span>
              </div>
              <p className="text-slate-400 text-sm">
                  &copy; {new Date().getFullYear()} {APP_NAME}. All rights reserved.
              </p>
          </div>
      </footer>
    </div>
  );
};
