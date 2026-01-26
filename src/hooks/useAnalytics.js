import { useState, useCallback, useRef, useMemo } from 'react';
import {
  createQuestionAnalytics,
  recordInteraction,
  recordSelection,
  recordRankMove,
  recordSliderChange,
  recordTyping,
  finalizeQuestionAnalytics,
} from '../utils/analytics';

export const useAnalytics = () => {
  const [allAnalytics, setAllAnalytics] = useState([]);
  const [currentAnalytics, setCurrentAnalytics] = useState(null);
  const feedbackQueueRef = useRef([]);
  
  // Initialize analytics for a question (takes prepared question with presentationOrder)
  const initQuestion = useCallback((question) => {
    if (!question) return null;
    
    // Use the pre-calculated presentation order from prepared questions
    const presentationOrder = question.presentationOrder || 
      question.options?.map(o => o.id) || 
      question.statements?.map(s => s.id) || 
      [];
    
    const analytics = createQuestionAnalytics(question, presentationOrder);
    setCurrentAnalytics(analytics);
    
    return { analytics, presentationOrder };
  }, []);
  
  // Mark when options become visible
  const markOptionsShown = useCallback(() => {
    setCurrentAnalytics(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        timing: {
          ...prev.timing,
          optionsShownAt: performance.now(),
        },
      };
    });
  }, []);
  
  // Track interaction (hover, click, etc.)
  const trackInteraction = useCallback((event) => {
    setCurrentAnalytics(prev => {
      if (!prev) return prev;
      return recordInteraction(prev, event);
    });
  }, []);
  
  // Track selection
  const trackSelection = useCallback((optionId, isSelected = true) => {
    setCurrentAnalytics(prev => {
      if (!prev) return prev;
      return recordSelection(prev, optionId, isSelected);
    });
  }, []);
  
  // Track rank move
  const trackRankMove = useCallback((itemId, fromIndex, toIndex) => {
    setCurrentAnalytics(prev => {
      if (!prev) return prev;
      return recordRankMove(prev, itemId, fromIndex, toIndex);
    });
  }, []);
  
  // Track slider change
  const trackSliderChange = useCallback((sliderId, value, prevValue) => {
    setCurrentAnalytics(prev => {
      if (!prev) return prev;
      return recordSliderChange(prev, sliderId, value, prevValue);
    });
  }, []);
  
  // Track typing
  const trackTyping = useCallback((text, event) => {
    setCurrentAnalytics(prev => {
      if (!prev) return prev;
      return recordTyping(prev, text, event);
    });
  }, []);
  
  // Set final rankings for ranked-choice
  const setFinalRankings = useCallback((finalOrder) => {
    setCurrentAnalytics(prev => {
      if (!prev || !prev.rankings) return prev;
      return {
        ...prev,
        rankings: {
          ...prev.rankings,
          final: finalOrder,
        },
      };
    });
  }, []);
  
  // Finalize current question and return analytics
  const finalizeQuestion = useCallback((responseData) => {
    if (!currentAnalytics) return null;
    
    // Structure the response based on question type
    let response;
    if (Array.isArray(responseData)) {
      // Multiple choice types pass array of selected IDs
      response = {
        ...currentAnalytics.response,
        selectedIds: responseData,
      };
    } else if (typeof responseData === 'string') {
      // Free response passes text string
      response = {
        ...currentAnalytics.response,
        text: responseData,
      };
    } else if (typeof responseData === 'object') {
      // Range slider passes object of values
      response = {
        ...currentAnalytics.response,
        ...responseData,
      };
    } else {
      response = currentAnalytics.response;
    }
    
    // Add response to analytics
    const withResponse = {
      ...currentAnalytics,
      response,
    };
    
    const finalized = finalizeQuestionAnalytics(withResponse);
    
    // Add to all analytics
    setAllAnalytics(prev => [...prev, finalized]);
    setCurrentAnalytics(null);
    
    return finalized;
  }, [currentAnalytics]);
  
  // Get next micro-feedback message
  const popMicroFeedback = useCallback(() => {
    if (feedbackQueueRef.current.length === 0) return null;
    const next = feedbackQueueRef.current.shift();
    return next;
  }, []);
  
  // Add custom micro-feedback
  const addMicroFeedback = useCallback((message) => {
    feedbackQueueRef.current.push(message);
  }, []);
  
  // Get all analytics
  const getAllAnalytics = useCallback(() => {
    return allAnalytics;
  }, [allAnalytics]);
  
  // Reset all analytics
  const reset = useCallback(() => {
    setAllAnalytics([]);
    setCurrentAnalytics(null);
    feedbackQueueRef.current = [];
  }, []);
  
  return useMemo(() => ({
    currentAnalytics,
    allAnalytics,
    
    // Actions
    initQuestion,
    markOptionsShown,
    trackInteraction,
    trackSelection,
    trackRankMove,
    trackSliderChange,
    trackTyping,
    setFinalRankings,
    finalizeQuestion,
    popMicroFeedback,
    addMicroFeedback,
    getAllAnalytics,
    reset,
  }), [
    currentAnalytics,
    allAnalytics,
    initQuestion,
    markOptionsShown,
    trackInteraction,
    trackSelection,
    trackRankMove,
    trackSliderChange,
    trackTyping,
    setFinalRankings,
    finalizeQuestion,
    popMicroFeedback,
    addMicroFeedback,
    getAllAnalytics,
    reset,
  ]);
};

export default useAnalytics;
