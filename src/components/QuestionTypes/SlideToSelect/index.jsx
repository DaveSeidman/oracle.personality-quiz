import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { haptic, getPointerPressure } from '../../../utils';
import './index.scss';

const SLIDER_THRESHOLD = 0.85; // Must slide to 85% to select

const SlideOption = ({
  option,
  index,
  isVisible,
  isSelected,
  isDisabled,
  onSelect,
  trackInteraction,
  trackSliderChange,
}) => {
  const [sliderValue, setSliderValue] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef(null);
  const startTimeRef = useRef(null);
  const startXRef = useRef(null);
  
  const handlePointerDown = useCallback((e) => {
    if (isDisabled || isSelected) return;
    
    e.preventDefault();
    setIsDragging(true);
    startTimeRef.current = performance.now();
    startXRef.current = e.clientX;
    
    trackInteraction?.({
      type: 'slider-start',
      targetId: option.id,
      pressure: getPointerPressure(e),
      data: { x: e.clientX },
    });
    
    // Capture pointer for smooth tracking
    e.target.setPointerCapture?.(e.pointerId);
  }, [isDisabled, isSelected, option.id, trackInteraction]);
  
  const handlePointerMove = useCallback((e) => {
    if (!isDragging || !sliderRef.current) return;
    
    const rect = sliderRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    
    setSliderValue(percentage);
    trackSliderChange?.(option.id, percentage, sliderValue);
    
    // Light haptic at threshold
    if (percentage >= SLIDER_THRESHOLD && sliderValue < SLIDER_THRESHOLD) {
      haptic(10);
    }
  }, [isDragging, option.id, sliderValue, trackSliderChange]);
  
  const handlePointerUp = useCallback((e) => {
    if (!isDragging) return;
    
    const duration = startTimeRef.current ? performance.now() - startTimeRef.current : 0;
    
    trackInteraction?.({
      type: 'slider-end',
      targetId: option.id,
      pressure: getPointerPressure(e),
      data: { 
        finalValue: sliderValue,
        duration,
        distance: e.clientX - (startXRef.current || 0),
      },
    });
    
    setIsDragging(false);
    
    if (sliderValue >= SLIDER_THRESHOLD) {
      haptic(30);
      onSelect?.(option.id, duration);
    } else {
      // Reset slider with animation
      setSliderValue(0);
    }
    
    e.target.releasePointerCapture?.(e.pointerId);
  }, [isDragging, sliderValue, option.id, onSelect, trackInteraction]);
  
  const handlePointerEnter = useCallback((e) => {
    trackInteraction?.({
      type: 'hover',
      targetId: option.id,
      data: { x: e.clientX, y: e.clientY },
    });
  }, [option.id, trackInteraction]);
  
  return (
    <div
      className={`slide-option ${isVisible ? 'visible' : ''} ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ '--index': index }}
      onPointerEnter={handlePointerEnter}
    >
      <div 
        ref={sliderRef}
        className="slide-option__track"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div 
          className="slide-option__fill"
          style={{ width: `${sliderValue * 100}%` }}
        />
        <div 
          className="slide-option__thumb"
          style={{ left: `${sliderValue * 100}%` }}
        >
          <span className="slide-option__thumb-icon">
            {sliderValue >= SLIDER_THRESHOLD ? '✓' : '→'}
          </span>
        </div>
        <div className="slide-option__text">
          {option.text}
        </div>
        <div className="slide-option__hint">
          {isSelected ? 'Selected' : 'Slide to select'}
        </div>
      </div>
    </div>
  );
};

const SlideToSelect = ({
  question,
  presentationOrder,
  isActive,
  onComplete,
  trackInteraction,
  trackSelection,
  trackSliderChange,
  markOptionsShown,
  questionSpeed = 50,
}) => {
  const [visibleOptions, setVisibleOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sliderDurations, setSliderDurations] = useState({});
  const timersRef = useRef([]);
  const optionsShownRef = useRef(false);
  const markOptionsShownRef = useRef(markOptionsShown);
  
  // Keep ref updated
  markOptionsShownRef.current = markOptionsShown;
  
  const { selection = 'single', maxSelections = 1, options } = question;
  const maxAllowed = selection === 'single' ? 1 : (maxSelections || options.length);
  
  // Memoize to prevent infinite loops
  const orderedOptions = useMemo(() => 
    presentationOrder.map(id => options.find(o => o.id === id)).filter(Boolean),
    [presentationOrder, options]
  );
  
  useEffect(() => {
    if (!isActive) return;
    
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    setVisibleOptions([]);
    optionsShownRef.current = false;
    
    orderedOptions.forEach((option, index) => {
      const startDelay = index * 200;
      
      const timer = setTimeout(() => {
        setVisibleOptions(prev => [...prev, option.id]);
        
        if (!optionsShownRef.current) {
          optionsShownRef.current = true;
          markOptionsShownRef.current?.();
        }
      }, startDelay);
      
      timersRef.current.push(timer);
    });
    
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, [isActive, orderedOptions]);
  
  const handleSelect = useCallback((optionId, duration) => {
    trackSelection?.(optionId, true);
    setSliderDurations(prev => ({ ...prev, [optionId]: duration }));
    
    if (selection === 'single') {
      setSelectedIds([optionId]);
      
      // Show all options
      setVisibleOptions(orderedOptions.map(o => o.id));
      timersRef.current.forEach(t => clearTimeout(t));
      
      setTimeout(() => {
        onComplete?.([optionId], { sliderDuration: duration });
      }, 300);
    } else {
      setSelectedIds(prev => {
        if (prev.length < maxAllowed) {
          return [...prev, optionId];
        }
        return prev;
      });
    }
  }, [selection, maxAllowed, trackSelection, onComplete, orderedOptions]);
  
  const handleConfirm = useCallback(() => {
    if (selectedIds.length > 0) {
      haptic(30);
      onComplete?.(selectedIds, { sliderDurations });
    }
  }, [selectedIds, sliderDurations, onComplete]);
  
  const isSelected = (id) => selectedIds.includes(id);
  const isVisible = (id) => visibleOptions.includes(id);
  const canSelectMore = selection === 'multiple' && selectedIds.length < maxAllowed;
  
  return (
    <div className="slide-to-select">
      <div className="slide-to-select__options">
        {orderedOptions.map((option, index) => (
          <SlideOption
            key={option.id}
            option={option}
            index={index}
            isVisible={isVisible(option.id)}
            isSelected={isSelected(option.id)}
            isDisabled={!canSelectMore && !isSelected(option.id) && selection === 'multiple'}
            onSelect={handleSelect}
            trackInteraction={trackInteraction}
            trackSliderChange={trackSliderChange}
          />
        ))}
      </div>
      
      {selection === 'multiple' && (
        <div className="slide-to-select__footer">
          <span className="slide-to-select__count">
            {selectedIds.length} / {maxAllowed} selected
          </span>
          <button
            className="slide-to-select__confirm"
            disabled={selectedIds.length === 0}
            onClick={handleConfirm}
          >
            Confirm Selection
          </button>
        </div>
      )}
    </div>
  );
};

export default SlideToSelect;
