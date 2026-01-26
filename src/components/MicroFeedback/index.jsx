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

const MicroFeedback = ({ feedback, messages = [], onComplete }) => {
  const [displayMessages, setDisplayMessages] = useState([]);
  const messageIdRef = useRef(0);
  const queueRef = useRef([]);
  const isProcessingRef = useRef(false);
  
  // Handle single feedback prop or messages array
  useEffect(() => {
    // Process feedback array (from generateMicroFeedback)
    if (Array.isArray(feedback) && feedback.length > 0) {
      queueRef.current = [...queueRef.current, ...feedback.map(m => ({
        ...m,
        id: ++messageIdRef.current,
      }))];
    } 
    // Process single feedback object
    else if (feedback && typeof feedback === 'object' && feedback.text) {
      queueRef.current.push({
        ...feedback,
        id: ++messageIdRef.current,
      });
    }
    // Process messages array (legacy prop)
    else if (messages.length > 0) {
      queueRef.current = [...queueRef.current, ...messages.map(m => ({
        ...m,
        id: ++messageIdRef.current,
      }))];
    }
  }, [feedback, messages]);
  
  // Process queue
  useEffect(() => {
    const processQueue = () => {
      if (isProcessingRef.current || queueRef.current.length === 0) return;
      
      isProcessingRef.current = true;
      const nextMessage = queueRef.current.shift();
      
      setDisplayMessages(prev => [...prev.slice(-2), nextMessage]);
      
      // Allow next message after delay
      setTimeout(() => {
        isProcessingRef.current = false;
        processQueue();
      }, 800);
    };
    
    const interval = setInterval(processQueue, 100);
    return () => clearInterval(interval);
  }, []);
  
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
