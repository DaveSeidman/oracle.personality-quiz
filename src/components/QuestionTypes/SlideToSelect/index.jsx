import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { haptic, getPointerPressure } from '../../../utils';
import './index.scss';

const SLIDER_THRESHOLD = 0.85; // Must slide to 85% to select
const PADDING_REM = 2; // 2rem padding on each side

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
  const thumbRef = useRef(null);
  const fillRef = useRef(null);
  const startTimeRef = useRef(null);
  const startXRef = useRef(null);
  const currentValueRef = useRef(0);

  const handlePointerDown = useCallback((e) => {
    if (isDisabled || isSelected) return;

    e.preventDefault();
    setIsDragging(true);
    startTimeRef.current = performance.now();
    startXRef.current = e.clientX;
    currentValueRef.current = 0;

    trackInteraction?.({
      type: 'slider-start',
      targetId: option.id,
      pressure: getPointerPressure(e),
      data: { x: e.clientX },
    });

    e.target.setPointerCapture?.(e.pointerId);
  }, [isDisabled, isSelected, option.id, trackInteraction]);

  const handlePointerMove = useCallback((e) => {
    if (!isDragging || !sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    // Calculate padding in pixels (based on font-size, assume 16px base scaled by tablet)
    const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const paddingPx = PADDING_REM * fontSize;

    const usableWidth = rect.width - (paddingPx * 2);
    const x = e.clientX - rect.left - paddingPx;
    const percentage = Math.max(0, Math.min(1, x / usableWidth));

    // Position is percentage of usable width, offset by padding
    const leftPercent = ((paddingPx + (percentage * usableWidth)) / rect.width) * 100;

    if (thumbRef.current) {
      thumbRef.current.style.left = `${leftPercent}%`;
    }
    if (fillRef.current) {
      fillRef.current.style.width = `calc(${leftPercent}% + 2rem)`;
    }

    if (thumbRef.current) {
      const icon = thumbRef.current.querySelector('.slide-option__thumb-icon');
      if (icon) {
        icon.textContent = percentage >= SLIDER_THRESHOLD ? '✓' : '→';
      }
    }

    if (percentage >= SLIDER_THRESHOLD && currentValueRef.current < SLIDER_THRESHOLD) {
      haptic(10);
    }

    trackSliderChange?.(option.id, percentage, currentValueRef.current);
    currentValueRef.current = percentage;
  }, [isDragging, option.id, trackSliderChange]);

  const handlePointerUp = useCallback((e) => {
    if (!isDragging) return;

    const duration = startTimeRef.current ? performance.now() - startTimeRef.current : 0;
    const finalValue = currentValueRef.current;
    const completed = finalValue >= SLIDER_THRESHOLD;

    // Calculate velocity (percentage per second)
    const velocity = duration > 0 ? Math.round((finalValue * 100) / (duration / 1000)) : 0;

    trackInteraction?.({
      type: 'slider-end',
      targetId: option.id,
      pressure: getPointerPressure(e),
      data: {
        finalValue,
        duration,
        distance: e.clientX - (startXRef.current || 0),
        completed,
        velocity,
      },
    });

    setIsDragging(false);

    if (completed) {
      haptic(30);
      setSliderValue(1); // Sync React state
      onSelect?.(option.id, duration);
    } else {
      // Reset slider - now transitions will animate
      setSliderValue(0);
      currentValueRef.current = 0;
      if (thumbRef.current) {
        thumbRef.current.style.left = '1.5rem';
      }
      if (fillRef.current) {
        fillRef.current.style.width = '1.5rem';
      }
    }

    e.target.releasePointerCapture?.(e.pointerId);
  }, [isDragging, option.id, onSelect, trackInteraction]);

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
      style={{ '--index': index, opacity: isVisible ? undefined : 0 }}
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
          ref={fillRef}
          className="slide-option__fill"
        />
        <div
          ref={thumbRef}
          className="slide-option__thumb"
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
  isLocked,
  isRevising,
  previousResponse,
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
    // If locked (viewing saved answer), show selection
    if (isLocked) {
      setVisibleOptions(orderedOptions.map(o => o.id));
      if (previousResponse) {
        const prevSelected = Array.isArray(previousResponse) ? previousResponse : [previousResponse];
        setSelectedIds(prevSelected);
      }
      markOptionsShownRef.current?.();
      return;
    }

    // If revising, show all options but CLEAR selection so user can re-select
    if (isRevising) {
      setVisibleOptions(orderedOptions.map(o => o.id));
      setSelectedIds([]); // Clear selection for fresh start
      markOptionsShownRef.current?.();
      return;
    }

    if (!isActive) return;

    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];

    // Animate in
    setVisibleOptions([]);
    setSelectedIds([]);
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
  }, [isActive, isLocked, isRevising, orderedOptions, previousResponse]);

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
