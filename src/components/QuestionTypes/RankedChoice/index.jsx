import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { haptic, getPointerPressure } from '../../../utils';
import './index.scss';

const RankedChoice = ({
  question,
  presentationOrder,
  isActive,
  onComplete,
  trackInteraction,
  trackRankMove,
  setFinalRankings,
  markOptionsShown,
  questionSpeed = 50,
}) => {
  const [items, setItems] = useState([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const timersRef = useRef([]);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const optionsShownRef = useRef(false);
  const markOptionsShownRef = useRef(markOptionsShown);
  
  // Keep ref updated
  markOptionsShownRef.current = markOptionsShown;
  
  const { options } = question;
  
  // Get options in presentation order - memoized to prevent infinite loops
  const orderedOptions = useMemo(() => 
    presentationOrder.map(id => options.find(o => o.id === id)).filter(Boolean),
    [presentationOrder, options]
  );
  
  // Initialize items when active
  useEffect(() => {
    if (!isActive) return;
    
    setItems(orderedOptions.map((o, i) => ({ ...o, currentIndex: i })));
    setVisibleCount(0);
    setIsReady(false);
    optionsShownRef.current = false;
    
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    
    // Reveal items one by one
    orderedOptions.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + 1);
        
        if (!optionsShownRef.current) {
          optionsShownRef.current = true;
          markOptionsShownRef.current?.();
        }
        
        // Show confirm button after all items visible
        if (index === orderedOptions.length - 1) {
          setTimeout(() => setIsReady(true), 300);
        }
      }, index * 150);
      
      timersRef.current.push(timer);
    });
    
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, [isActive, orderedOptions]);
  
  // Move item from one index to another
  const moveItem = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    
    haptic(20);
    const item = items[fromIndex];
    
    trackRankMove?.(item.id, fromIndex, toIndex);
    trackInteraction?.({
      type: 'reorder',
      targetId: item.id,
      data: { fromIndex, toIndex },
    });
    
    setItems(prev => {
      const newItems = [...prev];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, removed);
      return newItems.map((item, i) => ({ ...item, currentIndex: i }));
    });
  }, [items, trackRankMove, trackInteraction]);
  
  // Mouse/pointer drag handlers (for desktop)
  const handleDragStart = useCallback((e, index) => {
    haptic(10);
    setDraggedIndex(index);
    
    trackInteraction?.({
      type: 'drag-start',
      targetId: items[index]?.id,
      pressure: getPointerPressure(e),
      data: { fromIndex: index },
    });
    
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', items[index]?.id);
    }
  }, [items, trackInteraction]);
  
  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }, [dragOverIndex]);
  
  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      moveItem(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, moveItem]);
  
  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      moveItem(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, moveItem]);
  
  // Touch drag handlers (for mobile)
  const handleTouchStart = useCallback((e, index) => {
    if (index >= visibleCount) return;
    
    haptic(10);
    setDraggedIndex(index);
    
    trackInteraction?.({
      type: 'touch-drag-start',
      targetId: items[index]?.id,
      data: { fromIndex: index },
    });
  }, [visibleCount, items, trackInteraction]);
  
  // Refs to track state for non-passive touch handler (avoids stale closures)
  const dragOverIndexRef = useRef(dragOverIndex);
  dragOverIndexRef.current = dragOverIndex;
  const draggedIndexRef = useRef(draggedIndex);
  draggedIndexRef.current = draggedIndex;
  const itemsLengthRef = useRef(items.length);
  itemsLengthRef.current = items.length;
  
  // Add non-passive touch move listener to document to prevent scroll during drag
  useEffect(() => {
    const onTouchMove = (e) => {
      // Only prevent default if we're actively dragging in this component
      if (draggedIndexRef.current === null || !listRef.current) return;
      
      // Check if touch is within our list bounds
      const listRect = listRef.current.getBoundingClientRect();
      const touch = e.touches[0];
      if (touch.clientX < listRect.left || touch.clientX > listRect.right ||
          touch.clientY < listRect.top - 50 || touch.clientY > listRect.bottom + 50) {
        return; // Touch is outside our component
      }
      
      e.preventDefault();
      
      // Find which item we're over
      const relativeY = touch.clientY - listRect.top;
      const itemHeight = listRect.height / itemsLengthRef.current;
      const overIndex = Math.max(0, Math.min(itemsLengthRef.current - 1, Math.floor(relativeY / itemHeight)));
      
      if (overIndex !== dragOverIndexRef.current) {
        setDragOverIndex(overIndex);
        haptic(5);
      }
    };
    
    // Must use document level with { passive: false } to override browser defaults
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);
  
  const handleTouchEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      moveItem(draggedIndex, dragOverIndex);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, moveItem]);
  
  // Button-based reordering
  const handleMoveUp = useCallback((index) => {
    if (index === 0) return;
    haptic(15);
    moveItem(index, index - 1);
  }, [moveItem]);
  
  const handleMoveDown = useCallback((index) => {
    if (index === items.length - 1) return;
    haptic(15);
    moveItem(index, index + 1);
  }, [items.length, moveItem]);
  
  const handleConfirm = useCallback(() => {
    haptic(30);
    
    const finalOrder = items.map(i => i.id);
    setFinalRankings?.(finalOrder);
    
    onComplete?.(finalOrder);
  }, [items, setFinalRankings, onComplete]);
  
  return (
    <div 
      className="ranked-choice" 
      ref={containerRef}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <p className="ranked-choice__instructions">
        Drag to reorder or use arrows to rank from most (top) to least (bottom) important
      </p>
      
      <div className="ranked-choice__list" ref={listRef}>
        {items.map((item, index) => (
          <div
            key={item.id}
            ref={el => itemRefs.current[index] = el}
            className={`ranked-choice__item ${index < visibleCount ? 'visible' : ''} ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index && draggedIndex !== index ? 'drag-over' : ''}`}
            style={{ '--index': index, opacity: index < visibleCount ? undefined : 0 }}
            draggable={index < visibleCount}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, index)}
            onTouchStart={(e) => handleTouchStart(e, index)}
          >
            <span className="ranked-choice__rank">
              {index + 1}
            </span>
            
            <span className="ranked-choice__text">
              {item.text}
            </span>
            
            <div className="ranked-choice__controls">
              <button
                className="ranked-choice__arrow"
                disabled={index === 0}
                onClick={() => handleMoveUp(index)}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                className="ranked-choice__arrow"
                disabled={index === items.length - 1}
                onClick={() => handleMoveDown(index)}
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
            
            <span className="ranked-choice__handle">
              ⋮⋮
            </span>
          </div>
        ))}
      </div>
      
      <button
        className={`ranked-choice__confirm ${isReady ? 'visible' : ''}`}
        style={{ opacity: isReady ? undefined : 0 }}
        disabled={!isReady}
        onClick={handleConfirm}
      >
        Confirm Rankings
      </button>
    </div>
  );
};

export default RankedChoice;
