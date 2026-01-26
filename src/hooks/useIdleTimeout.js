import { useEffect, useRef, useCallback } from 'react';

export const useIdleTimeout = (onIdle, delay = 45000) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(onIdle);
  
  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onIdle;
  }, [onIdle]);
  
  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current?.();
    }, delay);
  }, [delay]);
  
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    const events = ['click', 'touchstart', 'pointermove', 'keydown'];
    
    events.forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });
    
    // Start the timer
    resetTimer();
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
      clearTimer();
    };
  }, [resetTimer, clearTimer]);
  
  return { resetTimer, clearTimer };
};

export default useIdleTimeout;
