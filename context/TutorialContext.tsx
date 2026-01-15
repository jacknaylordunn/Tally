
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
              content: "Let's give you a quick tour of your Workforce OS. We'll show you how to manage shifts, track time, and handle payroll.",
              position: 'center',
              action: 'next'
          },
          {
              targetId: 'nav-dashboard',
              title: 'Live Dashboard',
              content: 'This is your Command Center. Monitor live attendance and see who is clocked in right now.',
              position: 'right',
              action: 'next'
          },
          {
              targetId: 'nav-rota',
              title: 'Smart Rota',
              content: 'Build conflict-free schedules and manage shift bids here.',
              position: 'right',
              action: 'next'
          },
          {
              targetId: 'nav-timesheets',
              title: 'Payroll Ready',
              content: 'Export accurate timesheets with automatic holiday pay calculations.',
              position: 'right',
              action: 'next'
          },
          
          // 2. Interactive Rota Task
          {
              targetId: 'nav-rota',
              title: 'Let\'s Schedule',
              content: 'Enough looking! Let\'s build a shift. Click the **Rota** tab to continue.',
              action: 'click'
          }
      ];

      if (hasRota) {
          workflow.push(
              {
                  targetId: 'rota-add-btn-0',
                  title: 'Create a Shift',
                  content: 'Click the + button on the first day to add a new shift.',
                  requiredRoute: '/admin/rota',
                  position: 'bottom',
                  action: 'click'
              },
              {
                  targetId: 'shift-save-btn',
                  title: 'Save Shift',
                  content: 'Fill in the details (or leave defaults) and click Save to create a draft.',
                  position: 'top',
                  action: 'click'
              },
              {
                  targetId: 'rota-publish-menu-btn',
                  title: 'Publish Schedule',
                  content: 'Draft shifts (grey) are invisible to staff. Click Publish to send them out.',
                  position: 'left',
                  action: 'click'
              },
              {
                  targetId: 'publish-week-btn',
                  title: 'Confirm Publish',
                  content: 'Select "Publish Current Week" to notify your team.',
                  position: 'left',
                  action: 'click'
              }
          );
      } else {
          // If rota disabled, skip straight to next section
          workflow.push({
              targetId: 'nav-staff',
              title: 'Skip Rota',
              content: 'Since rota is disabled, let\'s manage staff instead.',
              action: 'click'
          });
      }

      // 3. Interactive Staff Task
      workflow.push(
          {
              targetId: 'nav-staff',
              title: 'Manage Staff',
              content: 'Now let\'s look at your team. Click the **Staff** tab.',
              action: 'click'
          },
          {
              targetId: 'staff-bulk-btn',
              title: 'Bulk Tools',
              content: 'Need to give everyone a raise? Click here to see bulk tools.',
              requiredRoute: '/admin/staff',
              position: 'bottom',
              action: 'click'
          },
          {
              targetId: 'bulk-close-btn',
              title: 'Close Modal',
              content: 'Simple right? Close this window to continue.',
              position: 'left',
              action: 'click'
          },
          
          // 4. Locations Task
          {
              targetId: 'nav-locations',
              title: 'Locations',
              content: 'Finally, let\'s get your clock-in posters. Click **Locations**.',
              action: 'click'
          },
          {
              targetId: 'location-print-btn',
              title: 'Get QR Poster',
              content: 'Click "Generate Poster" on your main location to see the clock-in code.',
              requiredRoute: '/admin/locations',
              position: 'top',
              action: 'click'
          },
          {
              targetId: 'location-poster-close-btn',
              title: 'Print & Close',
              content: 'You can print this page for your wall. Click the X to close the modal.',
              position: 'left',
              action: 'click'
          },
          
          // 5. Back to Dashboard & Kiosk Intro
          {
              targetId: 'nav-dashboard',
              title: 'Back to HQ',
              content: 'We are almost done. Click **Live Board** to return to the dashboard.',
              action: 'click'
          },
          {
              targetId: 'dashboard-kiosk-btn',
              title: 'Kiosk Mode',
              content: 'This button launches Kiosk Mode. It turns any tablet or computer into a dedicated, stationary clock-in terminal for your staff.',
              requiredRoute: '/admin',
              position: 'bottom',
              action: 'next'
          },
          
          // 6. Finish
          {
              targetId: 'welcome-modal', // Dummy ID for center positioning
              title: 'You are Ready!',
              content: 'You have mastered the basics of Tallyd. You can now start adding your staff and building your first schedule.',
              position: 'center',
              action: 'next'
          }
      );

      return workflow;
  };

  // --- Interactive Staff Script (Mobile Optimized) ---
  const getStaffSteps = (): TutorialStep[] => [
      // 1. Intro
      {
          targetId: 'welcome-modal',
          title: 'Welcome',
          content: 'Let\'s get you set up. Tap Next for a quick tour.',
          position: 'center',
          action: 'next'
      },
      {
          targetId: 'staff-clock-in-btn',
          title: 'Clock In',
          content: 'Tap the big button to scan a QR code and clock in.',
          position: 'bottom',
          action: 'next'
      },
      
      // 2. Interactive Task
      {
          targetId: 'nav-rota',
          title: 'Check Schedule',
          content: 'Tap **My Rota** to see your shifts or book a holiday.',
          action: 'click'
      },
      {
          targetId: 'staff-rota-timeoff-btn',
          title: 'Time Off',
          content: 'Tap here to request leave.',
          requiredRoute: '/staff/rota',
          position: 'bottom',
          action: 'click'
      },
      {
          targetId: 'timeoff-close-btn',
          title: 'Close Form',
          content: 'Close this window for now.',
          position: 'right',
          action: 'click'
      },
      
      // 3. Conclusion
      {
          targetId: 'nav-dashboard',
          title: 'All Done',
          content: 'Tap **Status** to go back home.',
          action: 'click'
      }
  ];

  const startTutorial = async (force = false) => {
      if (!user) return;
      
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
