import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TypeAnimation } from 'react-type-animation';
import { 
  TextMultipleChoice, 
  ImageMultipleChoice, 
  SlideToSelect, 
  RankedChoice, 
  RangeSlider, 
  FreeResponse 
} from '../QuestionTypes';
import './index.scss';

const QUESTION_TYPE_MAP = {
  'text-multiple-choice': TextMultipleChoice,
  'image-multiple-choice': ImageMultipleChoice,
  'slide-to-select': SlideToSelect,
  'ranked-choice': RankedChoice,
  'range': RangeSlider,
  'free-response': FreeResponse,
};

const Question = ({
  question,
  questionIndex,
  currentQuestionIndex,
  isActive,
  isAnswered,
  isLocked,
  isRevising,
  shouldHide,
  runId,
  analytics,
  onAnswer,
  onBack,
  onChangeAnswer,
  onInteraction,
  onMarkOptionsShown,
  typeSpeed = 50,
  answerSpeed = 60,
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const [questionTyped, setQuestionTyped] = useState(false);
  const containerRef = useRef(null);
  const optionsTimerRef = useRef(null);
  
  // Calculate delay for showing options based on question text length
  const questionDelay = typeSpeed * question.text.length + 500;
  
  // Get the appropriate component for this question type
  const QuestionComponent = QUESTION_TYPE_MAP[question.type];
  
  // Get presentation order from the prepared question
  const presentationOrder = question.presentationOrder || 
    question.options?.map(o => o.id) || 
    question.statements?.map(s => s.id) || 
    [];
  
  // Show back button if not on first question and (question is active OR viewing locked)
  const canGoBack = questionIndex > 0 && (isActive || (isLocked && questionIndex === currentQuestionIndex));
  
  // Show "Change Answer" button if viewing a locked question (went back but haven't clicked change)
  const showChangeAnswerButton = isLocked && questionIndex === currentQuestionIndex;
  
  // Reset state when runId changes (quiz restart)
  useEffect(() => {
    setShowOptions(false);
    setQuestionTyped(false);
    
    if (optionsTimerRef.current) {
      clearTimeout(optionsTimerRef.current);
      optionsTimerRef.current = null;
    }
  }, [runId]);
  
  // Show options after question is typed
  useEffect(() => {
    if (!isActive || showOptions) return;
    
    optionsTimerRef.current = setTimeout(() => {
      setShowOptions(true);
    }, questionDelay);
    
    return () => {
      if (optionsTimerRef.current) {
        clearTimeout(optionsTimerRef.current);
      }
    };
  }, [isActive, questionDelay, showOptions]);
  
  // Scroll into view when question becomes active
  useEffect(() => {
    if (isActive && containerRef.current) {
      // Wait for height transition to complete (500ms) plus a small buffer
      setTimeout(() => {
        containerRef.current.scrollIntoView({ 
          block: 'start', 
          behavior: 'smooth' 
        });
      }, 550);
    }
  }, [isActive]);
  
  // Handle question completion (from question type component)
  const handleComplete = useCallback((response) => {
    // Just pass response to parent - App handles feedback
    onAnswer?.(response);
  }, [onAnswer]);
  
  // Handle back button click
  const handleBack = useCallback(() => {
    onBack?.();
  }, [onBack]);
  
  // Handle typing complete
  const handleTypingComplete = useCallback(() => {
    setQuestionTyped(true);
  }, []);
  
  // Track interaction (passed to question type components)
  const handleTrackInteraction = useCallback((interaction) => {
    analytics?.trackInteraction?.(interaction);
    onInteraction?.(interaction);
  }, [analytics, onInteraction]);
  
  // Track selection (passed to question type components)
  const handleTrackSelection = useCallback((optionId, isSelected) => {
    analytics?.trackSelection?.(optionId, isSelected);
  }, [analytics]);
  
  // Track rank move (for ranked-choice)
  const handleTrackRankMove = useCallback((itemId, fromIndex, toIndex) => {
    analytics?.trackRankMove?.(itemId, fromIndex, toIndex);
  }, [analytics]);
  
  // Track slider change (for range)
  const handleTrackSliderChange = useCallback((sliderId, value, prevValue) => {
    analytics?.trackSliderChange?.(sliderId, value, prevValue);
  }, [analytics]);
  
  // Track typing (for free-response)
  const handleTrackTyping = useCallback((text, event) => {
    analytics?.trackTyping?.(text, event);
  }, [analytics]);
  
  // Mark options shown
  const handleMarkOptionsShown = useCallback(() => {
    analytics?.markOptionsShown?.();
    onMarkOptionsShown?.();
  }, [analytics, onMarkOptionsShown]);
  
  // Set final rankings (for ranked-choice)
  const handleSetFinalRankings = useCallback((finalOrder) => {
    analytics?.setFinalRankings?.(finalOrder);
  }, [analytics]);
  
  if (!QuestionComponent) {
    console.warn(`Unknown question type: ${question.type}`);
    return null;
  }
  
  // Determine visibility class
  let visibilityClass = 'hidden';
  if (shouldHide) {
    visibilityClass = 'hidden';
  } else if (isActive && !isLocked) {
    visibilityClass = 'active';
  } else if (isLocked && questionIndex === currentQuestionIndex) {
    visibilityClass = 'viewing-locked'; // Viewing a locked question (can click "Change Answer")
  } else if (isAnswered || isLocked) {
    visibilityClass = 'answered';
  }
  
  // Additional class for locked state
  const lockedClass = isLocked ? 'question--locked' : '';
  
  return (
    <div 
      ref={containerRef}
      className={`question question--${visibilityClass} ${lockedClass}`}
      data-question-id={question.id}
      data-question-index={questionIndex}
    >
      {/* Back Button - shows on active questions (after options load) or locked questions (immediately) */}
      {canGoBack && (showOptions || isLocked) && (
        <button 
          className="question__back"
          onClick={handleBack}
          aria-label="Go back to previous question"
        >
          ← Back
        </button>
      )}
      
      {/* Question Text */}
      <h1 className="question__text">
        {isActive && !isAnswered && !isLocked && (
          <TypeAnimation
            sequence={[question.text, handleTypingComplete]}
            speed={typeSpeed}
            cursor={false}
          />
        )}
        {(isAnswered || !isActive || isLocked) && (
          <span>{question.text}</span>
        )}
      </h1>
      
      {/* Question Component (options, slider, etc.) */}
      <div className={`question__content ${showOptions || isAnswered || isLocked ? 'visible' : ''} ${isLocked ? 'locked' : ''}`}>
        <QuestionComponent
          key={`${runId}-${question.id}${isRevising ? '-revising' : ''}`}
          question={question}
          presentationOrder={presentationOrder}
          isActive={(isActive && showOptions && !isLocked) || isRevising}
          isLocked={isLocked}
          onComplete={handleComplete}
          trackInteraction={handleTrackInteraction}
          trackSelection={handleTrackSelection}
          trackRankMove={handleTrackRankMove}
          trackSliderChange={handleTrackSliderChange}
          trackTyping={handleTrackTyping}
          markOptionsShown={handleMarkOptionsShown}
          setFinalRankings={handleSetFinalRankings}
          questionSpeed={typeSpeed}
          answerSpeed={answerSpeed}
        />
        
        {/* Change Answer Button - shows when viewing a locked question */}
        {showChangeAnswerButton && (
          <button 
            className="question__change-answer"
            onClick={onChangeAnswer}
          >
            Change Answer
          </button>
        )}
      </div>
    </div>
  );
};

export default Question;
