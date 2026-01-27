import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { haptic, getPointerPressure } from '../../../utils';
import './index.scss';

const TextMultipleChoice = ({
  question,
  presentationOrder,
  isActive,
  onComplete,
  trackInteraction,
  trackSelection,
  markOptionsShown,
  questionSpeed = 50,
  answerSpeed = 60,
}) => {
  const [visibleOptions, setVisibleOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pressedId, setPressedId] = useState(null); // Track which button is pressed
  const timersRef = useRef([]);
  const optionsShownRef = useRef(false);
  const markOptionsShownRef = useRef(markOptionsShown);
  
  // Keep ref updated
  markOptionsShownRef.current = markOptionsShown;
  
  const { selection = 'single', maxSelections = 1, options } = question;
  const maxAllowed = selection === 'single' ? 1 : (maxSelections || options.length);
  
  // Get options in presentation order - memoized to prevent infinite loops
  const orderedOptions = useMemo(() => 
    presentationOrder.map(id => options.find(o => o.id === id)).filter(Boolean),
    [presentationOrder, options]
  );
  
  // Reveal options with timing (no questionDelay since Question wrapper already handles that)
  useEffect(() => {
    if (!isActive) return;
    
    // Clear any existing timers
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    setVisibleOptions([]);
    optionsShownRef.current = false;
    
    orderedOptions.forEach((option, index) => {
      // Just stagger the options, no need to wait for question text again
      const startDelay = index * 100;
      
      const timer = setTimeout(() => {
        setVisibleOptions(prev => [...prev, option.id]);
        
        // Mark options shown when first option appears
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
  
  // Track which option is currently pressed (for detecting drag-away)
  const pressedOptionRef = useRef(null);
  
  const handlePointerEnter = useCallback((e, optionId) => {
    trackInteraction?.({
      type: 'hover',
      targetId: optionId,
      data: { x: e.clientX, y: e.clientY },
    });
  }, [trackInteraction]);
  
  const handlePointerDown = useCallback((e, optionId) => {
    pressedOptionRef.current = optionId;
    setPressedId(optionId); // Set pressed state for styling
    trackInteraction?.({
      type: 'pointerdown',
      targetId: optionId,
      pressure: getPointerPressure(e),
      data: { x: e.clientX, y: e.clientY },
    });
  }, [trackInteraction]);
  
  const handlePointerLeave = useCallback((e, optionId) => {
    // Always clear pressed state on leave
    if (pressedId === optionId) {
      setPressedId(null);
    }
    
    // Check if they were pressing this button and dragged away (changed mind)
    if (pressedOptionRef.current === optionId) {
      trackInteraction?.({
        type: 'pointerleave-while-pressed',
        targetId: optionId,
        data: { 
          x: e.clientX, 
          y: e.clientY,
          changedMind: true,
        },
      });
      pressedOptionRef.current = null;
    } else {
      trackInteraction?.({
        type: 'pointerleave',
        targetId: optionId,
        data: { x: e.clientX, y: e.clientY },
      });
    }
  }, [trackInteraction, pressedId]);
  
  const handlePointerUp = useCallback((e, optionId) => {
    // Clear pressed state on any pointer up
    pressedOptionRef.current = null;
    setPressedId(null);
  }, []);
  
  const handlePointerCancel = useCallback((e, optionId) => {
    // Clear pressed state
    setPressedId(null);
    
    // Track cancelled interactions (finger dragged off screen, etc)
    if (pressedOptionRef.current === optionId) {
      trackInteraction?.({
        type: 'pointercancel',
        targetId: optionId,
        data: { changedMind: true },
      });
      pressedOptionRef.current = null;
    }
  }, [trackInteraction]);
  
  const handleSelect = useCallback((e, optionId) => {
    pressedOptionRef.current = null; // Clear pressed state
    setPressedId(null);
    haptic(20);
    
    const pressure = getPointerPressure(e);
    trackInteraction?.({
      type: 'click',
      targetId: optionId,
      pressure,
      data: { x: e.clientX, y: e.clientY },
    });
    
    if (selection === 'single') {
      // Single selection - immediately complete
      setSelectedIds([optionId]);
      trackSelection?.(optionId, true);
      
      // Show all options instantly
      setVisibleOptions(orderedOptions.map(o => o.id));
      timersRef.current.forEach(t => clearTimeout(t));
      
      setTimeout(() => {
        onComplete?.([optionId]);
      }, 300);
    } else {
      // Multiple selection
      setSelectedIds(prev => {
        const isSelected = prev.includes(optionId);
        
        if (isSelected) {
          // Deselect
          trackSelection?.(optionId, false);
          return prev.filter(id => id !== optionId);
        } else if (prev.length < maxAllowed) {
          // Select
          trackSelection?.(optionId, true);
          return [...prev, optionId];
        }
        
        return prev;
      });
    }
  }, [selection, maxAllowed, trackInteraction, trackSelection, onComplete, orderedOptions]);
  
  const handleConfirm = useCallback(() => {
    if (selectedIds.length > 0) {
      haptic(30);
      onComplete?.(selectedIds);
    }
  }, [selectedIds, onComplete]);
  
  const isSelected = (id) => selectedIds.includes(id);
  const isVisible = (id) => visibleOptions.includes(id);
  const canSelectMore = selection === 'multiple' && selectedIds.length < maxAllowed;
  
  return (
    <div className="text-multiple-choice">
      <div className="text-multiple-choice__options">
        {orderedOptions.map((option, index) => (
          <button
            key={option.id}
            className={`text-multiple-choice__option ${isVisible(option.id) ? 'visible' : ''} ${isSelected(option.id) ? 'selected' : ''} ${pressedId === option.id ? 'pressed' : ''}`}
            style={{ '--index': index }}
            disabled={!isVisible(option.id) || (!canSelectMore && !isSelected(option.id) && selection === 'multiple')}
            onPointerEnter={(e) => handlePointerEnter(e, option.id)}
            onPointerDown={(e) => handlePointerDown(e, option.id)}
            onPointerLeave={(e) => handlePointerLeave(e, option.id)}
            onPointerUp={(e) => handlePointerUp(e, option.id)}
            onPointerCancel={(e) => handlePointerCancel(e, option.id)}
            onClick={(e) => handleSelect(e, option.id)}
          >
            <span className="text-multiple-choice__option-text">
              {option.text}
            </span>
            {selection === 'multiple' && (
              <span className="text-multiple-choice__option-checkbox">
                {isSelected(option.id) ? '✓' : ''}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {selection === 'multiple' && (
        <div className="text-multiple-choice__footer">
          <span className="text-multiple-choice__count">
            {selectedIds.length} / {maxAllowed} selected
          </span>
          <button
            className="text-multiple-choice__confirm"
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

export default TextMultipleChoice;
