import React, { useState, useEffect, useRef, useCallback } from 'react';
import { haptic, getPointerPressure, throttle } from '../../../utils';
import './index.scss';

const StatementSlider = ({
  statement,
  isVisible,
  index,
  initialValue,
  trackInteraction,
  trackSliderChange,
  onChange,
}) => {
  const { id, text, min = 0, max = 10, step = 1, labels = {} } = statement;
  const defaultValue = initialValue !== undefined ? initialValue : Math.round((max - min) / 2) + min;
  const [value, setValue] = useState(defaultValue);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef(null);
  const startValueRef = useRef(value);
  
  // Update value when initialValue changes (for revision)
  useEffect(() => {
    if (initialValue !== undefined) {
      setValue(initialValue);
    }
  }, [initialValue]);
  
  // Generate tick marks
  const ticks = [];
  if (step) {
    for (let i = min; i <= max; i += step) {
      ticks.push(i);
    }
  }
  
  const handlePointerDown = useCallback((e) => {
    setIsDragging(true);
    startValueRef.current = value;
    
    trackInteraction?.({
      type: 'range-start',
      targetId: id,
      pressure: getPointerPressure(e),
      data: { startValue: value },
    });
  }, [id, value, trackInteraction]);
  
  const handleChange = useCallback((e) => {
    const newValue = parseFloat(e.target.value);
    setValue(newValue);
    
    // Haptic at each step
    if (step && newValue !== value) {
      haptic(5);
    }
    
    trackSliderChange?.(id, newValue, value);
    onChange?.(id, newValue);
  }, [id, step, value, trackSliderChange, onChange]);
  
  const handlePointerUp = useCallback((e) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    
    trackInteraction?.({
      type: 'range-end',
      targetId: id,
      pressure: getPointerPressure(e),
      data: { 
        finalValue: value,
        startValue: startValueRef.current,
        totalChange: Math.abs(value - startValueRef.current),
      },
    });
  }, [isDragging, id, value, trackInteraction]);
  
  // Calculate fill percentage
  const fillPercent = ((value - min) / (max - min)) * 100;
  
  return (
    <div 
      className={`statement-slider ${isVisible ? 'visible' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ '--index': index, opacity: isVisible ? undefined : 0 }}
    >
      <p className="statement-slider__text">{text}</p>
      
      <div className="statement-slider__container">
        {labels[min] && (
          <span className="statement-slider__label statement-slider__label--min">
            {labels[min]}
          </span>
        )}
        
        <div className="statement-slider__track-wrapper">
          <div 
            ref={sliderRef}
            className="statement-slider__track"
          >
            <div 
              className="statement-slider__fill"
              style={{ width: `${fillPercent}%` }}
            />
            {/* Tick marks */}
            {step && ticks.map(tick => (
              <div 
                key={tick}
                className={`statement-slider__tick ${tick === value ? 'active' : ''}`}
                style={{ left: `${((tick - min) / (max - min)) * 100}%` }}
              />
            ))}
            <div 
              className="statement-slider__thumb"
              style={{ left: `${fillPercent}%` }}
            />
          </div>
          
          <input
            type="range"
            min={min}
            max={max}
            step={step || 'any'}
            value={value}
            className="statement-slider__input"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onChange={handleChange}
          />
          
          <div 
            className="statement-slider__value"
            style={{ left: `${fillPercent}%` }}
          >
            {step ? value : value.toFixed(1)}
          </div>
        </div>
        
        {labels[max] && (
          <span className="statement-slider__label statement-slider__label--max">
            {labels[max]}
          </span>
        )}
      </div>
    </div>
  );
};

const RangeSlider = ({
  question,
  presentationOrder,
  isActive,
  isLocked,
  isRevising,
  previousResponse,
  onComplete,
  trackInteraction,
  trackSliderChange,
  markOptionsShown,
  questionSpeed = 50,
}) => {
  const [visibleCount, setVisibleCount] = useState(0);
  const [values, setValues] = useState({});
  const [isReady, setIsReady] = useState(false);
  const timersRef = useRef([]);
  const optionsShownRef = useRef(false);
  const markOptionsShownRef = useRef(markOptionsShown);
  
  // Keep ref updated
  markOptionsShownRef.current = markOptionsShown;
  
  const { statements = [] } = question;
  
  // Reveal statements with timing
  useEffect(() => {
    // If locked or revising, show all immediately with saved values
    if (isLocked || isRevising) {
      setVisibleCount(statements.length);
      setIsReady(true);
      
      // Use previousResponse for both locked (current answer) and revising (original answer)
      const initialValues = {};
      statements.forEach(stmt => {
        if (previousResponse && previousResponse[stmt.id] !== undefined) {
          initialValues[stmt.id] = previousResponse[stmt.id];
        } else {
          initialValues[stmt.id] = Math.round(((stmt.max || 10) - (stmt.min || 0)) / 2) + (stmt.min || 0);
        }
      });
      setValues(initialValues);
      markOptionsShownRef.current?.();
      return;
    }
    
    if (!isActive) return;
    
    // Fresh start - reset everything
    setVisibleCount(0);
    setIsReady(false);
    setValues({});
    optionsShownRef.current = false;
    
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    
    statements.forEach((stmt, index) => {
      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + 1);
        
        // Initialize with middle value
        setValues(prev => ({
          ...prev,
          [stmt.id]: Math.round(((stmt.max || 10) - (stmt.min || 0)) / 2) + (stmt.min || 0),
        }));
        
        if (!optionsShownRef.current) {
          optionsShownRef.current = true;
          markOptionsShownRef.current?.();
        }
        
        if (index === statements.length - 1) {
          setTimeout(() => setIsReady(true), 300);
        }
      }, index * 250);
      
      timersRef.current.push(timer);
    });
    
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, [isActive, isLocked, isRevising, statements, previousResponse]);
  
  const handleValueChange = useCallback((statementId, value) => {
    setValues(prev => ({ ...prev, [statementId]: value }));
  }, []);
  
  const handleConfirm = useCallback(() => {
    haptic(30);
    onComplete?.(values);
  }, [values, onComplete]);
  
  return (
    <div className="range-slider">
      <div className="range-slider__statements">
        {statements.map((statement, index) => (
          <StatementSlider
            key={statement.id}
            statement={statement}
            index={index}
            isVisible={index < visibleCount}
            initialValue={values[statement.id]}
            trackInteraction={trackInteraction}
            trackSliderChange={trackSliderChange}
            onChange={handleValueChange}
          />
        ))}
      </div>
      
      <button
        className={`range-slider__confirm ${isReady ? 'visible' : ''}`}
        style={{ opacity: isReady ? undefined : 0 }}
        disabled={!isReady}
        onClick={handleConfirm}
      >
        Confirm Ratings
      </button>
    </div>
  );
};

export default RangeSlider;
