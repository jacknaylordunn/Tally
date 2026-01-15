
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useTutorial } from '../context/TutorialContext';
import { X, ArrowRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const TutorialOverlay = () => {
  const { isActive, steps, currentStepIndex, nextStep, prevStep, endTutorial } = useTutorial();
  const location = useLocation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[currentStepIndex];

  // Persistent Element Finder
  useEffect(() => {
    if (!isActive || !step) return;

    const findTarget = () => {
        // Route check
        if (step.requiredRoute && !location.pathname.includes(step.requiredRoute)) {
            setTargetRect(null);
            return;
        }

        const el = document.getElementById(step.targetId);
        if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                setTargetRect(rect);
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Click Listener for action steps
                if (step.action === 'click') {
                    const handler = () => setTimeout(() => nextStep(), 300);
                    el.addEventListener('click', handler, { once: true });
                }
                return; 
            }
        }
        setTargetRect(null); 
    };

    const interval = setInterval(findTarget, 500);
    findTarget(); // Immediate check

    return () => clearInterval(interval);
  }, [isActive, step, location.pathname, currentStepIndex, nextStep]);

  // Measure card size for collision detection
  useLayoutEffect(() => {
      if (cardRef.current) {
          setCardRect(cardRef.current.getBoundingClientRect());
      }
  }, [step, targetRect]);

  if (!isActive || !step) return null;

  // --- POSITIONING LOGIC ---
  const getPopoverStyle = () => {
      if (!targetRect || step.position === 'center') {
          return {
              style: { 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)', 
                  position: 'fixed' as const 
              },
              arrowClass: null
          };
      }

      const gap = 24;
      const viewportWidth = window.innerWidth;
      // Use 90vw for mobile, clamp to max-w-md (28rem) for desktop
      const cardW = Math.min(viewportWidth * 0.9, 448); 
      
      let top = 0;
      let left = 0;
      let arrowClass = '';
      
      // Initial Position Calculation
      switch (step.position) {
          case 'top':
              top = targetRect.top - gap;
              left = targetRect.left + (targetRect.width / 2);
              arrowClass = 'bottom-[-8px] left-1/2 -translate-x-1/2 border-t-white dark:border-t-slate-900 border-l-transparent border-r-transparent border-b-transparent';
              break;
          case 'left':
              top = targetRect.top + (targetRect.height / 2);
              left = targetRect.left - gap;
              arrowClass = 'right-[-8px] top-1/2 -translate-y-1/2 border-l-white dark:border-l-slate-900 border-t-transparent border-b-transparent border-r-transparent';
              break;
          case 'right':
              top = targetRect.top + (targetRect.height / 2);
              left = targetRect.right + gap;
              arrowClass = 'left-[-8px] top-1/2 -translate-y-1/2 border-r-white dark:border-r-slate-900 border-t-transparent border-b-transparent border-l-transparent';
              break;
          case 'bottom':
          default:
              top = targetRect.bottom + gap;
              left = targetRect.left + (targetRect.width / 2);
              arrowClass = 'top-[-8px] left-1/2 -translate-x-1/2 border-b-white dark:border-b-slate-900 border-l-transparent border-r-transparent border-t-transparent';
              break;
      }

      // --- BOUNDARY CLAMPING ---
      const padding = 16;

      if (step.position === 'top' || step.position === 'bottom') {
          // Clamp Left (X axis)
          const minLeft = (cardW / 2) + padding;
          const maxLeft = viewportWidth - (cardW / 2) - padding;
          
          if (left < minLeft) left = minLeft;
          if (left > maxLeft) left = maxLeft;

          // Adjust Arrow to point back to target if we shifted the card
          const originalCenter = targetRect.left + (targetRect.width / 2);
          const offset = originalCenter - left;
          // Limit arrow offset to keep it within card radius
          const maxOffset = (cardW / 2) - 24; 
          const arrowOffset = Math.max(-maxOffset, Math.min(maxOffset, offset));
          
          // Rebuild arrow style with margin
          if (step.position === 'top') {
             arrowClass = `bottom-[-8px] left-1/2 border-t-white dark:border-t-slate-900 border-l-transparent border-r-transparent border-b-transparent ml-[${arrowOffset}px]`;
          } else {
             arrowClass = `top-[-8px] left-1/2 border-b-white dark:border-b-slate-900 border-l-transparent border-r-transparent border-t-transparent ml-[${arrowOffset}px]`;
          }
      }

      let transform = '';
      if (step.position === 'left' || step.position === 'right') {
          transform = 'translate(0, -50%)';
          // Simple flip if off screen
          if (step.position === 'right' && left + cardW > viewportWidth) {
             left = targetRect.left - gap - cardW;
             transform = 'translate(0, -50%)'; 
             arrowClass = 'right-[-8px] top-1/2 -translate-y-1/2 border-l-white dark:border-l-slate-900 border-t-transparent border-b-transparent border-r-transparent';
          }
      } else {
          transform = 'translate(-50%, 0)';
          if (step.position === 'top') transform = 'translate(-50%, -100%)';
      }

      return { 
          style: { top: `${top}px`, left: `${left}px`, transform, position: 'fixed' as const },
          arrowClass
      };
  };

  const { style, arrowClass } = getPopoverStyle();

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none transition-opacity duration-500 ease-in-out">
        
        {/* Subtle Backdrop */}
        <div className="absolute inset-0 bg-slate-950/40 transition-all duration-500" />

        {/* Target Spotlight */}
        {targetRect && step.position !== 'center' && (
            <div 
                className={`absolute rounded-xl transition-all duration-300 ease-out z-50 pointer-events-none ${
                    step.action === 'click' 
                        ? 'ring-4 ring-brand-500/80 shadow-[0_0_50px_rgba(99,102,241,0.6)] animate-pulse' 
                        : 'ring-2 ring-white/50'
                }`}
                style={{
                    top: targetRect.top - 6,
                    left: targetRect.left - 6,
                    width: targetRect.width + 12,
                    height: targetRect.height + 12,
                }}
            />
        )}

        {/* Tutorial Card */}
        <div 
            ref={cardRef}
            className="w-[90vw] max-w-md pointer-events-auto transition-all duration-500 absolute z-[60]"
            style={style}
        >
            {/* Arrow Tip */}
            {arrowClass && (
                <div 
                    className={`absolute w-0 h-0 border-[8px] ${arrowClass} drop-shadow-sm z-10 transition-all duration-300`}
                    style={arrowClass.includes('ml-') ? { marginLeft: arrowClass.match(/ml-\[(.*?)\]/)?.[1] } : {}}
                ></div>
            )}

            {/* Inner Card Content */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col ring-1 ring-black/5">
                
                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800">
                    <div 
                        className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-500 ease-out" 
                        style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                    />
                </div>

                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-bold text-xl text-slate-900 dark:text-white leading-tight pr-4">{step.title}</h3>
                        <button onClick={endTutorial} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    {/* Content */}
                    <p className="text-slate-600 dark:text-slate-300 text-base mb-6 leading-relaxed font-medium">
                        {step.content}
                    </p>

                    {/* Footer */}
                    <div className="flex justify-between items-center mt-auto pt-2 border-t border-slate-100 dark:border-slate-800/50">
                        <div className="text-xs font-bold text-slate-400 tracking-widest uppercase mt-4">
                            Step {currentStepIndex + 1} <span className="font-medium text-slate-300 dark:text-slate-600">/ {steps.length}</span>
                        </div>
                        
                        <div className="flex items-center space-x-3 mt-4">
                            {/* Skip Step Button (Only if interactive) */}
                            {step.action === 'click' && targetRect && step.position !== 'center' ? (
                                <button onClick={nextStep} className="text-xs font-bold text-slate-400 hover:text-brand-400 transition uppercase tracking-wide px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
                                    Skip
                                </button>
                            ) : (
                                <button 
                                    onClick={nextStep}
                                    className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition shadow-lg shadow-brand-500/20 group hover:scale-105 active:scale-95"
                                >
                                    <span>{currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
