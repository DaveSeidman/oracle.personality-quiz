import { useEffect, useRef } from 'react';

export const useIdleTimeout = (delay = 45000, onIdle, enabled = true) => {
  const timeoutRef = useRef(null);
  const onIdleRef = useRef(onIdle);
  const enabledRef = useRef(enabled);
  
  // Keep refs updated without triggering effects
  onIdleRef.current = onIdle;
  enabledRef.current = enabled;
  
  useEffect(() => {
    const clearTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    
    const resetTimer = () => {
      clearTimer();
      if (enabledRef.current && onIdleRef.current) {
        timeoutRef.current = setTimeout(() => {
          onIdleRef.current?.();
        }, delay);
      }
    };
    
    const handleActivity = () => {
      if (enabledRef.current) {
        resetTimer();
      }
    };
    
    const events = ['click', 'touchstart', 'pointermove', 'keydown'];
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });
    
    // Start timer if enabled
    if (enabledRef.current) {
      resetTimer();
    }
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearTimer();
    };
  }, [delay]); // Only depend on delay, use refs for callback and enabled
  
  return {};
};

export default useIdleTimeout;
