
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TutorialStep, UserRole } from '../types';
import { useAuth } from './AuthContext';
import { getCompany } from '../services/api';

interface TutorialContextType {
  isActive: boolean;
  currentStepIndex: number;
  steps: TutorialStep[];
  startTutorial: (force?: boolean) => void;
  endTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const TutorialProvider = ({ children }: { children?: ReactNode }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  
  // Ref to prevent double-skipping from simultaneous click + route events
  const isAdvancingRef = useRef(false);

  // --- Interactive Admin Script ---
  const getAdminSteps = (hasRota: boolean): TutorialStep[] => {
      const workflow: TutorialStep[] = [
          // 1. Intro Tour
          {
              targetId: 'welcome-modal', // Dummy ID for center positioning
              title: 'Welcome to Tallyd',
              content: "Let's give you a complete tour of your Workforce OS. We'll show you how to eliminate time theft, automate payroll, and manage your team efficiently.",
              position: 'center',
              action: 'next'
          },
          {
              targetId: 'nav-dashboard',
              title: 'Live Command Center',
              content: 'This dashboard gives you a real-time pulse of your business. See exactly who is on-site, track current labor costs, and spot attendance issues (like late arrivals) the moment they happen.',
              position: 'right',
              action: 'next'
          },
          {
              targetId: 'nav-rota',
              title: 'Smart Scheduling',
              content: 'Build conflict-free schedules in minutes. The Rota system handles shift bidding, time-off requests, and budget forecasting before you even publish the week.',
              position: 'right',
              action: 'next'
          },
          {
              targetId: 'nav-timesheets',
              title: 'Payroll Automation',
              content: 'Forget manual calculations. Timesheets are generated automatically from clock-in data, complete with holiday pay and overtime calculations, ready for export.',
              position: 'right',
              action: 'next'
          },
          
          // 2. Interactive Rota Task
          {
              targetId: 'nav-rota',
              title: 'Let\'s Build a Shift',
              content: 'The best way to learn is to do. Click the **Rota** tab to create your first schedule entry.',
              action: 'click'
          }
      ];

      if (hasRota) {
          workflow.push(
              {
                  targetId: 'rota-add-btn-0',
                  title: 'Create a Shift',
                  content: 'Click the + button on the first day. You can create single shifts for specific staff, or "Open Slots" that your team can bid for.',
                  requiredRoute: '/admin/rota',
                  position: 'bottom',
                  action: 'click'
              },
              {
                  targetId: 'shift-modal-container',
                  title: 'Shift Configuration',
                  content: 'Set the role and time. If you leave "Assign Staff" as Open, eligible staff will be notified to claim the shift. This is great for filling gaps quickly.',
                  position: 'right',
                  action: 'next',
                  transparentBackdrop: true
              },
              {
                  targetId: 'shift-save-btn',
                  title: 'Save Draft',
                  content: 'Click Save to add this to the board. It remains a "Draft" (invisible to staff) until you are ready to publish the week.',
                  position: 'top',
                  action: 'click',
                  transparentBackdrop: true
              },
              {
                  targetId: 'rota-publish-menu-btn',
                  title: 'Publishing Control',
                  content: 'When your plan is solid, use the Publish menu. This sends push notifications to all affected staff so they know when to work.',
                  position: 'left',
                  action: 'click'
              },
              {
                  targetId: 'publish-week-btn',
                  title: 'Confirm Publish',
                  content: 'Select "Publish Current Week" to make these shifts live.',
                  position: 'left',
                  action: 'click'
              }
          );
      } else {
          workflow.push({
              targetId: 'nav-staff',
              title: 'Skip Rota',
              content: 'Since the Rota module is disabled, we will move straight to Staff management.',
              action: 'click'
          });
      }

      // 3. Interactive Staff Task
      workflow.push(
          {
              targetId: 'nav-staff',
              title: 'Staff Management',
              content: 'Click **Staff** to manage your team. This is where you handle pay rates, roles, and access levels.',
              action: 'click'
          },
          {
              targetId: 'staff-bulk-btn',
              title: 'Bulk Operations',
              content: 'Need to apply a pay rise across the board? The Bulk Adjust tool saves you editing profiles one by one.',
              requiredRoute: '/admin/staff',
              position: 'bottom',
              action: 'click'
          },
          {
              targetId: 'bulk-update-container',
              title: 'Global Updates',
              content: 'You can filter staff by their current rate (e.g. £11.44) and update them all to a new rate (e.g. £12.00) in seconds.',
              position: 'right',
              action: 'next',
              transparentBackdrop: true
          },
          {
              targetId: 'bulk-close-btn',
              title: 'Close Modal',
              content: 'Close this window to continue the tour.',
              position: 'left',
              action: 'click',
              transparentBackdrop: true
          },

          // 4. Kiosk Intro (Security Focus)
          {
              targetId: 'nav-kiosk',
              title: 'Anti-Fraud Kiosk Mode',
              content: 'Click **Kiosk** to see our secure terminal. This is designed for tablets mounted at your entrance.',
              action: 'click'
          },
          {
              targetId: 'kiosk-exit-btn',
              title: 'Dynamic Security',
              content: 'Notice the QR code? It regenerates every 10 seconds. This prevents "Buddy Punching" (staff taking a photo of the code to clock in a friend later). It requires a live scan.',
              requiredRoute: '/admin/kiosk',
              position: 'bottom',
              action: 'click',
              transparentBackdrop: true
          },
          
          // 5. Locations Task (GPS Focus)
          {
              targetId: 'nav-locations',
              title: 'GPS-Locked Posters',
              content: 'For unmanned sites where a tablet isn\'t possible, use **Locations**. Click to verify your geofences.',
              action: 'click'
          },
          {
              targetId: 'location-print-btn',
              title: 'Static QR Security',
              content: 'Click "Generate Poster". Unlike the Kiosk, this code doesn\'t change. Instead, we use the phone\'s GPS to verify the employee is physically inside the geofence radius before accepting the scan.',
              requiredRoute: '/admin/locations',
              position: 'top',
              action: 'click'
          },
          {
              targetId: 'location-poster-close-btn',
              title: 'Print & Go',
              content: 'Print this and stick it on the wall. It\'s a zero-hardware solution for secure time tracking. Close the modal to finish.',
              position: 'left',
              action: 'click',
              transparentBackdrop: true
          },
          
          // 6. Finish
          {
              targetId: 'nav-dashboard',
              title: 'Tour Complete',
              content: 'You are now an expert! Return to the **Live Board** to see your operation in action.',
              action: 'click'
          }
      );

      return workflow;
  };

  // --- Interactive Staff Script (Mobile Optimized) ---
  const getStaffSteps = (): TutorialStep[] => [
      {
          targetId: 'welcome-modal',
          title: 'Welcome to Tallyd',
          content: 'This app is your digital timecard. We\'ll show you how to clock in and manage your shifts.',
          position: 'center',
          action: 'next'
      },
      {
          targetId: 'staff-clock-in-btn',
          title: 'Clock In',
          content: 'Tap this button to open the scanner. Point it at the Kiosk or QR Poster at your workplace to start your shift.',
          position: 'bottom',
          action: 'next'
      },
      {
          targetId: 'nav-rota',
          title: 'Your Schedule',
          content: 'Tap **My Rota** to see when you are working next, bid on open shifts, or request holiday.',
          action: 'click'
      },
      {
          targetId: 'staff-rota-timeoff-btn',
          title: 'Request Leave',
          content: 'Need a day off? Tap here to send a request directly to your manager.',
          requiredRoute: '/staff/rota',
          position: 'bottom',
          action: 'click'
      },
      {
          targetId: 'timeoff-close-btn',
          title: 'Close Form',
          content: 'Close this to finish up.',
          position: 'right',
          action: 'click',
          transparentBackdrop: true
      },
      {
          targetId: 'nav-dashboard',
          title: 'All Set',
          content: 'Tap **Status** to return to your home screen.',
          action: 'click'
      }
  ];

  const startTutorial = async (force = false) => {
      if (!user) return;
      
      // Fix: Do not reset tutorial if already active and not forced
      if (isActive && !force) return;

      const hasSeen = localStorage.getItem(`tally_tutorial_${user.id}`);
      if (hasSeen && !force) return;

      let companySettings = null;
      if (user.currentCompanyId) {
          try {
              const c = await getCompany(user.currentCompanyId);
              companySettings = c.settings;
          } catch (e) { console.error(e); }
      }

      // Force boolean for rotaEnabled
      const hasRota = companySettings?.rotaEnabled === true;

      const generatedSteps = user.role === UserRole.ADMIN 
          ? getAdminSteps(hasRota)
          : getStaffSteps();

      setSteps(generatedSteps);
      setCurrentStepIndex(0);
      setIsActive(true);
      isAdvancingRef.current = false;
      
      // Ensure we start on dashboard
      if (user.role === UserRole.ADMIN) navigate('/admin');
      else navigate('/staff');
  };

  const endTutorial = () => {
      setIsActive(false);
      if (user) {
          localStorage.setItem(`tally_tutorial_${user.id}`, 'true');
      }
  };

  const nextStep = () => {
      if (isAdvancingRef.current) return;
      
      isAdvancingRef.current = true;
      setTimeout(() => { isAdvancingRef.current = false; }, 600); // Debounce

      if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
      } else {
          endTutorial();
      }
  };

  const prevStep = () => {
      if (currentStepIndex > 0) {
          setCurrentStepIndex(prev => prev - 1);
      }
  };

  // Route Watcher: Auto-advance if the user navigates manually to the required route of the *next* step
  useEffect(() => {
      if (!isActive || steps.length === 0) return;

      const nextStepObj = steps[currentStepIndex + 1];

      // If the NEXT step requires a route, and we just arrived there, we can auto-advance
      // This handles the case where the user clicks a nav link (action: 'click') and the route changes
      if (nextStepObj?.requiredRoute && location.pathname.includes(nextStepObj.requiredRoute)) {
          // Only advance if we haven't just advanced via click handler
          if (!isAdvancingRef.current) {
              nextStep();
          }
      }
  }, [location.pathname, isActive, steps, currentStepIndex]);

  return (
    <TutorialContext.Provider value={{ isActive, currentStepIndex, steps, startTutorial, endTutorial, nextStep, prevStep }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) throw new Error('useTutorial must be used within a TutorialProvider');
  return context;
};
