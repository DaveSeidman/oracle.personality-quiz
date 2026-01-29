import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import StartScreen from '../StartScreen';
import Question from '../Question';
import MicroFeedback from '../MicroFeedback';
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

const IDLE_DELAY = 60000; // 45 seconds
const TYPE_SPEED = 50;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const ANALYSIS_DURATION = 8000; // Minimum animation duration

const App = () => {
  // Core state
  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState('start'); // 'start' | 'quiz' | 'confirm' | 'analyzing' | 'results'
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [responses, setResponses] = useState([]);
  const [personality, setPersonality] = useState(null);
  const [scores, setScores] = useState({});
  const [fullscreen, setFullscreen] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(null);
  const [apiResult, setApiResult] = useState(null);
  const [backNavigations, setBackNavigations] = useState([]); // Track back navigation events
  const [revisingQuestionIndex, setRevisingQuestionIndex] = useState(null); // Track if user is revising a question
  const [showingFeedbackForQuestion, setShowingFeedbackForQuestion] = useState(null); // Track which question is showing feedback

  // Analysis completion tracking
  const [animationComplete, setAnimationComplete] = useState(false);
  const [apiComplete, setApiComplete] = useState(false);
  const pendingResultsRef = useRef(null);

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

  // Prevent context menu (long press) during quiz
  useEffect(() => {
    const preventContextMenu = (e) => {
      if (phase === 'quiz') {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('contextmenu', preventContextMenu);
    return () => document.removeEventListener('contextmenu', preventContextMenu);
  }, [phase]);

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
    setBackNavigations([]);
    setRevisingQuestionIndex(null);
    setShowingFeedbackForQuestion(null);
    setCurrentFeedback(null);
    setPhase('start');
    analytics.reset();
  }, [analytics]);

  // Handle answer submission
  const handleAnswer = useCallback((questionIndex, response) => {
    const question = preparedQuestions[questionIndex];

    // Finalize current question analytics
    const questionAnalytics = analytics.finalizeQuestion(response);

    // Generate data-focused micro feedback
    const feedback = generateMicroFeedback(questionAnalytics, question?.type, question);

    // Store response with analytics and feedback
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

    // Show feedback immediately (question will be disabled during this time)
    setCurrentFeedback(feedback);
    setShowingFeedbackForQuestion(questionIndex);

    // Clear revising state if we were revising
    setRevisingQuestionIndex(null);

    // After 2 second delay, proceed to next question
    setTimeout(() => {
      setShowingFeedbackForQuestion(null);
      setCurrentFeedback(null);

      const nextIndex = questionIndex + 1;

      if (nextIndex < preparedQuestions.length) {
        setCurrentQuestionIndex(nextIndex);
        analytics.initQuestion(preparedQuestions[nextIndex]);
      } else {
        // Quiz complete - go to confirmation screen
        setPhase('confirm');
        setCurrentQuestionIndex(preparedQuestions.length);
      }
    }, 2500); // 2.5 seconds to allow type-on to finish

    return { feedback };
  }, [preparedQuestions, analytics]);

  // Handle back navigation (from quiz or confirm phase)
  const handleBack = useCallback(() => {
    // From confirm phase, go back to last question
    if (phase === 'confirm') {
      const lastIndex = preparedQuestions.length - 1;
      setPhase('quiz');
      setCurrentQuestionIndex(lastIndex);

      // Track back navigation
      setBackNavigations(prev => [...prev, {
        timestamp: Date.now(),
        fromPhase: 'confirm',
        toQuestionIndex: lastIndex,
        toQuestionId: preparedQuestions[lastIndex]?.id,
      }]);
      return;
    }

    // From quiz phase
    if (currentQuestionIndex <= 0) return;

    const prevIndex = currentQuestionIndex - 1;
    const fromQuestion = preparedQuestions[currentQuestionIndex];
    const toQuestion = preparedQuestions[prevIndex];

    // Track this back navigation
    const backEvent = {
      timestamp: Date.now(),
      fromQuestionIndex: currentQuestionIndex,
      fromQuestionId: fromQuestion?.id,
      toQuestionIndex: prevIndex,
      toQuestionId: toQuestion?.id,
    };

    setBackNavigations(prev => [...prev, backEvent]);

    // Go back (but don't clear the response yet - user must click "Change Answer")
    setCurrentQuestionIndex(prevIndex);

  }, [phase, currentQuestionIndex, preparedQuestions]);

  // Handle "Change Answer" button click - user wants to revise their answer
  const handleChangeAnswer = useCallback((questionIndex) => {
    const question = preparedQuestions[questionIndex];

    // Mark this question as being revised
    setRevisingQuestionIndex(questionIndex);

    // Mark the response as revised (but keep original for reference)
    setResponses(prev => {
      const next = [...prev];
      if (next[questionIndex]) {
        next[questionIndex] = {
          ...next[questionIndex],
          wasRevised: true,
          originalResponse: next[questionIndex].originalResponse || next[questionIndex].response,
          originalAnalytics: next[questionIndex].originalAnalytics || next[questionIndex].analytics,
          // Clear current response so they can re-answer
          response: null,
          analytics: null,
        };
      }
      return next;
    });

    // Re-init analytics for this question
    analytics.initQuestion(question);

  }, [preparedQuestions, analytics]);

  // Handle "Keep Answer" button click - user decides to keep their original answer
  const handleKeepAnswer = useCallback((questionIndex) => {
    // Track this decision
    setBackNavigations(prev => [
      ...prev,
      {
        timestamp: performance.now(),
        action: 'kept_answer',
        questionIndex,
        questionId: preparedQuestions[questionIndex]?.id,
      },
    ]);

    // If we're on the last question, go to confirm
    if (questionIndex >= preparedQuestions.length - 1) {
      setPhase('confirm');
      return;
    }

    // Navigate to next question
    setCurrentQuestionIndex(questionIndex + 1);
  }, [preparedQuestions]);

  // Analyze quiz - calls backend API (runs in parallel with animation)
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

    // Build API payload (include back navigation data)
    const apiPayload = buildApiPayload(allResponses, preparedQuestions, personalitiesData, calculatedScores, backNavigations);

    // Log full payload for debugging
    console.log('%c=== QUIZ SUBMISSION PAYLOAD ===', 'color: #4facfe; font-weight: bold; font-size: 14px;');
    console.log('%cFull payload being sent to backend:', 'color: #00f2fe;');
    console.log(JSON.stringify(apiPayload, null, 2));
    console.log('%c================================', 'color: #4facfe; font-weight: bold;');

    try {
      const res = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });

      if (res.ok) {
        const data = await res.json();
        console.log('%c=== API RESPONSE ===', 'color: #67c23a; font-weight: bold;');
        console.log('Success:', data.success);
        console.log('Result:', data.result);
        console.log('Analysis:', data.analysis);
        console.log('%c====================', 'color: #67c23a; font-weight: bold;');

        setApiResult(data);

        if (data.success && data.result?.personalityId) {
          // Use API-determined personality
          const apiPersonality = personalitiesData.find(p => p.id === data.result.personalityId);
          if (apiPersonality) {
            winningPersonality = apiPersonality;
            // Store behavioral notes for display
            if (data.result.behavioralNotes) {
              winningPersonality = {
                ...apiPersonality,
                behavioralNotes: data.result.behavioralNotes,
                aiConfidence: data.result.confidence,
                aiReasoning: data.result.reasoning,
              };
            }
          }
        }
      }
    } catch (err) {
      console.warn('API call failed, using local scoring:', err);
    }

    // Store results for when animation completes
    pendingResultsRef.current = {
      scores: calculatedScores,
      personality: winningPersonality,
    };
    setApiComplete(true);
  }, [preparedQuestions, backNavigations]);

  // Handle "Start Analysis" button from confirm screen
  const handleConfirmAnalysis = useCallback(() => {
    setPhase('analyzing');
    setAnimationComplete(false);
    setApiComplete(false);
    pendingResultsRef.current = null;

    // Call API with current responses
    analyzeQuiz(responses);
  }, [responses, analyzeQuiz]);

  // Transition to results when both animation and API are complete
  useEffect(() => {
    if (phase === 'analyzing' && animationComplete && apiComplete && pendingResultsRef.current) {
      const { scores: finalScores, personality: finalPersonality } = pendingResultsRef.current;
      setScores(finalScores);
      setPersonality(finalPersonality);
      setPhase('results');
    }
  }, [phase, animationComplete, apiComplete]);

  // Handle animation complete
  const handleAnalysisAnimationComplete = useCallback(() => {
    setAnimationComplete(true);
  }, []);

  // Build payload for backend API
  const buildApiPayload = (responses, questions, personalities, scores, backNavs = []) => {
    return {
      quizId: 'ai-personality-quiz',
      personalities: personalities.map(p => ({ id: p.id, name: p.name })),
      clientFallback: {
        personalityId: Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || personalities[0]?.id,
      },
      // Include back navigation data for behavioral analysis
      backNavigations: backNavs.length > 0 ? {
        count: backNavs.length,
        events: backNavs,
      } : undefined,
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

        // Flag if this question was revised and include original response
        if (r.wasRevised) {
          baseQuestion.wasRevised = true;
          // Include original response for analysis
          if (r.originalResponse) {
            baseQuestion.originalResponse = r.originalResponse;
          }
          if (r.originalAnalytics) {
            const origTiming = r.originalAnalytics.timing || {};
            baseQuestion.originalTiming = {
              responseTime: origTiming.responseTime ? Math.round(origTiming.responseTime) : undefined,
            };
          }
        }

        // Only add timing fields if they have valid values
        if (timing.questionShownAt) baseQuestion.startedAtMs = Math.round(timing.questionShownAt);
        if (timing.completedAt) baseQuestion.answeredAtMs = Math.round(timing.completedAt);
        if (timing.responseTime) baseQuestion.delayMs = Math.round(timing.responseTime);

        // Add selection order tracking for all selection types
        const selectionOrder = analytics.response?.selectionOrder || [];
        if (selectionOrder.length > 0) {
          baseQuestion.selectionHistory = selectionOrder;
        }

        // Add presentation order (random order options were shown)
        if (analytics.presentationOrder?.length > 0) {
          baseQuestion.presentationOrder = analytics.presentationOrder;
        }

        // Add type-specific data
        switch (q.type) {
          case 'text-multiple-choice':
          case 'slide-to-select': {
            const selectedIds = analytics.response?.selectedIds || [];
            // Single selection - just use selectedId
            if (selectedIds[0]) {
              baseQuestion.selectedId = selectedIds[0];
            }
            const hoverMap = buildHoverMap(analytics.interactions);
            if (hoverMap) {
              baseQuestion.hoverMsByOption = hoverMap;
            }
            // Track if selection changed
            const deselections = selectionOrder.filter(s => s.startsWith('-'));
            if (deselections.length > 0) {
              baseQuestion.changedMind = true;
              baseQuestion.selectionChanges = deselections.length;
            }
            return baseQuestion;
          }
          case 'image-multiple-choice': {
            const selectedIds = analytics.response?.selectedIds || [];
            const hoverMap = buildHoverMap(analytics.interactions);
            if (hoverMap) {
              baseQuestion.hoverMsByOption = hoverMap;
            }

            // Track deselections
            const deselections = selectionOrder.filter(s => s.startsWith('-'));
            if (deselections.length > 0) {
              baseQuestion.changedMind = true;
              baseQuestion.selectionChanges = deselections.length;
            }

            // Multi-select: include all selections with order info
            if (selectedIds.length > 1) {
              baseQuestion.selectedIds = selectedIds;
              // First selection is most instinctive
              baseQuestion.firstSelection = selectionOrder.find(s => !s.startsWith('-')) || selectedIds[0];
              // Calculate position of each selection in presentation order
              baseQuestion.selectionPositions = selectedIds.map(id => ({
                id,
                position: (analytics.presentationOrder?.indexOf(id) ?? -1) + 1,
              }));
            } else if (selectedIds[0]) {
              // Single selection fallback
              baseQuestion.selectedId = selectedIds[0];
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
            baseQuestion.swaps = swaps;

            // Flag if user didn't interact at all (accepted default order)
            if (swaps === 0) {
              baseQuestion.noInteraction = true;
              baseQuestion.interactionQuality = 'low';
            } else if (swaps <= 2) {
              baseQuestion.interactionQuality = 'medium';
            } else {
              baseQuestion.interactionQuality = 'high';
            }

            // Check for items moved multiple times (hesitation)
            const moveCounts = {};
            analytics.rankings?.moves?.forEach(m => {
              moveCounts[m.itemId] = (moveCounts[m.itemId] || 0) + 1;
            });
            const hesitantItems = Object.entries(moveCounts).filter(([, count]) => count > 1);
            if (hesitantItems.length > 0) {
              baseQuestion.hesitantItems = hesitantItems.map(([id, count]) => ({ id, moves: count }));
            }

            if (timing.responseTime) {
              baseQuestion.durationMs = Math.round(timing.responseTime);
            }
            return baseQuestion;
          }
          case 'range': {
            // Use r.response as fallback for the same race condition reason
            const sliderData = analytics.sliderData || {};
            const sliders = Object.entries(sliderData);

            // Calculate slider values and movements
            const sliderValues = {};
            let totalMovement = 0;
            let movedCount = 0;
            const extremeValues = [];

            sliders.forEach(([id, data]) => {
              if (typeof data.value === 'number') {
                sliderValues[id] = data.value;
                totalMovement += data.totalMovement || 0;
                if (data.totalMovement > 0) movedCount++;
                // Track extreme positions (1 or 10 on 1-10 scale, or edges)
                if (data.value <= 1 || data.value >= 9) {
                  extremeValues.push({ id, value: data.value });
                }
              }
            });

            // Include all slider values
            if (Object.keys(sliderValues).length > 0) {
              baseQuestion.values = sliderValues;
              // Also include a normalized average for simple scoring
              const avg = Object.values(sliderValues).reduce((a, b) => a + b, 0) / Object.values(sliderValues).length;
              baseQuestion.value = Math.max(0, Math.min(1, avg / 10));
            }

            // Flag if user didn't interact with sliders
            const expectedSliders = q.statements?.length || 0;
            if (movedCount === 0) {
              baseQuestion.noInteraction = true;
              baseQuestion.interactionQuality = 'low';
            } else if (movedCount < expectedSliders) {
              baseQuestion.partialInteraction = true;
              baseQuestion.slidersModified = movedCount;
              baseQuestion.slidersTotal = expectedSliders;
              baseQuestion.interactionQuality = 'medium';
            } else {
              baseQuestion.interactionQuality = 'high';
            }

            // Include movement data
            baseQuestion.totalMovement = Math.round(totalMovement);

            // Include extreme values
            if (extremeValues.length > 0) {
              baseQuestion.extremePositions = extremeValues;
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
            const text = analytics.response?.text || analytics.freeResponse?.text || r.response;
            if (text) {
              baseQuestion.text = text;
              // Calculate word count
              const words = text.split(/\s+/).filter(w => w.length > 0);
              baseQuestion.wordCount = words.length;
              baseQuestion.charCount = text.length;
            }
            // Include typing analytics
            const freeResponseData = analytics.freeResponse || {};
            if (freeResponseData.typingSpeed) {
              baseQuestion.typingSpeed = Math.round(freeResponseData.typingSpeed); // WPM
            }
            if (freeResponseData.deletions > 0) {
              baseQuestion.deletions = freeResponseData.deletions;
            }
            if (freeResponseData.pauses?.length > 0) {
              baseQuestion.pauseCount = freeResponseData.pauses.length;
              // Pauses are objects with duration property
              baseQuestion.totalPauseMs = Math.round(
                freeResponseData.pauses.reduce((sum, p) => sum + (p.duration || 0), 0)
              );
            }
            if (freeResponseData.keystrokes?.length > 0) {
              baseQuestion.keystrokeCount = freeResponseData.keystrokes.length;
            }
            // Track if there were significant edits
            if (freeResponseData.deletions > (baseQuestion.charCount || 0) * 0.5) {
              baseQuestion.heavilyEdited = true;
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
        className={`app__questions ${phase === 'quiz' || phase === 'confirm' ? 'visible' : ''}`}
        ref={questionsRef}
      >
        {preparedQuestions.map((question, index) => {
          // Determine question state
          const isCurrentQuestion = index === currentQuestionIndex;
          const hasResponse = responses[index]?.response != null;
          const isBeingRevised = revisingQuestionIndex === index;
          const isShowingFeedback = showingFeedbackForQuestion === index;

          // Question is "locked" if it's been answered AND we're not actively revising it
          // (stays locked even when viewing it - user must click "Change Answer" to unlock)
          const isLocked = hasResponse && !isBeingRevised;

          // Question should be hidden if we're revising an earlier question
          const shouldHide = revisingQuestionIndex !== null && index > revisingQuestionIndex;

          // Question is disabled during feedback display
          const isDisabled = isShowingFeedback || isLocked;

          // Get response values to display:
          // - When revising: show original response (what they had before clicking "Change Answer")
          // - When locked: show current response (their saved answer)
          const displayResponse = isBeingRevised
            ? responses[index]?.originalResponse
            : responses[index]?.response;

          return (
            <Question
              key={`${runId}-${question.id}`}
              question={question}
              questionIndex={index}
              currentQuestionIndex={currentQuestionIndex}
              isActive={phase === 'quiz' && isCurrentQuestion && !shouldHide}
              isAnswered={hasResponse && index < currentQuestionIndex}
              isLocked={isLocked}
              isRevising={isBeingRevised}
              previousResponse={displayResponse}
              shouldHide={shouldHide}
              isDisabled={isDisabled}
              showingFeedback={isShowingFeedback}
              runId={runId}
              analytics={analytics}
              onAnswer={(response) => handleAnswer(index, response)}
              onBack={handleBack}
              onChangeAnswer={() => handleChangeAnswer(index)}
              onKeepAnswer={() => handleKeepAnswer(index)}
              onInteraction={(interaction) => handleInteraction(index, interaction)}
              onMarkOptionsShown={() => handleMarkOptionsShown(index)}
              typeSpeed={TYPE_SPEED}
            />
          );
        })}
      </div>

      {/* Confirmation Screen */}
      {phase === 'confirm' && (
        <div className="app__confirm">
          <div className="app__confirm-content">
            <h2 className="app__confirm-title">Ready to see your results?</h2>
            <p className="app__confirm-subtitle">
              You've answered all {preparedQuestions.length} questions.
              You can go back to review your answers or start the analysis.
            </p>
            <div className="app__confirm-actions">
              <button
                className="app__confirm-back"
                onClick={handleBack}
              >
                ← Review Answers
              </button>
              <button
                className="app__confirm-start"
                onClick={handleConfirmAnalysis}
              >
                Start Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Micro Feedback Overlay */}
      {(phase === 'quiz' || phase === 'confirm') && (() => {
        // Determine which feedback to show
        // 1. If we just answered (showingFeedbackForQuestion is set), show currentFeedback
        // 2. If we went back to view a locked question, show stored feedback
        let feedbackToShow = null;
        let feedbackKey = runId;

        if (showingFeedbackForQuestion !== null) {
          feedbackToShow = currentFeedback;
          feedbackKey = `${runId}-${showingFeedbackForQuestion}-current`;
        } else if (currentQuestionIndex >= 0 &&
          responses[currentQuestionIndex]?.feedback &&
          responses[currentQuestionIndex]?.response != null &&
          revisingQuestionIndex === null) {
          // Viewing a previously answered question
          feedbackToShow = responses[currentQuestionIndex].feedback;
          feedbackKey = `${runId}-${currentQuestionIndex}-stored`;
        }

        return feedbackToShow ? (
          <MicroFeedback
            key={feedbackKey}
            feedback={feedbackToShow}
            isVisible={true}
          />
        ) : null;
      })()}

      {/* Analysis Animation */}
      <AnalysisAnimation
        isActive={phase === 'analyzing'}
        duration={ANALYSIS_DURATION}
        onComplete={handleAnalysisAnimationComplete}
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
