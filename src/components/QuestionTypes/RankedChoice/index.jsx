import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { haptic, getPointerPressure } from '../../../utils';
import './index.scss';

const RankedChoice = ({
  question,
  presentationOrder,
  isActive,
  isLocked,
  isRevising,
  previousResponse,
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
  const [dragOffset, setDragOffset] = useState(0); // Y offset for dragged item
  const [isReady, setIsReady] = useState(false);
  const timersRef = useRef([]);
  const containerRef = useRef(null);
  const listRef = useRef(null);
  const itemRefs = useRef([]);
  const optionsShownRef = useRef(false);
  const markOptionsShownRef = useRef(markOptionsShown);
  const dragStartY = useRef(0);
  const itemHeight = useRef(0);
  
  markOptionsShownRef.current = markOptionsShown;
  
  const { options } = question;
  
  // Use previous response order if available (when revising), otherwise use presentation order
  const initialOrder = useMemo(() => {
    if (previousResponse && Array.isArray(previousResponse) && previousResponse.length > 0) {
      return previousResponse;
    }
    return presentationOrder;
  }, [previousResponse, presentationOrder]);
  
  const orderedOptions = useMemo(() => 
    initialOrder.map(id => options.find(o => o.id === id)).filter(Boolean),
    [initialOrder, options]
  );
  
  useEffect(() => {
    if (isLocked || isRevising) {
      setItems(orderedOptions.map((o, i) => ({ ...o, currentIndex: i })));
      setVisibleCount(orderedOptions.length);
      setIsReady(true);
      markOptionsShownRef.current?.();
      return;
    }
    
    if (!isActive) return;
    
    setItems(orderedOptions.map((o, i) => ({ ...o, currentIndex: i })));
    
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    
    setVisibleCount(0);
    setIsReady(false);
    optionsShownRef.current = false;
    
    orderedOptions.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + 1);
        
        if (!optionsShownRef.current) {
          optionsShownRef.current = true;
          markOptionsShownRef.current?.();
        }
        
        if (index === orderedOptions.length - 1) {
          setTimeout(() => setIsReady(true), 300);
        }
      }, index * 150);
      
      timersRef.current.push(timer);
    });
    
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, [isActive, isLocked, isRevising, orderedOptions]);
  
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
  
  // Pointer drag handlers
  const handlePointerDown = useCallback((e, index) => {
    if (index >= visibleCount || isLocked) return;
    
    e.preventDefault();
    haptic(10);
    
    const rect = itemRefs.current[index]?.getBoundingClientRect();
    if (rect) {
      itemHeight.current = rect.height + 8; // Including gap
      dragStartY.current = e.clientY;
    }
    
    setDraggedIndex(index);
    setDragOverIndex(index);
    setDragOffset(0);
    
    trackInteraction?.({
      type: 'drag-start',
      targetId: items[index]?.id,
      pressure: getPointerPressure(e),
      data: { fromIndex: index },
    });
    
    e.target.setPointerCapture?.(e.pointerId);
  }, [visibleCount, isLocked, items, trackInteraction]);
  
  const handlePointerMove = useCallback((e) => {
    if (draggedIndex === null || !listRef.current) return;
    
    const offset = e.clientY - dragStartY.current;
    setDragOffset(offset);
    
    // Calculate which position we're over
    const listRect = listRef.current.getBoundingClientRect();
    const relativeY = e.clientY - listRect.top;
    const overIndex = Math.max(0, Math.min(items.length - 1, Math.floor(relativeY / itemHeight.current)));
    
    if (overIndex !== dragOverIndex) {
      setDragOverIndex(overIndex);
      haptic(5);
    }
  }, [draggedIndex, dragOverIndex, items.length]);
  
  const handlePointerUp = useCallback(() => {
    const hadMove = draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex;
    
    if (hadMove) {
      // First move the item
      moveItem(draggedIndex, dragOverIndex);
    }
    
    // Reset drag state after CSS transition completes to prevent visual jump
    setTimeout(() => {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setDragOffset(0);
    }, hadMove ? 150 : 0);
  }, [draggedIndex, dragOverIndex, moveItem]);
  
  // Global pointer move/up for when pointer leaves element
  useEffect(() => {
    if (draggedIndex === null) return;
    
    const onMove = (e) => handlePointerMove(e);
    const onUp = () => handlePointerUp();
    
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
    
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
  }, [draggedIndex, handlePointerMove, handlePointerUp]);
  
  // Button-based reordering
  const handleMoveUp = useCallback((index) => {
    if (index === 0 || isLocked) return;
    haptic(15);
    moveItem(index, index - 1);
  }, [moveItem, isLocked]);
  
  const handleMoveDown = useCallback((index) => {
    if (index === items.length - 1 || isLocked) return;
    haptic(15);
    moveItem(index, index + 1);
  }, [items.length, moveItem, isLocked]);
  
  const handleConfirm = useCallback(() => {
    haptic(30);
    
    const finalOrder = items.map(i => i.id);
    setFinalRankings?.(finalOrder);
    
    onComplete?.(finalOrder);
  }, [items, setFinalRankings, onComplete]);
  
  // Calculate transform for each item
  const getItemStyle = useCallback((index) => {
    if (draggedIndex === null) return {};
    
    if (index === draggedIndex) {
      // Dragged item follows pointer
      return {
        transform: `translateY(${dragOffset}px) scale(1.02)`,
        zIndex: 100,
        transition: 'transform 0s, box-shadow 0.2s',
      };
    }
    
    // Other items shift to make room
    if (dragOverIndex !== null && draggedIndex !== null) {
      // If dragging down
      if (draggedIndex < dragOverIndex) {
        if (index > draggedIndex && index <= dragOverIndex) {
          return { transform: `translateY(-${itemHeight.current}px)` };
        }
      }
      // If dragging up
      else if (draggedIndex > dragOverIndex) {
        if (index >= dragOverIndex && index < draggedIndex) {
          return { transform: `translateY(${itemHeight.current}px)` };
        }
      }
    }
    
    return {};
  }, [draggedIndex, dragOverIndex, dragOffset]);

  return (
    <div 
      className="ranked-choice" 
      ref={containerRef}
    >
      <p className="ranked-choice__instructions">
        Drag to reorder or use arrows to rank from most (top) to least (bottom) important
      </p>
      
      <div className="ranked-choice__list" ref={listRef}>
        {items.map((item, index) => {
          const isDragging = draggedIndex === index;
          const style = getItemStyle(index);
          
          return (
            <div
              key={item.id}
              ref={el => itemRefs.current[index] = el}
              className={`ranked-choice__item ${index < visibleCount ? 'visible' : ''} ${isDragging ? 'dragging' : ''}`}
              style={{ 
                '--index': index, 
                opacity: index < visibleCount ? undefined : 0,
                ...style,
              }}
              onPointerDown={(e) => handlePointerDown(e, index)}
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
                  disabled={index === 0 || isLocked}
                  onClick={(e) => { e.stopPropagation(); handleMoveUp(index); }}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  className="ranked-choice__arrow"
                  disabled={index === items.length - 1 || isLocked}
                  onClick={(e) => { e.stopPropagation(); handleMoveDown(index); }}
                  aria-label="Move down"
                >
                  ↓
                </button>
              </div>
              
              <span className="ranked-choice__handle">
                ⋮⋮
              </span>
            </div>
          );
        })}
      </div>
      
      <button
        className={`ranked-choice__confirm ${isReady ? 'visible' : ''}`}
        style={{ opacity: isReady ? undefined : 0 }}
        disabled={!isReady || isLocked}
        onClick={handleConfirm}
      >
        Confirm Rankings
      </button>
    </div>
  );
};

export default RankedChoice;
