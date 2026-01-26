/**
 * General utility functions
 */

// Fisher-Yates shuffle
export const shuffle = (array) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Get the best matching personality based on scores
export const getBestOption = (scores) => {
  let best = null;
  let bestScore = -Infinity;
  
  Object.entries(scores).forEach(([id, score]) => {
    if (score > bestScore) {
      bestScore = score;
      best = { id, score };
    }
  });
  
  return best;
};

// Haptic feedback utility
export const haptic = (pattern = 10) => {
  if (navigator?.vibrate) {
    navigator.vibrate(pattern);
  }
};

// Format time in ms to human readable
export const formatTime = (ms) => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// Clamp a value between min and max
export const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

// Generate a unique ID
export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Debounce function
export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Throttle function
export const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Deep clone an object
export const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

// Check if we're on a touch device
export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

// Get pointer pressure from event (returns 0.5 as default if not available)
export const getPointerPressure = (event) => {
  if (event.pressure !== undefined && event.pressure > 0) {
    return event.pressure;
  }
  // Default pressure for mouse/touch without pressure support
  return 0.5;
};
