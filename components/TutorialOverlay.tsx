
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

  // Persistent Element Finder with Mobile Fallback
  useEffect(() => {
    if (!isActive || !step) return;

    const findTarget = () => {
        // Route check
        if (step.requiredRoute && !location.pathname.includes(step.requiredRoute)) {
            setTargetRect(null);
            return;
        }

        let el = document.getElementById(step.targetId);
        let rect = el?.getBoundingClientRect();

        // 1. Try finding the primary target
        let found = el && rect && rect.width > 0 && rect.height > 0;

        // 2. If not found or hidden, try mobile specific ID
        if (!found) {
            const mobileEl = document.getElementById(`mobile-${step.targetId}`);
            if (mobileEl) {
                const mobileRect = mobileEl.getBoundingClientRect();
                if (mobileRect.width > 0 && mobileRect.height > 0) {
                    el = mobileEl;
                    rect = mobileRect;
                    found = true;
                }
            }
        }

        if (found && el && rect) {
            setTargetRect(rect);
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            
            // Click Listener for action steps
            if (step.action === 'click') {
                const handler = () => setTimeout(() => nextStep(), 300);
                el.addEventListener('click', handler, { once: true });
            }
        } else {
            setTargetRect(null);
        }
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

  // --- ROBUST POSITIONING LOGIC ---
  const getPopoverStyle = () => {
      if (!targetRect || step.position === 'center') {
          return {
              style: { 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)', 
                  position: 'fixed' as const,
                  width: 'min(90vw, 448px)'
              },
              arrowStyle: {},
              arrowClass: null
          };
      }

      const padding = 16; // Safe area from screen edge
      const gap = 20;     // Distance from target
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      
      // Estimate card dimensions if not yet measured (fallback)
      const w = cardRect?.width || Math.min(viewportW - 32, 448);
      const h = cardRect?.height || 200;

      // --- 1. Determine Base Position ---
      let pos = step.position || 'bottom';

      // Auto-flip for bottom edge (e.g. mobile nav)
      // If target is very close to bottom, force top
      if (pos === 'bottom' && targetRect.bottom > viewportH - 100) {
          pos = 'top';
      }
      
      // Auto-flip for right edge (e.g. admin sidebar on small screen)
      if (pos === 'right' && targetRect.right + w + gap > viewportW) {
          pos = 'bottom';
      }

      // --- 2. Calculate Coordinates ---
      let t = 0;
      let l = 0;
      let transform = '';
      let arrowBaseClass = '';

      switch (pos) {
          case 'top':
              t = targetRect.top - gap;
              l = targetRect.left + (targetRect.width / 2);
              transform = 'translate(-50%, -100%)'; // Centered horizontally, moved up
              arrowBaseClass = 'bottom-[-8px] left-1/2 -translate-x-1/2 border-t-white dark:border-t-slate-900 border-l-transparent border-r-transparent border-b-transparent';
              break;
          case 'bottom':
              t = targetRect.bottom + gap;
              l = targetRect.left + (targetRect.width / 2);
              transform = 'translate(-50%, 0)'; // Centered horizontally
              arrowBaseClass = 'top-[-8px] left-1/2 -translate-x-1/2 border-b-white dark:border-b-slate-900 border-l-transparent border-r-transparent border-t-transparent';
              break;
          case 'left':
              t = targetRect.top + (targetRect.height / 2);
              l = targetRect.left - gap;
              transform = 'translate(-100%, -50%)'; // Centered vertically, moved left
              arrowBaseClass = 'right-[-8px] top-1/2 -translate-y-1/2 border-l-white dark:border-l-slate-900 border-t-transparent border-b-transparent border-r-transparent';
              break;
          case 'right':
              t = targetRect.top + (targetRect.height / 2);
              l = targetRect.right + gap;
              transform = 'translate(0, -50%)'; // Centered vertically
              arrowBaseClass = 'left-[-8px] top-1/2 -translate-y-1/2 border-r-white dark:border-r-slate-900 border-t-transparent border-b-transparent border-l-transparent';
              break;
          default:
              // Fallback to center logic handled above
              break;
      }

      // --- 3. Clamp Logic (The Fix) ---
      // We calculate the actual bounding box of the card based on `t`, `l`, and `transform`.
      // Then we shift `t` or `l` to keep it onscreen.
      
      let arrowOffsetX = 0;
      let arrowOffsetY = 0;

      if (pos === 'top' || pos === 'bottom') {
          // Centered Horizontally. 
          // Left Edge = l - w/2
          // Right Edge = l + w/2
          
          const minX = padding + (w / 2);
          const maxX = viewportW - padding - (w / 2);
          
          const originalL = l;
          l = Math.max(minX, Math.min(l, maxX)); // Clamp
          
          // Calculate arrow offset to keep pointing at target
          // The arrow moves with the card. We need to shift the arrow BACK by the amount we shifted the card.
          // Shift amount = l - originalL (new position - old position)
          // Arrow offset = -(l - originalL) = originalL - l
          arrowOffsetX = originalL - l;
      } 
      else {
          // Left / Right
          // Centered Vertically.
          // Top Edge = t - h/2
          // Bottom Edge = t + h/2
          
          const minY = padding + (h / 2);
          const maxY = viewportH - padding - (h / 2);
          
          const originalT = t;
          t = Math.max(minY, Math.min(t, maxY)); // Clamp
          
          arrowOffsetY = originalT - t;
      }

      // Limit arrow offset to stay within card radius (so arrow doesn't float in air)
      const maxArrowShiftX = (w / 2) - 24; // 24px corner radius safe zone
      const maxArrowShiftY = (h / 2) - 24;
      
      arrowOffsetX = Math.max(-maxArrowShiftX, Math.min(maxArrowShiftX, arrowOffsetX));
      arrowOffsetY = Math.max(-maxArrowShiftY, Math.min(maxArrowShiftY, arrowOffsetY));

      return { 
          style: { 
              top: `${t}px`, 
              left: `${l}px`, 
              transform, 
              position: 'fixed' as const,
              width: `${w}px`
          },
          arrowClass: arrowBaseClass,
          arrowStyle: {
              marginLeft: `${arrowOffsetX}px`,
              marginTop: `${arrowOffsetY}px`
          }
      };
  };

  const { style, arrowClass, arrowStyle } = getPopoverStyle();

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none transition-opacity duration-500 ease-in-out">
        
        {/* Subtle Backdrop - Conditional Opacity */}
        <div className={`absolute inset-0 transition-all duration-500 ${step.transparentBackdrop ? 'bg-transparent' : 'bg-slate-950/40'}`} />

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
            className="max-w-md pointer-events-auto transition-all duration-500 absolute z-[60]"
            style={style}
        >
            {/* Arrow Tip */}
            {arrowClass && (
                <div 
                    className={`absolute w-0 h-0 border-[8px] ${arrowClass} drop-shadow-sm z-10 transition-all duration-300`}
                    style={arrowStyle}
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
