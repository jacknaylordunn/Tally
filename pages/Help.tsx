
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';
import { ChevronDown, ChevronUp, User, Shield, HelpCircle, MapPin, Clock, DollarSign, Calendar, PlayCircle } from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  category: 'general' | 'admin' | 'staff';
}

export const Help = () => {
  const { user } = useAuth();
  const { startTutorial } = useTutorial();
  const [openId, setOpenId] = useState<string | null>(null);

  const faqs: FAQItem[] = [
    // General
    {
      id: 'g1',
      category: 'general',
      question: 'Why can\'t I clock in?',
      answer: (
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Location:</strong> Ensure you are within the allowed radius of your workplace. Check your phone's GPS settings.</li>
          <li><strong>Permissions:</strong> The app needs permission to access your Camera and Location. Reset site permissions in your browser if denied.</li>
          <li><strong>VPN:</strong> If you use a VPN, it might mask your location. Try turning it off.</li>
        </ul>
      )
    },
    {
      id: 'g2',
      category: 'general',
      question: 'How do I reset my password?',
      answer: 'Go to the login screen and tap "Forgot Password?". Enter your email to receive a reset link. If you are logged in, go to your Profile page to send a reset email.'
    },
    // Staff
    {
      id: 's1',
      category: 'staff',
      question: 'How do I use the Rota?',
      answer: 'Go to the "My Rota" tab. You will see your assigned shifts. Use the "Open Board" tab to see unassigned shifts and bid for them if allowed by your employer.'
    },
    {
      id: 's2',
      category: 'staff',
      question: 'How do I request time off?',
      answer: 'Navigate to "My Rota" and click the "+ Time Off" button. Select the dates and type (Holiday/Sickness). Your manager will be notified to approve it.'
    },
    // Admin
    {
      id: 'a1',
      category: 'admin',
      question: 'How do I create a Rota?',
      answer: 'Go to the Rota page. Click "+" on any day to add a shift. You can drag and drop shifts to move them. Hold "Alt" (or Option) while dragging to copy a shift. Once done, click "Publish" to make drafts visible to staff.'
    },
    {
      id: 'a2',
      category: 'admin',
      question: 'How do I change the currency or pay rates?',
      answer: 'Go to Settings > Payroll & Currency. You can set the global currency (e.g., £, $) and default hourly rate there. To change a specific employee\'s rate, go to the Staff page, click the Edit icon next to their name.'
    },
    {
      id: 'a3',
      category: 'admin',
      question: 'How do I remove a staff member?',
      answer: 'Go to the Staff page. Click the edit button on the staff member\'s row, then select "Remove Staff" at the bottom of the modal. This revokes their access to your company.'
    },
    {
      id: 'a4',
      category: 'admin',
      question: 'Draft shifts are not showing for staff?',
      answer: 'Draft shifts (grey/dashed) are only visible to admins. You must click the "Publish" button in the top right of the Rota page to make them live for your team.'
    },
  ];

  const filteredFaqs = faqs.filter(f => 
    f.category === 'general' || 
    (user?.role === 'admin' && f.category === 'admin') ||
    (user?.role === 'staff' && f.category === 'staff')
  );

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <HelpCircle className="w-8 h-8 text-brand-400" />
                Help Center
            </h1>
            <p className="text-slate-400 mt-2">Find answers to common questions and guides.</p>
          </div>
          <button 
            onClick={() => startTutorial(true)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-bold text-sm transition shadow-lg shadow-brand-900/20"
          >
              <PlayCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Start Tour</span>
          </button>
      </div>

      <div className="space-y-4">
        {filteredFaqs.map((faq) => (
          <div key={faq.id} className="glass-panel rounded-xl overflow-hidden border border-white/10 transition-all">
            <button 
              onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-3">
                 {faq.category === 'admin' && <Shield className="w-4 h-4 text-purple-400" />}
                 {faq.category === 'staff' && <User className="w-4 h-4 text-emerald-400" />}
                 {faq.category === 'general' && <HelpCircle className="w-4 h-4 text-slate-400" />}
                 <span className="font-semibold text-white">{faq.question}</span>
              </div>
              {openId === faq.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            
            {openId === faq.id && (
              <div className="p-5 pt-0 text-slate-300 text-sm leading-relaxed border-t border-white/5 bg-black/20">
                <div className="mt-4">{faq.answer}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="glass-panel p-6 rounded-xl border border-white/10 text-center space-y-4">
          <h3 className="font-bold text-white">Still need help?</h3>
          <p className="text-slate-400 text-sm">Contact your system administrator or support team.</p>
          <a href="mailto:support@tallyd.app" className="inline-block bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium transition">
              Contact Support
          </a>
      </div>
    </div>
  );
};
