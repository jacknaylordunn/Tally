
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { useTutorial } from '../context/TutorialContext';
import { X, ArrowRight, HelpCircle, Check } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { TutorialStep } from '../types';

export const TutorialOverlay = () => {
  const { 
      isActive, steps, currentStepIndex, nextStep, endTutorial,
      activeGuide, guideStepIndex, nextGuideStep, stopGuide
  } = useTutorial();
  
  const location = useLocation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardRect, setCardRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Determine which mode we are in (Main Tour vs Interactive Guide)
  const mode = activeGuide ? 'guide' : (isActive ? 'tour' : null);
  
  // Normalize current step data based on mode
  const currentStep = mode === 'tour' 
      ? steps[currentStepIndex] 
      : (activeGuide ? activeGuide.steps[guideStepIndex] : null);

  // Persistent Element Finder
  useEffect(() => {
    if (!mode || !currentStep) return;

    const findTarget = () => {
        // For tour mode, route check is strict. For guide, navigation happens on step change.
        if (mode === 'tour') {
            const tourStep = currentStep as TutorialStep;
            if (tourStep.requiredRoute && !location.pathname.includes(tourStep.requiredRoute)) {
                setTargetRect(null);
                return;
            }
        }

        // If Guide Step has no targetId, it's an informational step (null rect)
        if (!currentStep.targetId) {
            setTargetRect(null);
            return;
        }

        let el = document.getElementById(currentStep.targetId);
        let rect = el?.getBoundingClientRect();

        // Fallback for mobile IDs in Tour mode
        if ((!el || !rect || rect.width === 0) && mode === 'tour') {
            const mobileEl = document.getElementById(`mobile-${currentStep.targetId}`);
            if (mobileEl) {
                const mobileRect = mobileEl.getBoundingClientRect();
                if (mobileRect.width > 0) {
                    el = mobileEl;
                    rect = mobileRect;
                }
            }
        }

        if (el && rect && rect.width > 0) {
            setTargetRect(rect);
            // Only scroll if off screen
            const isOffScreen = rect.top < 0 || rect.bottom > window.innerHeight;
            if (isOffScreen) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
            
            // Auto-advance logic for clicks (Tour Mode Only)
            if (mode === 'tour' && (currentStep as any).action === 'click') {
                const handler = () => setTimeout(() => nextStep(), 300);
                el.addEventListener('click', handler, { once: true });
            }
        } else {
            setTargetRect(null);
        }
    };

    const interval = setInterval(findTarget, 500);
    findTarget(); 

    return () => clearInterval(interval);
  }, [mode, currentStep, location.pathname, nextStep]);

  useLayoutEffect(() => {
      if (cardRef.current) {
          setCardRect(cardRef.current.getBoundingClientRect());
      }
  }, [currentStep, targetRect]);

  if (!mode || !currentStep) return null;

  // --- POSITIONING LOGIC ---
  const getPopoverStyle = () => {
      // 1. Center positioning (Intro cards or when no target)
      if (!targetRect || (mode === 'tour' && (currentStep as any).position === 'center')) {
          if (mode === 'guide') {
              // Guide cards without target default to bottom-right fixed
              return {
                  style: { 
                      bottom: '24px', 
                      right: '24px', 
                      position: 'fixed' as const,
                      width: '320px',
                      zIndex: 60
                  },
                  arrowClass: null
              };
          }
          return {
              style: { 
                  top: '50%', 
                  left: '50%', 
                  transform: 'translate(-50%, -50%)', 
                  position: 'fixed' as const,
                  width: 'min(90vw, 448px)',
                  zIndex: 60
              },
              arrowClass: null
          };
      }

      // 2. Relative positioning to Target
      const padding = 16;
      const gap = 20;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      
      const w = cardRect?.width || (mode === 'guide' ? 320 : 448); // Guide cards are narrower
      const h = cardRect?.height || 200;

      let pos = (currentStep as any).position || 'bottom';
      
      // Smart Flip Logic
      if (pos === 'bottom' && targetRect.bottom > viewportH - 200) pos = 'top';
      if (pos === 'right' && targetRect.right + w > viewportW) pos = 'left'; // Prefer left if right is crowded
      if (pos === 'left' && targetRect.left < w) pos = 'bottom'; // Fallback to bottom if left is tight

      // Default guide to 'left' of element if possible, else 'top' to avoid covering hand on mobile
      if (mode === 'guide' && !((currentStep as any).position)) {
          pos = targetRect.left > w + 20 ? 'left' : 'top';
      }

      let t = 0, l = 0, transform = '';
      let arrowBaseClass = '';

      switch (pos) {
          case 'top':
              t = targetRect.top - gap;
              l = targetRect.left + (targetRect.width / 2);
              transform = 'translate(-50%, -100%)'; 
              arrowBaseClass = 'bottom-[-8px] left-1/2 -translate-x-1/2 border-t-white dark:border-t-slate-900 border-l-transparent border-r-transparent border-b-transparent';
              break;
          case 'bottom':
              t = targetRect.bottom + gap;
              l = targetRect.left + (targetRect.width / 2);
              transform = 'translate(-50%, 0)'; 
              arrowBaseClass = 'top-[-8px] left-1/2 -translate-x-1/2 border-b-white dark:border-b-slate-900 border-l-transparent border-r-transparent border-t-transparent';
              break;
          case 'left':
              t = targetRect.top + (targetRect.height / 2);
              l = targetRect.left - gap;
              transform = 'translate(-100%, -50%)'; 
              arrowBaseClass = 'right-[-8px] top-1/2 -translate-y-1/2 border-l-white dark:border-l-slate-900 border-t-transparent border-b-transparent border-r-transparent';
              break;
          case 'right':
              t = targetRect.top + (targetRect.height / 2);
              l = targetRect.right + gap;
              transform = 'translate(0, -50%)';
              arrowBaseClass = 'left-[-8px] top-1/2 -translate-y-1/2 border-r-white dark:border-r-slate-900 border-t-transparent border-b-transparent border-l-transparent';
              break;
      }

      // Clamp to screen
      if (pos === 'top' || pos === 'bottom') {
          l = Math.max(padding + w/2, Math.min(l, viewportW - padding - w/2));
      } else {
          t = Math.max(padding + h/2, Math.min(t, viewportH - padding - h/2));
      }

      return { 
          style: { 
              top: `${t}px`, 
              left: `${l}px`, 
              transform, 
              position: 'fixed' as const,
              width: `${w}px`,
              zIndex: 60
          },
          arrowClass: arrowBaseClass
      };
  };

  const { style, arrowClass } = getPopoverStyle();

  // Helper to render bold text
  const renderContent = (text: string) => {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i} className="text-slate-900 dark:text-white font-bold">{part.slice(2, -2)}</strong>;
          }
          return part;
      });
  };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
        
        {/* MODE: TOUR (Dark Backdrop) */}
        {mode === 'tour' && (
            <>
                {targetRect && !(currentStep as any).transparentBackdrop ? (
                    <div 
                        className="absolute rounded-xl transition-all duration-300 ease-out z-40 pointer-events-none shadow-[0_0_0_9999px_rgba(2,6,23,0.7)]"
                        style={{
                            top: targetRect.top - 4,
                            left: targetRect.left - 4,
                            width: targetRect.width + 8,
                            height: targetRect.height + 8,
                        }}
                    />
                ) : (
                    <div className={`absolute inset-0 transition-all duration-500 ${(currentStep as any).transparentBackdrop ? 'bg-transparent' : 'bg-slate-950/70'}`} />
                )}
            </>
        )}

        {/* TARGET HIGHLIGHT RING (Both Modes) */}
        {targetRect && (
            <div 
                className={`absolute rounded-xl transition-all duration-300 ease-out z-50 pointer-events-none ${
                    mode === 'guide' 
                    ? 'ring-4 ring-brand-500 animate-pulse' // Guide: Bright pulse, no dark bg
                    : ((currentStep as any).action === 'click' ? 'ring-4 ring-brand-500/80 animate-pulse' : 'ring-2 ring-white/30') // Tour
                }`}
                style={{
                    top: targetRect.top - 4,
                    left: targetRect.left - 4,
                    width: targetRect.width + 8,
                    height: targetRect.height + 8,
                }}
            />
        )}

        {/* INFO CARD */}
        <div 
            ref={cardRef}
            className={`pointer-events-auto transition-all duration-500 absolute z-[60] flex flex-col ${
                mode === 'guide' ? 'w-80' : 'max-w-md'
            }`}
            style={style}
        >
            {arrowClass && (
                <div className={`absolute w-0 h-0 border-[8px] ${arrowClass} drop-shadow-sm z-10 transition-all duration-300`}></div>
            )}

            <div className={`
                bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col ring-1 ring-black/5
                ${mode === 'guide' ? 'shadow-brand-500/20 border-brand-500/20' : ''}
            `}>
                
                {/* Header */}
                <div className={`flex justify-between items-start p-4 ${mode === 'guide' ? 'bg-slate-50 dark:bg-slate-800/50 pb-2' : ''}`}>
                    <div className="flex items-center gap-2">
                        {mode === 'guide' && <HelpCircle className="w-4 h-4 text-brand-500" />}
                        <h3 className={`font-bold text-slate-900 dark:text-white leading-tight ${mode === 'guide' ? 'text-sm' : 'text-xl'}`}>
                            {mode === 'guide' && activeGuide ? activeGuide.title : (currentStep as TutorialStep).title}
                        </h3>
                    </div>
                    <button 
                        onClick={mode === 'tour' ? endTutorial : stopGuide} 
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Progress Bar (Tour Only) */}
                {mode === 'tour' && (
                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800">
                        <div 
                            className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 transition-all duration-500 ease-out" 
                            style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                        />
                    </div>
                )}

                {/* Content */}
                <div className="p-4 pt-2">
                    <p className={`text-slate-600 dark:text-slate-300 mb-4 leading-relaxed ${mode === 'guide' ? 'text-sm' : 'text-base font-medium'}`}>
                        {renderContent(currentStep.content)}
                    </p>

                    {/* Footer / Controls */}
                    <div className="flex justify-between items-center pt-2">
                        {mode === 'tour' ? (
                            <>
                                <div className="text-xs font-bold text-slate-400 tracking-widest uppercase">
                                    Step {currentStepIndex + 1} / {steps.length}
                                </div>
                                <div className="flex items-center space-x-3">
                                    {(currentStep as any).action === 'click' && targetRect && (currentStep as any).position !== 'center' ? (
                                        <button onClick={nextStep} className="text-xs font-bold text-slate-400 hover:text-brand-400 uppercase tracking-wide px-3 py-2">Skip</button>
                                    ) : (
                                        <button onClick={nextStep} className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-lg shadow-brand-500/20">
                                            <span>{currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </>
                        ) : (
                            // Guide Mode Controls
                            <div className="w-full flex justify-between items-center">
                                <div className="flex gap-1">
                                    {activeGuide && activeGuide.steps.map((_, i) => (
                                        <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === guideStepIndex ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                                    ))}
                                </div>
                                <button 
                                    onClick={nextGuideStep}
                                    className="flex items-center space-x-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-1.5 rounded-lg font-bold text-xs hover:opacity-90 transition"
                                >
                                    <span>{activeGuide && guideStepIndex === activeGuide.steps.length - 1 ? 'Done' : 'Next'}</span>
                                    {activeGuide && guideStepIndex === activeGuide.steps.length - 1 ? <Check className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
