import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import StartScreen from '../StartScreen';
import Question from '../Question';
import MicroFeedback from '../MicroFeedback';
import Results from '../Results';
import { useAnalytics, useIdleTimeout } from '../../hooks';
import { shuffle } from '../../utils';
import { calculateScores, generateAIPayload, generateMicroFeedback } from '../../utils/analytics';
import questionsData from '../../assets/data/questions.json';
import personalitiesData from '../../assets/data/personalities.json';
import './index.scss';

// Import assets (update paths as needed for your project)
// import backgroundVideo from '../../assets/videos/redwoods.mp4';
// import analysisVideo from '../../assets/videos/analysis.mp4';
// import logo from '../../assets/images/logo.png';

const IDLE_DELAY = 45000; // 45 seconds
const TYPE_SPEED = 50;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const App = () => {
  // Core state
  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState('start'); // 'start' | 'quiz' | 'analyzing' | 'results'
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [responses, setResponses] = useState([]);
  const [personality, setPersonality] = useState(null);
  const [scores, setScores] = useState({});
  const [fullscreen, setFullscreen] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(null);
  const [apiResult, setApiResult] = useState(null);
  
  // Prepared questions with randomized options
  const [preparedQuestions, setPreparedQuestions] = useState([]);
  
  // Analytics hook
  const analytics = useAnalytics();
  
  // Refs
  const questionsRef = useRef(null);
  const backgroundVideoRef = useRef(null);
  
  // Idle timeout hook - reset quiz after inactivity
  useIdleTimeout(IDLE_DELAY, () => {
    if (phase === 'quiz') {
      handleRestart();
    }
  }, phase === 'quiz');
  
  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(document.fullscreenElement !== null);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  // Prepare questions with randomized options
  const prepareQuestions = useCallback(() => {
    return questionsData.map(question => {
      const prepared = { ...question };
      
      if (question.randomize && question.options) {
        const shuffled = shuffle([...question.options]);
        prepared.options = shuffled;
        prepared.presentationOrder = shuffled.map(opt => opt.id);
        prepared.originalOrder = question.options.map(opt => opt.id);
      } else if (question.options) {
        prepared.presentationOrder = question.options.map(opt => opt.id);
        prepared.originalOrder = prepared.presentationOrder;
      }
      
      return prepared;
    });
  }, []);
  
  // Start the quiz
  const handleStart = useCallback((startData) => {
    // Prepare fresh questions with randomized options
    const questions = prepareQuestions();
    setPreparedQuestions(questions);
    
    // Reset state
    setRunId(v => v + 1);
    setCurrentQuestionIndex(0);
    setResponses([]);
    setPersonality(null);
    setScores({});
    setPhase('quiz');
    
    // Initialize analytics for first question
    analytics.reset();
    analytics.initQuestion(questions[0]);
    
    // Request fullscreen on non-localhost
    if (!fullscreen && location.hostname !== 'localhost') {
      document.documentElement.requestFullscreen?.();
    }
  }, [prepareQuestions, analytics, fullscreen]);
  
  // Restart the quiz
  const handleRestart = useCallback(() => {
    setRunId(v => v + 1);
    setCurrentQuestionIndex(-1);
    setResponses([]);
    setPersonality(null);
    setScores({});
    setPhase('start');
    analytics.reset();
  }, [analytics]);
  
  // Handle answer submission
  const handleAnswer = useCallback((questionIndex, response) => {
    const question = preparedQuestions[questionIndex];
    
    // Finalize current question analytics
    const questionAnalytics = analytics.finalizeQuestion(response);
    
    // Generate micro feedback and display it
    const feedback = generateMicroFeedback(questionAnalytics, question?.type);
    if (feedback && feedback.length > 0) {
      setCurrentFeedback(feedback);
    }
    
    // Store response with analytics
    setResponses(prev => {
      const next = [...prev];
      next[questionIndex] = {
        questionId: question.id,
        questionType: question.type,
        response,
        analytics: questionAnalytics,
        feedback,
      };
      return next;
    });
    
    // Move to next question or finish
    const nextIndex = questionIndex + 1;
    
    if (nextIndex < preparedQuestions.length) {
      setCurrentQuestionIndex(nextIndex);
      analytics.initQuestion(preparedQuestions[nextIndex]);
    } else {
      // Quiz complete - call API immediately
      setPhase('analyzing');
      
      // Build responses array with current response included
      const allResponses = [...responses];
      allResponses[questionIndex] = {
        questionId: question.id,
        questionType: question.type,
        response,
        analytics: questionAnalytics,
        feedback,
      };
      
      // Call API right away
      analyzeQuiz(allResponses);
    }
    
    return { feedback };
  }, [preparedQuestions, analytics, responses]);
  
  // Analyze quiz - calls backend API immediately
  const analyzeQuiz = useCallback(async (allResponses) => {
    // Calculate local scores as fallback
    const allAnalytics = allResponses.map(r => r.analytics);
    const calculatedScores = calculateScores(allAnalytics, preparedQuestions, personalitiesData);
    
    // Find local winning personality (fallback)
    let maxScore = -Infinity;
    let winningPersonality = null;
    
    Object.entries(calculatedScores).forEach(([id, score]) => {
      if (score > maxScore) {
        maxScore = score;
        winningPersonality = personalitiesData.find(p => p.id === id);
      }
    });
    
    // Build API payload
    const apiPayload = buildApiPayload(allResponses, preparedQuestions, personalitiesData, calculatedScores);
    console.log('Sending to API:', apiPayload);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/quiz/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log('API Response:', data);
        setApiResult(data);
        
        if (data.ok && data.personalityId) {
          // Use API-determined personality
          const apiPersonality = personalitiesData.find(p => p.id === data.personalityId);
          if (apiPersonality) {
            winningPersonality = apiPersonality;
          }
        }
      }
    } catch (err) {
      console.warn('API call failed, using local scoring:', err);
    }
    
    // Set results and show immediately
    setScores(calculatedScores);
    setPersonality(winningPersonality);
    setPhase('results');
  }, [preparedQuestions]);
  
  // Build payload for backend API
  const buildApiPayload = (responses, questions, personalities, scores) => {
    return {
      quizId: 'ai-personality-quiz',
      personalities: personalities.map(p => ({ id: p.id, name: p.name })),
      clientFallback: {
        personalityId: Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || personalities[0]?.id,
      },
      questions: responses.map((r, idx) => {
        const q = questions[idx];
        const analytics = r.analytics || {};
        const timing = analytics.timing || {};
        
        // Map frontend question types to backend types
        const typeMap = {
          'text-multiple-choice': 'multiple_choice',
          'image-multiple-choice': 'image_grid',
          'slide-to-select': 'multiple_choice',
          'ranked-choice': 'ordering',
          'range': 'slider',
          'free-response': 'text',
        };
        
        const mappedType = typeMap[q.type] || q.type;
        
        const baseQuestion = {
          id: q.id,
          type: mappedType,
        };
        
        // Only add timing fields if they have valid values
        if (timing.questionShownAt) baseQuestion.startedAtMs = Math.round(timing.questionShownAt);
        if (timing.completedAt) baseQuestion.answeredAtMs = Math.round(timing.completedAt);
        if (timing.responseTime) baseQuestion.delayMs = Math.round(timing.responseTime);
        
        // Add type-specific data
        switch (q.type) {
          case 'text-multiple-choice':
          case 'image-multiple-choice':
          case 'slide-to-select': {
            const selectedIds = analytics.response?.selectedIds || [];
            // Only include selectedId if we have one
            if (selectedIds[0]) {
              baseQuestion.selectedId = selectedIds[0];
            }
            const hoverMap = buildHoverMap(analytics.interactions);
            if (hoverMap) {
              baseQuestion.hoverMsByOption = hoverMap;
            }
            if (selectedIds.length > 1) {
              baseQuestion.changedMind = true;
            }
            return baseQuestion;
          }
          case 'ranked-choice': {
            // Use r.response (the finalOrder array passed to onComplete) since analytics.rankings.final
            // may not be updated yet due to async state update race condition
            const finalOrder = Array.isArray(r.response) ? r.response : (analytics.rankings?.final || []);
            // Only include order if we have 2+ items
            if (finalOrder.length >= 2) {
              baseQuestion.order = finalOrder;
            }
            const swaps = analytics.rankings?.moves?.length || 0;
            if (swaps > 0) {
              baseQuestion.swaps = swaps;
            }
            if (timing.responseTime) {
              baseQuestion.durationMs = Math.round(timing.responseTime);
            }
            return baseQuestion;
          }
          case 'range': {
            // Use r.response as fallback for the same race condition reason
            // Filter to only numeric values (slider values, not the default arrays)
            const responseObj = analytics.response || r.response || {};
            const numericValues = Object.entries(responseObj)
              .filter(([key, val]) => typeof val === 'number')
              .reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {});
            
            const firstValue = Object.values(numericValues)[0];
            if (typeof firstValue === 'number') {
              // Normalize based on typical 1-10 range to 0-1
              baseQuestion.value = Math.max(0, Math.min(1, firstValue / 10));
            }
            if (timing.responseTime) {
              baseQuestion.durationMs = Math.round(timing.responseTime);
            }
            const reversals = countReversals(analytics.sliderData);
            if (reversals > 0) {
              baseQuestion.reversals = reversals;
            }
            return baseQuestion;
          }
          case 'free-response': {
            const text = analytics.response?.text || r.response;
            if (text) {
              baseQuestion.text = text;
            }
            return baseQuestion;
          }
          default:
            return baseQuestion;
        }
      }),
    };
  };
  
  // Helper: build hover time map from interactions
  const buildHoverMap = (interactions = []) => {
    const hovers = {};
    interactions
      .filter(i => i.type === 'hover' && i.targetId)
      .forEach(i => {
        hovers[i.targetId] = (hovers[i.targetId] || 0) + 100; // Approximate hover time
      });
    return Object.keys(hovers).length > 0 ? hovers : null;
  };
  
  // Helper: count slider reversals
  const countReversals = (sliderData = {}) => {
    let reversals = 0;
    Object.values(sliderData).forEach(data => {
      if (data?.changes) {
        let lastDir = 0;
        data.changes.forEach(c => {
          const dir = c.to > c.from ? 1 : -1;
          if (lastDir !== 0 && dir !== lastDir) reversals++;
          lastDir = dir;
        });
      }
    });
    return reversals;
  };
  
  // Track interactions
  const handleInteraction = useCallback((questionIndex, interaction) => {
    analytics.trackInteraction(interaction);
  }, [analytics]);
  
  // Mark when options are shown
  const handleMarkOptionsShown = useCallback((questionIndex) => {
    analytics.markOptionsShown();
  }, [analytics]);
  
  // Get all analytics for results display
  const allAnalytics = useMemo(() => {
    return responses.map(r => r.analytics).filter(Boolean);
  }, [responses]);
  
  return (
    <div className="app">
      {/* Background Video */}
      <div className={`app__background ${phase !== 'start' ? 'muted' : ''}`}>
        {/* <video 
          ref={backgroundVideoRef}
          src={backgroundVideo} 
          muted 
          loop 
          autoPlay 
          playsInline 
        /> */}
        <div className="app__background-fallback" />
      </div>
      
      {/* Start Screen */}
      <StartScreen
        isVisible={phase === 'start'}
        onStart={handleStart}
        // logoSrc={logo}
        title="Discover Your AI Personality"
        subtitle="Answer a few questions to discover which AI approach matches your style"
      />
      
      {/* Questions */}
      <div 
        className={`app__questions ${phase === 'quiz' ? 'visible' : ''}`}
        ref={questionsRef}
      >
        {preparedQuestions.map((question, index) => (
          <Question
            key={`${runId}-${question.id}`}
            question={question}
            questionIndex={index}
            currentQuestionIndex={currentQuestionIndex}
            isActive={phase === 'quiz' && index === currentQuestionIndex}
            isAnswered={index < currentQuestionIndex}
            runId={runId}
            analytics={analytics}
            onAnswer={(response) => handleAnswer(index, response)}
            onInteraction={(interaction) => handleInteraction(index, interaction)}
            onMarkOptionsShown={() => handleMarkOptionsShown(index)}
            typeSpeed={TYPE_SPEED}
          />
        ))}
      </div>
      
      {/* Micro Feedback Overlay */}
      {phase === 'quiz' && (
        <MicroFeedback 
          feedback={currentFeedback}
          onComplete={() => setCurrentFeedback(null)}
        />
      )}
      
      {/* Loading indicator while analyzing */}
      {phase === 'analyzing' && (
        <div className="app__loading">
          <div className="app__loading-spinner" />
          <p>Analyzing responses...</p>
        </div>
      )}
      
      {/* Results */}
      <Results
        isVisible={phase === 'results'}
        personality={personality}
        scores={scores}
        allAnalytics={allAnalytics}
        onRestart={handleRestart}
      />
      
      {/* Logo (always visible) */}
      {/* <img className="app__logo" src={logo} alt="Logo" /> */}
    </div>
  );
};

export default App;
