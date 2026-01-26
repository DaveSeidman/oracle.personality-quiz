import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const timersRef = useRef([]);
  const optionsShownRef = useRef(false);
  
  const { selection = 'single', maxSelections = 1, options } = question;
  const maxAllowed = selection === 'single' ? 1 : (maxSelections || options.length);
  
  // Get options in presentation order
  const orderedOptions = presentationOrder.map(id => 
    options.find(o => o.id === id)
  ).filter(Boolean);
  
  // Reveal options with timing
  useEffect(() => {
    if (!isActive) return;
    
    // Clear any existing timers
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    setVisibleOptions([]);
    optionsShownRef.current = false;
    
    const questionDelay = question.text.length * questionSpeed + 500;
    
    orderedOptions.forEach((option, index) => {
      const cumulativeDelay = orderedOptions
        .slice(0, index)
        .reduce((acc, o) => acc + o.text.length * answerSpeed, 0);
      const interOptionDelay = index * 100;
      const startDelay = questionDelay + cumulativeDelay + interOptionDelay;
      
      const timer = setTimeout(() => {
        setVisibleOptions(prev => [...prev, option.id]);
        
        // Mark options shown when first option appears
        if (!optionsShownRef.current) {
          optionsShownRef.current = true;
          markOptionsShown?.();
        }
      }, startDelay);
      
      timersRef.current.push(timer);
    });
    
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, [isActive, question, orderedOptions, questionSpeed, answerSpeed, markOptionsShown]);
  
  const handlePointerEnter = useCallback((e, optionId) => {
    trackInteraction?.({
      type: 'hover',
      targetId: optionId,
      data: { x: e.clientX, y: e.clientY },
    });
  }, [trackInteraction]);
  
  const handlePointerDown = useCallback((e, optionId) => {
    trackInteraction?.({
      type: 'pointerdown',
      targetId: optionId,
      pressure: getPointerPressure(e),
      data: { x: e.clientX, y: e.clientY },
    });
  }, [trackInteraction]);
  
  const handleSelect = useCallback((e, optionId) => {
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
            className={`text-multiple-choice__option ${isVisible(option.id) ? 'visible' : ''} ${isSelected(option.id) ? 'selected' : ''}`}
            style={{ '--index': index }}
            disabled={!isVisible(option.id) || (!canSelectMore && !isSelected(option.id) && selection === 'multiple')}
            onPointerEnter={(e) => handlePointerEnter(e, option.id)}
            onPointerDown={(e) => handlePointerDown(e, option.id)}
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
