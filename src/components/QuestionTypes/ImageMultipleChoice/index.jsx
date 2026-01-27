import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
    
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    setVisibleOptions([]);
    optionsShownRef.current = false;
    
    orderedOptions.forEach((option, index) => {
      const startDelay = index * 150;
      
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
  
  // Track which option is currently pressed (for detecting drag-away)
  const pressedOptionRef = useRef(null);
  
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
    pressedOptionRef.current = optionId;
    setPressedId(optionId);
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
    pressedOptionRef.current = null;
    setPressedId(null);
  }, []);
  
  const handlePointerCancel = useCallback((e, optionId) => {
    setPressedId(null);
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
    pressedOptionRef.current = null;
    setPressedId(null);
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
            className={`image-multiple-choice__option ${isVisible(option.id) ? 'visible' : ''} ${isSelected(option.id) ? 'selected' : ''} ${pressedId === option.id ? 'pressed' : ''}`}
            style={{ '--index': index }}
            disabled={!isVisible(option.id) || (!canSelectMore && !isSelected(option.id) && selection === 'multiple')}
            onPointerEnter={(e) => handlePointerEnter(e, option.id)}
            onPointerDown={(e) => handlePointerDown(e, option.id)}
            onPointerLeave={(e) => handlePointerLeave(e, option.id)}
            onPointerUp={(e) => handlePointerUp(e, option.id)}
            onPointerCancel={(e) => handlePointerCancel(e, option.id)}
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
