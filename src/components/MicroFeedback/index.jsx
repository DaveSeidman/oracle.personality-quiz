import React, { useState, useEffect, useRef, useMemo } from 'react';
import './index.scss';

// Type-on effect component
const TypeOnText = ({ text, delay = 0, speed = 25, onComplete }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    if (!text) return;
    
    setDisplayedText('');
    setIsComplete(false);
    
    let currentIndex = 0;
    let timeoutId;
    
    const startTyping = () => {
      const typeNextChar = () => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
          timeoutId = setTimeout(typeNextChar, speed);
        } else {
          setIsComplete(true);
          onComplete?.();
        }
      };
      typeNextChar();
    };
    
    const delayTimeout = setTimeout(startTyping, delay);
    
    return () => {
      clearTimeout(delayTimeout);
      clearTimeout(timeoutId);
    };
  }, [text, delay, speed, onComplete]);
  
  return (
    <span className={`type-on-text ${isComplete ? 'complete' : ''}`}>
      {displayedText}
      {!isComplete && displayedText.length > 0 && <span className="type-on-text__cursor">|</span>}
    </span>
  );
};

const MicroFeedback = ({ feedback, isVisible = true }) => {
  const containerRef = useRef(null);
  
  // Generate random positions for each feedback item - memoized per feedback content
  const positions = useMemo(() => {
    if (!feedback || feedback.length === 0) return [];
    
    // Define safe zones spread across the viewport
    const zones = [
      // Top left
      { xMin: 5, xMax: 30, yMin: 15, yMax: 30 },
      // Top right  
      { xMin: 70, xMax: 95, yMin: 15, yMax: 30 },
      // Middle left
      { xMin: 5, xMax: 25, yMin: 40, yMax: 55 },
      // Middle right
      { xMin: 75, xMax: 95, yMin: 40, yMax: 55 },
      // Bottom left
      { xMin: 5, xMax: 30, yMin: 65, yMax: 80 },
      // Bottom right
      { xMin: 70, xMax: 95, yMin: 65, yMax: 80 },
    ];
    
    // Shuffle zones
    const shuffledZones = [...zones].sort(() => Math.random() - 0.5);
    
    return feedback.map((_, index) => {
      const zone = shuffledZones[index % shuffledZones.length];
      return {
        left: `${zone.xMin + Math.random() * (zone.xMax - zone.xMin)}%`,
        top: `${zone.yMin + Math.random() * (zone.yMax - zone.yMin)}%`,
      };
    });
  }, [feedback]);
  
  if (!feedback || feedback.length === 0 || !isVisible) return null;
  
  return (
    <div className="micro-feedback" ref={containerRef}>
      {feedback.map((item, index) => (
        <div
          key={`${index}-${item.text?.slice(0, 20)}`}
          className="micro-feedback__item"
          style={{
            left: positions[index]?.left,
            top: positions[index]?.top,
          }}
        >
          <TypeOnText
            text={item.text}
            delay={index * 500} // Stagger each message by 500ms
            speed={20}
          />
        </div>
      ))}
    </div>
  );
};

export default MicroFeedback;
