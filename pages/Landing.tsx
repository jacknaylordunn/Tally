
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Smartphone, Zap, Check, ArrowRight, Menu, X, QrCode, MapPin, Users } from 'lucide-react';

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
                <div className="w-9 h-9 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-brand-500/30">T</div>
                <span className="font-bold text-xl tracking-tight">Tally</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex space-x-8 items-center font-medium text-slate-500 dark:text-slate-400 text-sm">
                <button onClick={() => scrollToSection('how-it-works')} className="hover:text-brand-600 transition">How it Works</button>
                <button onClick={() => scrollToSection('features')} className="hover:text-brand-600 transition">Features</button>
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
                <button onClick={() => scrollToSection('how-it-works')} className="text-left py-2 font-medium text-slate-600 dark:text-slate-300">How it Works</button>
                <button onClick={() => scrollToSection('features')} className="text-left py-2 font-medium text-slate-600 dark:text-slate-300">Features</button>
                <button onClick={() => scrollToSection('pricing')} className="text-left py-2 font-medium text-slate-600 dark:text-slate-300">Pricing</button>
                <div className="h-px w-full bg-slate-100 dark:bg-slate-800 my-2"></div>
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
            <span>Live: Native Camera Support</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight max-w-4xl animate-slide-up">
           Time tracking that <br className="hidden md:block"/>
           <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-purple-600">doesn't slow you down.</span>
        </h1>
        
        <p className="text-xl text-slate-500 dark:text-slate-400 max-w-2xl mb-12 leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Eliminate apps, fobs, and paper sheets. Tally uses secure, rotating QR codes and geolocation to clock staff in using their native phone camera.
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

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-white dark:bg-slate-800/50">
          <div className="container mx-auto px-6">
              <div className="text-center mb-16">
                  <h2 className="text-3xl font-bold mb-4">Set up in 60 seconds.</h2>
                  <p className="text-slate-500">No hardware to buy. No apps to install.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
                  {/* Connecting Line (Desktop) */}
                  <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>

                  <div className="relative z-10 flex flex-col items-center text-center">
                      <div className="w-24 h-24 bg-white dark:bg-slate-800 border-4 border-slate-50 dark:border-slate-700 rounded-full flex items-center justify-center mb-6 shadow-xl">
                          <Users className="w-10 h-10 text-brand-500" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">1. Create Team</h3>
                      <p className="text-slate-500 text-sm px-8">Sign up and get your unique company invite code.</p>
                  </div>

                  <div className="relative z-10 flex flex-col items-center text-center">
                       <div className="w-24 h-24 bg-white dark:bg-slate-800 border-4 border-slate-50 dark:border-slate-700 rounded-full flex items-center justify-center mb-6 shadow-xl">
                          <QrCode className="w-10 h-10 text-purple-500" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">2. Display QR</h3>
                      <p className="text-slate-500 text-sm px-8">Set up a tablet Kiosk or print static location posters.</p>
                  </div>

                   <div className="relative z-10 flex flex-col items-center text-center">
                       <div className="w-24 h-24 bg-white dark:bg-slate-800 border-4 border-slate-50 dark:border-slate-700 rounded-full flex items-center justify-center mb-6 shadow-xl">
                          <Smartphone className="w-10 h-10 text-emerald-500" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">3. Staff Scan</h3>
                      <p className="text-slate-500 text-sm px-8">Staff scan the code with their normal camera to clock in.</p>
                  </div>
              </div>
          </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-slate-50 dark:bg-slate-900">
        <div className="container mx-auto px-6">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold mb-4">Everything you need, nothing you don't.</h2>
                <p className="text-slate-500">Built for speed, security, and simplicity.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                        <Smartphone className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">Native Scanning</h3>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        Staff don't need to download an app. They simply open their camera, scan the Tally QR, and they are verified instantly.
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-6">
                        <MapPin className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">Anti-Spoof Security</h3>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        Dynamic QR codes rotate every 10 seconds. Static QRs use geolocation to ensure staff are physically on site.
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-6">
                        <Zap className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">Instant Payroll</h3>
                    <p className="text-slate-500 leading-relaxed text-sm">
                        Export timesheets to CSV/PDF in one click. Handle custom rates, overtime, and manual adjustments effortlessly.
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-white dark:bg-slate-800/50">
        <div className="container mx-auto px-6">
            <div className="text-center mb-16">
                <h2 className="text-3xl font-bold mb-4">Simple, transparent pricing.</h2>
                <p className="text-slate-500">Start free, upgrade as you grow.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                {/* Starter */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 flex flex-col">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold">Starter</h3>
                        <p className="text-slate-500 text-sm">For small teams</p>
                    </div>
                    <div className="mb-6">
                        <span className="text-4xl font-bold">$0</span>
                        <span className="text-slate-400">/mo</span>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                         <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-500" />
                            <span>Up to 5 Staff</span>
                         </li>
                         <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-500" />
                            <span>1 Location</span>
                         </li>
                         <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-500" />
                            <span>15 Days History</span>
                         </li>
                    </ul>
                    <Link to="/register" className="w-full block text-center py-3 rounded-xl border-2 border-slate-100 dark:border-slate-700 font-bold hover:border-brand-500 hover:text-brand-500 transition">
                        Get Started
                    </Link>
                </div>

                {/* Pro */}
                <div className="bg-slate-900 text-white rounded-3xl p-8 shadow-2xl relative transform md:-translate-y-4 flex flex-col">
                    <div className="absolute top-0 right-0 bg-brand-500 text-white text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-2xl">POPULAR</div>
                    <div className="mb-4">
                        <h3 className="text-lg font-bold">Growth</h3>
                        <p className="text-slate-400 text-sm">For growing businesses</p>
                    </div>
                    <div className="mb-6">
                        <span className="text-4xl font-bold">$29</span>
                        <span className="text-slate-400">/mo</span>
                    </div>
                     <ul className="space-y-4 mb-8 flex-1">
                         <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-400" />
                            <span>Up to 25 Staff</span>
                         </li>
                         <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-400" />
                            <span>Unlimited Locations</span>
                         </li>
                         <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-400" />
                            <span>Unlimited History</span>
                         </li>
                         <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-400" />
                            <span>Payroll Exports</span>
                         </li>
                    </ul>
                    <Link to="/register" className="w-full block text-center py-3 rounded-xl bg-brand-600 font-bold hover:bg-brand-500 transition">
                        Start Free Trial
                    </Link>
                </div>

                {/* Enterprise */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 flex flex-col">
                    <div className="mb-4">
                        <h3 className="text-lg font-bold">Enterprise</h3>
                        <p className="text-slate-500 text-sm">For large organizations</p>
                    </div>
                    <div className="mb-6">
                        <span className="text-4xl font-bold">$99</span>
                        <span className="text-slate-400">/mo</span>
                    </div>
                    <ul className="space-y-4 mb-8 flex-1">
                         <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-500" />
                            <span>Unlimited Staff</span>
                         </li>
                         <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-500" />
                            <span>Dedicated Success Mgr</span>
                         </li>
                         <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-500" />
                            <span>SLA Support</span>
                         </li>
                          <li className="flex items-center space-x-3 text-sm">
                            <Check className="w-5 h-5 text-brand-500" />
                            <span>Custom Integrations</span>
                         </li>
                    </ul>
                    <Link to="/register" className="w-full block text-center py-3 rounded-xl border-2 border-slate-100 dark:border-slate-700 font-bold hover:border-brand-500 hover:text-brand-500 transition">
                        Contact Sales
                    </Link>
                </div>
            </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
          <div className="container mx-auto px-6">
              <div className="bg-slate-900 dark:bg-brand-600 rounded-3xl p-12 md:p-24 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                  <div className="relative z-10">
                      <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to modernize your workforce?</h2>
                      <p className="text-slate-300 dark:text-white/80 text-lg mb-10 max-w-2xl mx-auto">
                          Join 500+ companies using Tally to track time without the friction.
                      </p>
                      <Link to="/register" className="inline-flex items-center bg-white text-slate-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-100 transition">
                          Get Started for Free
                      </Link>
                      <p className="mt-6 text-sm text-slate-500 dark:text-white/60">No credit card required • Cancel anytime</p>
                  </div>
              </div>
          </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 py-12">
          <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center space-x-2 mb-4 md:mb-0">
                  <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-slate-900 font-bold">T</div>
                  <span className="font-bold text-xl">Tally</span>
              </div>
              <div className="flex space-x-6 text-slate-500 text-sm">
                  <a href="#" className="hover:text-slate-900 dark:hover:text-white">Privacy</a>
                  <a href="#" className="hover:text-slate-900 dark:hover:text-white">Terms</a>
                  <a href="#" className="hover:text-slate-900 dark:hover:text-white">Contact</a>
                  <span>&copy; {new Date().getFullYear()} Tally Inc.</span>
              </div>
          </div>
      </footer>
    </div>
  );
};
