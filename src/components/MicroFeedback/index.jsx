import React, { useState, useEffect, useRef } from 'react';
import './index.scss';

const MicroFeedback = ({ feedback, onComplete }) => {
  const [log, setLog] = useState([]);
  const logRef = useRef(null);
  const processedRef = useRef(new Set());
  
  // Add new feedback to log
  useEffect(() => {
    if (!feedback || feedback.length === 0) return;
    
    // Create a unique key for this feedback batch
    const feedbackKey = JSON.stringify(feedback);
    
    // Skip if we've already processed this exact feedback
    if (processedRef.current.has(feedbackKey)) return;
    processedRef.current.add(feedbackKey);
    
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    // Add each feedback item to the log
    const newEntries = feedback.map((item, idx) => ({
      id: `${Date.now()}-${idx}`,
      timestamp,
      text: item.text,
      type: item.type || 'info',
      impact: item.impact || 'neutral',
    }));
    
    setLog(prev => [...prev, ...newEntries]);
    
    // Call onComplete after a short delay
    const timer = setTimeout(() => {
      onComplete?.();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [feedback, onComplete]);
  
  // Auto-scroll to bottom when new entries added
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);
  
  // Don't render if no log entries
  if (log.length === 0) return null;
  
  return (
    <div className="micro-feedback-terminal">
      <div className="micro-feedback-terminal__header">
        <span className="micro-feedback-terminal__dot micro-feedback-terminal__dot--red" />
        <span className="micro-feedback-terminal__dot micro-feedback-terminal__dot--yellow" />
        <span className="micro-feedback-terminal__dot micro-feedback-terminal__dot--green" />
        <span className="micro-feedback-terminal__title">behavioral_analysis.log</span>
      </div>
      <div className="micro-feedback-terminal__body" ref={logRef}>
        {log.map((entry) => (
          <div 
            key={entry.id} 
            className={`micro-feedback-terminal__entry micro-feedback-terminal__entry--${entry.impact}`}
          >
            <span className="micro-feedback-terminal__timestamp">[{entry.timestamp}]</span>
            <span className="micro-feedback-terminal__text">{entry.text}</span>
          </div>
        ))}
        <div className="micro-feedback-terminal__cursor">_</div>
      </div>
    </div>
  );
};

export default MicroFeedback;
