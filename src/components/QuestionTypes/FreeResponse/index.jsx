import React, { useState, useEffect, useRef, useCallback } from 'react';
import { haptic } from '../../../utils';
import './index.scss';

const FreeResponse = ({
  question,
  isActive,
  onComplete,
  trackInteraction,
  trackTyping,
  markOptionsShown,
  questionSpeed = 50,
}) => {
  const [text, setText] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const textareaRef = useRef(null);
  const timerRef = useRef(null);
  
  const { 
    placeholder = 'Type your response...', 
    minLength = 0, 
    maxLength = 500 
  } = question;
  
  const isValid = text.length >= minLength && text.length <= maxLength;
  
  // Show input after question animation
  useEffect(() => {
    if (!isActive) return;
    
    setText('');
    setIsVisible(false);
    
    const questionDelay = question.text.length * questionSpeed + 500;
    
    timerRef.current = setTimeout(() => {
      setIsVisible(true);
      markOptionsShown?.();
      
      // Auto-focus on tablet
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }, questionDelay);
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isActive, question.text.length, questionSpeed, markOptionsShown]);
  
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    trackInteraction?.({
      type: 'focus',
      targetId: 'free-response',
    });
  }, [trackInteraction]);
  
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    trackInteraction?.({
      type: 'blur',
      targetId: 'free-response',
      data: { textLength: text.length },
    });
  }, [text.length, trackInteraction]);
  
  const handleChange = useCallback((e) => {
    const newText = e.target.value;
    
    if (newText.length <= maxLength) {
      setText(newText);
      setCharCount(newText.length);
    }
  }, [maxLength]);
  
  const handleKeyDown = useCallback((e) => {
    // Track every keystroke for typing analysis
    trackTyping?.(text + (e.key.length === 1 ? e.key : ''), e);
    
    // Submit on Enter + modifier key
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && isValid) {
      e.preventDefault();
      handleSubmit();
    }
  }, [text, isValid, trackTyping]);
  
  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    
    haptic(30);
    
    trackInteraction?.({
      type: 'submit',
      targetId: 'free-response',
      data: { 
        textLength: text.length,
        wordCount: text.split(/\s+/).filter(w => w.length > 0).length,
      },
    });
    
    onComplete?.(text);
  }, [text, isValid, trackInteraction, onComplete]);
  
  return (
    <div className={`free-response ${isVisible ? 'visible' : ''}`}>
      <div className={`free-response__input-wrapper ${isFocused ? 'focused' : ''}`}>
        <textarea
          ref={textareaRef}
          className="free-response__textarea"
          placeholder={placeholder}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          rows={4}
          maxLength={maxLength}
        />
        
        <div className="free-response__footer">
          <span className={`free-response__char-count ${text.length < minLength ? 'warning' : ''} ${text.length >= maxLength ? 'limit' : ''}`}>
            {charCount} / {maxLength}
            {minLength > 0 && text.length < minLength && (
              <span className="free-response__min-hint">
                (min {minLength})
              </span>
            )}
          </span>
          
          <span className="free-response__hint">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'} + Enter to submit
          </span>
        </div>
      </div>
      
      <button
        className="free-response__submit"
        disabled={!isValid}
        onClick={handleSubmit}
      >
        Submit Response
      </button>
    </div>
  );
};

export default FreeResponse;
