import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const timersRef = useRef([]);
  const containerRef = useRef(null);
  const optionsShownRef = useRef(false);
  
  const { options } = question;
  
  // Get options in presentation order
  const orderedOptions = presentationOrder.map(id => 
    options.find(o => o.id === id)
  ).filter(Boolean);
  
  // Initialize items when active
  useEffect(() => {
    if (!isActive) return;
    
    setItems(orderedOptions.map((o, i) => ({ ...o, currentIndex: i })));
    setVisibleCount(0);
    setIsReady(false);
    optionsShownRef.current = false;
    
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    
    const questionDelay = question.text.length * questionSpeed + 500;
    
    // Reveal items one by one
    orderedOptions.forEach((_, index) => {
      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + 1);
        
        if (!optionsShownRef.current) {
          optionsShownRef.current = true;
          markOptionsShown?.();
        }
        
        // Show confirm button after all items visible
        if (index === orderedOptions.length - 1) {
          setTimeout(() => setIsReady(true), 300);
        }
      }, questionDelay + (index * 200));
      
      timersRef.current.push(timer);
    });
    
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, [isActive, orderedOptions, question.text.length, questionSpeed, markOptionsShown]);
  
  const handleDragStart = useCallback((e, item, index) => {
    haptic(10);
    setDraggedItem({ ...item, originalIndex: index });
    
    trackInteraction?.({
      type: 'drag-start',
      targetId: item.id,
      pressure: getPointerPressure(e),
      data: { fromIndex: index },
    });
    
    // For touch devices
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.id);
    }
  }, [trackInteraction]);
  
  const handleDragOver = useCallback((e, index) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  }, [dragOverIndex]);
  
  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverIndex(null);
  }, []);
  
  const handleDrop = useCallback((e, dropIndex) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    const fromIndex = items.findIndex(i => i.id === draggedItem.id);
    
    if (fromIndex === dropIndex) {
      handleDragEnd();
      return;
    }
    
    haptic(20);
    
    // Record the move
    trackRankMove?.(draggedItem.id, fromIndex, dropIndex);
    trackInteraction?.({
      type: 'drag-drop',
      targetId: draggedItem.id,
      data: { fromIndex, toIndex: dropIndex },
    });
    
    // Reorder items
    setItems(prev => {
      const newItems = [...prev];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(dropIndex, 0, removed);
      return newItems.map((item, i) => ({ ...item, currentIndex: i }));
    });
    
    handleDragEnd();
  }, [draggedItem, items, trackRankMove, trackInteraction, handleDragEnd]);
  
  // Touch-based reordering
  const handleMoveUp = useCallback((index) => {
    if (index === 0) return;
    
    haptic(15);
    const item = items[index];
    
    trackRankMove?.(item.id, index, index - 1);
    trackInteraction?.({
      type: 'move-up',
      targetId: item.id,
      data: { fromIndex: index, toIndex: index - 1 },
    });
    
    setItems(prev => {
      const newItems = [...prev];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      return newItems.map((item, i) => ({ ...item, currentIndex: i }));
    });
  }, [items, trackRankMove, trackInteraction]);
  
  const handleMoveDown = useCallback((index) => {
    if (index === items.length - 1) return;
    
    haptic(15);
    const item = items[index];
    
    trackRankMove?.(item.id, index, index + 1);
    trackInteraction?.({
      type: 'move-down',
      targetId: item.id,
      data: { fromIndex: index, toIndex: index + 1 },
    });
    
    setItems(prev => {
      const newItems = [...prev];
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
      return newItems.map((item, i) => ({ ...item, currentIndex: i }));
    });
  }, [items, trackRankMove, trackInteraction]);
  
  const handleConfirm = useCallback(() => {
    haptic(30);
    
    const finalOrder = items.map(i => i.id);
    setFinalRankings?.(finalOrder);
    
    onComplete?.(finalOrder);
  }, [items, setFinalRankings, onComplete]);
  
  return (
    <div className="ranked-choice" ref={containerRef}>
      <p className="ranked-choice__instructions">
        Drag to reorder or use arrows to rank from most (top) to least (bottom) important
      </p>
      
      <div className="ranked-choice__list">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`ranked-choice__item ${index < visibleCount ? 'visible' : ''} ${draggedItem?.id === item.id ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
            style={{ '--index': index }}
            draggable={index < visibleCount}
            onDragStart={(e) => handleDragStart(e, item, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, index)}
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
        disabled={!isReady}
        onClick={handleConfirm}
      >
        Confirm Rankings
      </button>
    </div>
  );
};

export default RankedChoice;
