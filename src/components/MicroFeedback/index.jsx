import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.scss';

const FeedbackMessage = ({ message, onComplete }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  
  useEffect(() => {
    // Fade in
    const showTimer = setTimeout(() => setIsVisible(true), 50);
    
    // Start exit
    const exitTimer = setTimeout(() => setIsExiting(true), 2500);
    
    // Complete and remove
    const completeTimer = setTimeout(() => {
      onComplete?.();
    }, 3000);
    
    return () => {
      clearTimeout(showTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);
  
  const getImpactClass = () => {
    switch (message.impact) {
      case 'positive': return 'positive';
      case 'negative': return 'negative';
      default: return 'neutral';
    }
  };
  
  const getIcon = () => {
    switch (message.type) {
      case 'confidence': return '✓';
      case 'deliberation': return '◷';
      case 'exploration': return '⟲';
      case 'pressure': return '◉';
      case 'slider-speed': return '→';
      case 'slider-hesitation': return '⋯';
      case 'reordering': return '↕';
      case 'hesitation': return '?';
      case 'range-adjustment': return '≈';
      case 'editing': return '✎';
      case 'pauses': return '⏸';
      case 'selection-order': return '#';
      default: return '•';
    }
  };
  
  return (
    <div className={`feedback-message ${isVisible ? 'visible' : ''} ${isExiting ? 'exiting' : ''} ${getImpactClass()}`}>
      <span className="feedback-message__icon">{getIcon()}</span>
      <span className="feedback-message__text">{message.text}</span>
    </div>
  );
};

const MicroFeedback = ({ feedback, onComplete }) => {
  const [displayMessages, setDisplayMessages] = useState([]);
  const messageIdRef = useRef(0);
  const lastFeedbackRef = useRef(null);
  
  // Process new feedback only when it actually changes
  useEffect(() => {
    // Skip if no feedback or same feedback array reference
    if (!feedback || feedback === lastFeedbackRef.current) return;
    
    // Skip if feedback is empty array
    if (Array.isArray(feedback) && feedback.length === 0) return;
    
    // Mark this feedback as processed
    lastFeedbackRef.current = feedback;
    
    // Add new messages
    const newMessages = (Array.isArray(feedback) ? feedback : [feedback])
      .filter(m => m && m.text)
      .map(m => ({
        ...m,
        id: ++messageIdRef.current,
      }));
    
    if (newMessages.length > 0) {
      setDisplayMessages(prev => [...prev, ...newMessages].slice(-3)); // Keep max 3
    }
  }, [feedback]);
  
  const handleMessageComplete = useCallback((messageId) => {
    setDisplayMessages(prev => prev.filter(m => m.id !== messageId));
    onComplete?.();
  }, [onComplete]);
  
  if (displayMessages.length === 0) return null;
  
  return (
    <div className="micro-feedback">
      {displayMessages.map((message) => (
        <FeedbackMessage
          key={message.id}
          message={message}
          onComplete={() => handleMessageComplete(message.id)}
        />
      ))}
    </div>
  );
};

export default MicroFeedback;
