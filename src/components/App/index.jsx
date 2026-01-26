import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import StartScreen from '../StartScreen';
import Question from '../Question';
import AnalysisAnimation from '../AnalysisAnimation';
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
const ANALYSIS_DURATION = 8000; // 8 seconds for analysis animation

const App = () => {
  // Core state
  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState('start'); // 'start' | 'quiz' | 'analyzing' | 'results'
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [responses, setResponses] = useState([]);
  const [personality, setPersonality] = useState(null);
  const [scores, setScores] = useState({});
  const [fullscreen, setFullscreen] = useState(false);
  
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
    
    // Generate micro feedback
    const feedback = generateMicroFeedback(questionAnalytics, question);
    
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
      // Quiz complete - start analysis
      setPhase('analyzing');
    }
    
    return { feedback };
  }, [preparedQuestions, analytics]);
  
  // Handle analysis complete
  const handleAnalysisComplete = useCallback(() => {
    // Calculate final scores
    const allAnalytics = responses.map(r => r.analytics);
    const calculatedScores = calculateScores(responses, preparedQuestions, personalitiesData);
    
    // Find winning personality
    let maxScore = -Infinity;
    let winningPersonality = null;
    
    Object.entries(calculatedScores).forEach(([id, score]) => {
      if (score > maxScore) {
        maxScore = score;
        winningPersonality = personalitiesData.find(p => p.id === id);
      }
    });
    
    // Generate AI payload (for potential API call)
    const aiPayload = generateAIPayload(responses, preparedQuestions, personalitiesData, calculatedScores);
    console.log('AI Payload ready:', aiPayload);
    
    // Set results
    setScores(calculatedScores);
    setPersonality(winningPersonality);
    setPhase('results');
  }, [responses, preparedQuestions]);
  
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
      
      {/* Analysis Animation */}
      <AnalysisAnimation
        isActive={phase === 'analyzing'}
        // videoSrc={analysisVideo}
        duration={ANALYSIS_DURATION}
        onComplete={handleAnalysisComplete}
      />
      
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
