import React, { useState, useEffect, useRef, useCallback } from 'react';
import { haptic, getPointerPressure } from '../../../utils';
import './index.scss';

const ImageMultipleChoice = ({
  question,
  presentationOrder,
  isActive,
  onComplete,
  trackInteraction,
  trackSelection,
  markOptionsShown,
  questionSpeed = 50,
}) => {
  const [visibleOptions, setVisibleOptions] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [imagesLoaded, setImagesLoaded] = useState({});
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
    
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    setVisibleOptions([]);
    optionsShownRef.current = false;
    
    const questionDelay = question.text.length * questionSpeed + 500;
    
    orderedOptions.forEach((option, index) => {
      const startDelay = questionDelay + (index * 200);
      
      const timer = setTimeout(() => {
        setVisibleOptions(prev => [...prev, option.id]);
        
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
  }, [isActive, question, orderedOptions, questionSpeed, markOptionsShown]);
  
  const handleImageLoad = useCallback((optionId) => {
    setImagesLoaded(prev => ({ ...prev, [optionId]: true }));
  }, []);
  
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
    });
    
    if (selection === 'single') {
      setSelectedIds([optionId]);
      trackSelection?.(optionId, true);
      
      setVisibleOptions(orderedOptions.map(o => o.id));
      timersRef.current.forEach(t => clearTimeout(t));
      
      setTimeout(() => {
        onComplete?.([optionId]);
      }, 300);
    } else {
      setSelectedIds(prev => {
        const isSelected = prev.includes(optionId);
        
        if (isSelected) {
          trackSelection?.(optionId, false);
          return prev.filter(id => id !== optionId);
        } else if (prev.length < maxAllowed) {
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
    <div className="image-multiple-choice">
      <div className="image-multiple-choice__grid">
        {orderedOptions.map((option, index) => (
          <button
            key={option.id}
            className={`image-multiple-choice__option ${isVisible(option.id) ? 'visible' : ''} ${isSelected(option.id) ? 'selected' : ''}`}
            style={{ '--index': index }}
            disabled={!isVisible(option.id) || (!canSelectMore && !isSelected(option.id) && selection === 'multiple')}
            onPointerEnter={(e) => handlePointerEnter(e, option.id)}
            onPointerDown={(e) => handlePointerDown(e, option.id)}
            onClick={(e) => handleSelect(e, option.id)}
          >
            <div className="image-multiple-choice__image-wrapper">
              {option.image && (
                <img
                  src={option.image}
                  alt={option.text}
                  className={`image-multiple-choice__image ${imagesLoaded[option.id] ? 'loaded' : ''}`}
                  onLoad={() => handleImageLoad(option.id)}
                />
              )}
              {!option.image && (
                <div className="image-multiple-choice__placeholder">
                  {option.text.charAt(0)}
                </div>
              )}
              {selection === 'multiple' && (
                <span className="image-multiple-choice__checkbox">
                  {isSelected(option.id) ? '✓' : ''}
                </span>
              )}
            </div>
            <span className="image-multiple-choice__label">
              {option.text}
            </span>
          </button>
        ))}
      </div>
      
      {selection === 'multiple' && (
        <div className="image-multiple-choice__footer">
          <span className="image-multiple-choice__count">
            {selectedIds.length} / {maxAllowed} selected
          </span>
          <button
            className="image-multiple-choice__confirm"
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

export default ImageMultipleChoice;
