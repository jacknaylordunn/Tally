
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';
import { ChevronDown, ChevronUp, User, Shield, HelpCircle, PlayCircle, Zap, BookOpen, ExternalLink, Briefcase, CalendarDays, DollarSign, MapPin, QrCode, FileText, Smartphone, ClipboardCheck, FileSpreadsheet } from 'lucide-react';
import { InteractiveGuide } from '../types';

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  category: 'general' | 'admin' | 'staff';
  guide?: InteractiveGuide; 
}

export const Help = () => {
  const { user } = useAuth();
  const { startTutorial, startGuide } = useTutorial();
  const [openId, setOpenId] = useState<string | null>(null);

  // --- INTERACTIVE GUIDES ---
  
  // 1. Rota Guides
  const repeatShiftGuide: InteractiveGuide = {
      id: 'repeat-shift',
      title: 'Repeating a Shift',
      steps: [
          { content: 'Navigate to the **Rota** page.', route: '/admin/rota' },
          { content: 'Find the shift you want to repeat. **Right-click** (or hold on mobile) on the shift card.', targetId: 'rota-add-btn-0', route: '/admin/rota' },
          { content: 'Select **Repeat...** from the menu that appears.', route: '/admin/rota' },
          { content: 'Choose "Every Day" to fill the week, or "Custom" to pick specific dates.', route: '/admin/rota' }
      ]
  };

  const publishRotaGuide: InteractiveGuide = {
      id: 'publish-rota',
      title: 'Publishing the Rota',
      steps: [
          { content: 'Navigate to the **Rota** page.', route: '/admin/rota' },
          { content: 'Click the **Publish** button in the top right corner.', targetId: 'rota-publish-menu-btn', route: '/admin/rota' },
          { content: 'Select "Publish Current Week". This will turn all draft (grey) shifts into active shifts visible to staff.', targetId: 'publish-week-btn', route: '/admin/rota' }
      ]
  };

  const timeOffGuide: InteractiveGuide = {
      id: 'time-off',
      title: 'Managing Time Off',
      steps: [
          { content: 'Requests appear on the Rota page.', route: '/admin/rota' },
          { content: 'Click the **Time Off** button in the toolbar.', route: '/admin/rota' },
          { content: 'Review pending requests here. Clicking "Approve" will notify the staff member.', route: '/admin/rota' }
      ]
  };

  // 2. Staff Guides
  const approveStaffGuide: InteractiveGuide = {
      id: 'approve-staff',
      title: 'Approving Staff',
      steps: [
          { content: 'Go to the **Staff** management page.', route: '/admin/staff' },
          { content: 'Look for staff with a yellow "Pending" badge.', targetId: 'staff-bulk-btn', route: '/admin/staff' },
          { content: 'Click the **Edit (Pencil)** icon on their row.', route: '/admin/staff' },
          { content: 'Click the **Confirm & Approve** button at the bottom of the form.', route: '/admin/staff' }
      ]
  };

  const vettingGuide: InteractiveGuide = {
      id: 'vetting-review',
      title: 'Reviewing Vetting Documents',
      steps: [
          { content: 'Go to the **Vetting** page.', route: '/admin/vetting' },
          { content: 'Select a staff member from the left list.', route: '/admin/vetting' },
          { content: 'Review their uploaded documents in the center panel.', route: '/admin/vetting' },
          { content: 'Click **Pass Check** or **Accept** for each item. Once all are cleared, click **Finalize & Verify User**.', route: '/admin/vetting' }
      ]
  };

  const bulkWageGuide: InteractiveGuide = {
      id: 'bulk-wage',
      title: 'Bulk Pay Adjustment',
      steps: [
          { content: 'Go to **Staff**.', route: '/admin/staff' },
          { content: 'Click the **Bulk Adjust Rates** button at the top.', targetId: 'staff-bulk-btn', route: '/admin/staff' },
          { content: 'Enter the *current* rate you want to target (e.g. 11.44) and the *new* rate (e.g. 12.00).', targetId: 'bulk-update-container', route: '/admin/staff' },
          { content: 'Click **Update All** to apply changes to everyone on that rate.', route: '/admin/staff' }
      ]
  };

  // 3. Infrastructure & Export
  const locationGuide: InteractiveGuide = {
      id: 'create-location',
      title: 'Creating a Location',
      steps: [
          { content: 'Navigate to **Locations**.', route: '/admin/locations' },
          { content: 'Click **Add Location** to define a new geofenced area.', targetId: 'add-location-btn', route: '/admin/locations' },
          { content: 'Enter the details and click Save. Once created, you can generate a **Static QR Poster** for this location.', route: '/admin/locations' }
      ]
  };

  const exportGuide: InteractiveGuide = {
      id: 'export-timesheets',
      title: 'Exporting Payroll Matrix',
      steps: [
          { content: 'Go to **Timesheets**.', route: '/admin/timesheets' },
          { content: 'Click the **Export** button in the top right.', route: '/admin/timesheets' },
          { content: 'Select "Matrix View" for a grid layout. Ensure "Show In/Out Times" is checked for full detail.', route: '/admin/timesheets' },
          { content: 'Click **Download Report**.', route: '/admin/timesheets' }
      ]
  };

  const faqs: FAQItem[] = [
    // === STAFF FAQs ===
    {
        id: 's1', category: 'staff',
        question: 'How do I clock in?',
        answer: 'Navigate to the Dashboard (Status) tab. If you have an active shift scheduled, you will see a "Clock In" button. Tap it to open the scanner, then scan the QR code at your workplace.'
    },
    {
        id: 's2', category: 'staff',
        question: 'Why does it say "You are too far away"?',
        answer: 'Our Static QR codes use GPS to ensure you are on-site. Make sure your phone\'s location services are enabled for the browser/app and you are within the building.'
    },
    {
        id: 's3', category: 'staff',
        question: 'How do I request time off?',
        answer: 'Go to "My Rota" and click the "+ Time Off" button. Fill in the dates and reason. You will see the status change from Pending to Approved once your manager reviews it.'
    },
    {
        id: 's4', category: 'staff',
        question: 'What documents do I need to upload?',
        answer: 'If your company has enabled Vetting, you will see an "Onboarding Checklist" on your dashboard. Follow the instructions to upload ID, proof of address, or other required documents.'
    },

    // === ADMIN: ROTA ===
    {
        id: 'a1', category: 'admin',
        question: 'How do I publish the rota?',
        answer: 'Shifts are created as drafts (grey). You must publish them to make them visible to staff.',
        guide: publishRotaGuide
    },
    {
        id: 'a2', category: 'admin',
        question: 'How do I repeat a shift pattern?',
        answer: 'You can repeat any shift for the rest of the week or specific days using the right-click menu.',
        guide: repeatShiftGuide
    },
    {
        id: 'a3', category: 'admin',
        question: 'How do I handle time off requests?',
        answer: 'Requests appear in the "Time Off" modal on the Rota page. You can approve or deny them there.',
        guide: timeOffGuide
    },

    // === ADMIN: VETTING & STAFF ===
    {
        id: 'a4', category: 'admin',
        question: 'How do I verify staff documents?',
        answer: 'Go to the Vetting page. Select a user to see their uploads. You can accept or reject documents. Once all checks are passed, click "Finalize" to verify the user.',
        guide: vettingGuide
    },
    {
        id: 'a5', category: 'admin',
        question: 'Can I update pay rates for multiple people?',
        answer: 'Yes, use the Bulk Adjust tool to update everyone on a specific rate at once (e.g. for minimum wage increases).',
        guide: bulkWageGuide
    },
    {
        id: 'a6', category: 'admin',
        question: 'New staff cannot clock in?',
        answer: 'If "Require Approval" is enabled in settings, you must manually approve them first in the Staff section.',
        guide: approveStaffGuide
    },

    // === ADMIN: PAYROLL & EXPORT ===
    {
        id: 'a7', category: 'admin',
        question: 'What is the Payroll Matrix?',
        answer: 'The Matrix is a high-level Excel view that lists Staff on rows and Dates on columns. It shows In/Out times and Total Hours in a grid, perfect for payroll entry.',
        guide: exportGuide
    },
    {
        id: 'a8', category: 'admin',
        question: 'How do I generate a QR poster?',
        answer: 'Go to Locations, add a site, and then click "Poster". You can print this for staff to scan.',
        guide: locationGuide
    },

    // === GENERAL ===
    {
      id: 'g1', category: 'general',
      question: 'How do I reset my password?',
      answer: 'Go to the login screen and tap "Forgot Password?". Enter your email to receive a reset link.'
    },
    {
      id: 'g2', category: 'general',
      question: 'Is my data secure?',
      answer: 'Yes. All connection is encrypted via SSL. We do not store passwords (we use secure hashes) and we do not track location when you are not clocking in.'
    },
  ];

  const filteredFaqs = faqs.filter(f => 
    f.category === 'general' || 
    (user?.role === 'admin' && f.category === 'admin') ||
    (user?.role === 'staff' && f.category === 'staff')
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                <BookOpen className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                Help Center
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Interactive guides and answers.</p>
          </div>
          <button 
            onClick={() => startTutorial(true)}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition shadow-lg shadow-brand-500/20"
          >
              <PlayCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Replay Welcome Tour</span>
          </button>
      </div>

      <div className="grid gap-4">
        {filteredFaqs.map((faq) => (
          <div key={faq.id} className="glass-panel bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 transition-all hover:border-brand-500/30">
            <button 
              onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-4">
                 <div className={`p-2 rounded-lg ${
                     faq.category === 'admin' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                     faq.category === 'staff' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                     'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                 }`}>
                     {faq.category === 'admin' ? <Shield className="w-5 h-5" /> :
                      faq.category === 'staff' ? <Briefcase className="w-5 h-5" /> :
                      <HelpCircle className="w-5 h-5" />}
                 </div>
                 <span className="font-bold text-slate-900 dark:text-white text-base md:text-lg">{faq.question}</span>
              </div>
              {openId === faq.id ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            
            {openId === faq.id && (
              <div className="p-6 pt-0 text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/20">
                <div className="mt-4 leading-relaxed">{faq.answer}</div>
                
                {/* Interactive Guide Button */}
                {faq.guide && (
                    <div className="mt-6">
                        <button 
                            onClick={() => startGuide(faq.guide!)}
                            className="flex items-center space-x-2 text-brand-600 dark:text-brand-400 font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-4 py-3 rounded-xl shadow-sm hover:shadow-md hover:border-brand-500 transition group"
                        >
                            <Zap className="w-4 h-4 fill-current" />
                            <span>Show me how to do this</span>
                            <ExternalLink className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                        </button>
                    </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-center text-white relative overflow-hidden">
          <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-2">Still stuck?</h3>
              <p className="text-slate-300 mb-6">Our support team is ready to help you.</p>
              <a href="mailto:support@tallyd.app" className="inline-block bg-white text-slate-900 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition">
                  Contact Support
              </a>
          </div>
          {/* Decor */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
      </div>
    </div>
  );
};
