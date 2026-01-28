/**
 * Analytics Engine
 * Tracks all behavioral data during quiz interactions
 */

// Generate micro-feedback messages based on analytics
export const generateMicroFeedback = (questionAnalytics, questionType) => {
  const messages = [];
  const { timing, interactions, response } = questionAnalytics;
  
  // Response time analysis
  if (timing?.responseTime) {
    const responseTime = timing.responseTime;
    if (responseTime < 1500) {
      messages.push({
        type: 'confidence',
        text: `Response recorded in ${responseTime}ms — high confidence indicator detected`,
        impact: 'positive'
      });
    } else if (responseTime > 5000) {
      messages.push({
        type: 'deliberation',
        text: `${(responseTime / 1000).toFixed(1)}s deliberation time suggests careful consideration`,
        impact: 'neutral'
      });
    }
  }

  // Hover analysis (web only)
  const hovers = interactions?.filter(i => i.type === 'hover') || [];
  if (hovers.length > 3) {
    messages.push({
      type: 'exploration',
      text: `${hovers.length} option explorations detected — uncertainty coefficient +${Math.round(hovers.length * 4)}%`,
      impact: 'neutral'
    });
  }

  // Touch pressure analysis
  const pressureEvents = interactions?.filter(i => i.pressure !== undefined) || [];
  if (pressureEvents.length > 0) {
    const avgPressure = pressureEvents.reduce((a, b) => a + b.pressure, 0) / pressureEvents.length;
    if (avgPressure > 0.7) {
      messages.push({
        type: 'pressure',
        text: `Touch pressure ${(avgPressure * 100).toFixed(0)}% above baseline — reducing ambivalence factor`,
        impact: 'positive'
      });
    }
  }

  // Slider-specific analysis
  if (questionType === 'slide-to-select' && timing?.sliderDuration) {
    if (timing.sliderDuration < 500) {
      messages.push({
        type: 'slider-speed',
        text: `Rapid slide completion (${timing.sliderDuration}ms) — decisive selection pattern`,
        impact: 'positive'
      });
    } else if (timing.sliderDuration > 2000) {
      messages.push({
        type: 'slider-hesitation',
        text: `Extended slider engagement — weighing commitment before confirmation`,
        impact: 'neutral'
      });
    }
  }

  // Ranked choice analysis
  if (questionType === 'ranked-choice' && questionAnalytics.rankings) {
    const { moves } = questionAnalytics.rankings;
    const rearrangements = moves?.length || 0;
    
    // No reordering - user accepted default order
    if (rearrangements === 0) {
      messages.push({
        type: 'no-reorder',
        text: `Default order accepted without modification — reducing question weight coefficient`,
        impact: 'negative'
      });
    } else if (rearrangements > 4) {
      messages.push({
        type: 'reordering',
        text: `${rearrangements} position changes — priority recalibration in progress`,
        impact: 'neutral'
      });
    } else if (rearrangements >= 1 && rearrangements <= 2) {
      messages.push({
        type: 'minor-reorder',
        text: `${rearrangements} strategic repositioning${rearrangements > 1 ? 's' : ''} — clear preference hierarchy`,
        impact: 'positive'
      });
    }
    
    // Check for items moved multiple times
    const moveCounts = {};
    moves?.forEach(m => {
      moveCounts[m.itemId] = (moveCounts[m.itemId] || 0) + 1;
    });
    const multiMoved = Object.entries(moveCounts).filter(([, count]) => count > 1);
    if (multiMoved.length > 0) {
      messages.push({
        type: 'hesitation',
        text: `Item repositioned ${multiMoved[0][1]}x — preference uncertainty flagged`,
        impact: 'negative'
      });
    }
  }

  // Range analysis
  if (questionType === 'range') {
    const sliderData = questionAnalytics.sliderData || {};
    const sliders = Object.values(sliderData);
    const totalSliders = sliders.length;
    const movedSliders = sliders.filter(s => s.totalMovement > 0);
    const highMovement = sliders.filter(s => s.totalMovement > 100);
    
    // No sliders touched at all
    if (totalSliders === 0 || movedSliders.length === 0) {
      messages.push({
        type: 'no-slider-interaction',
        text: `No slider adjustments made — default values accepted, reducing question weight`,
        impact: 'negative'
      });
    } else if (movedSliders.length < totalSliders) {
      const untouched = totalSliders - movedSliders.length;
      messages.push({
        type: 'partial-slider-interaction',
        text: `${untouched} of ${totalSliders} sliders unchanged — partial engagement noted`,
        impact: 'neutral'
      });
    }
    
    if (highMovement.length > 0) {
      messages.push({
        type: 'range-adjustment',
        text: `Significant value recalibration detected across ${highMovement.length} statement${highMovement.length > 1 ? 's' : ''}`,
        impact: 'neutral'
      });
    }
    
    // Check for sliders moved to extreme values
    const extremeSliders = sliders.filter(s => {
      const val = s.value;
      return val !== undefined && (val <= 1 || val >= 9);
    });
    if (extremeSliders.length > 0) {
      messages.push({
        type: 'extreme-values',
        text: `${extremeSliders.length} extreme position${extremeSliders.length > 1 ? 's' : ''} selected — strong preference signal`,
        impact: 'positive'
      });
    }
  }

  // Free response analysis
  if (questionType === 'free-response' && questionAnalytics.freeResponse) {
    const { typingSpeed, pauses, deletions } = questionAnalytics.freeResponse;
    if (deletions > 5) {
      messages.push({
        type: 'editing',
        text: `${deletions} revisions made — response refinement behavior observed`,
        impact: 'neutral'
      });
    }
    if (pauses?.length > 3) {
      messages.push({
        type: 'pauses',
        text: `${pauses.length} composition pauses — thoughtful articulation pattern`,
        impact: 'positive'
      });
    }
  }

  // Selection order for multiple choice
  if (response?.selectionOrder?.length > 1) {
    messages.push({
      type: 'selection-order',
      text: `Multi-select sequence: ${response.selectionOrder.join(' → ')} — preference hierarchy noted`,
      impact: 'neutral'
    });
  }

  return messages;
};

// Create initial analytics object for a question
export const createQuestionAnalytics = (question, presentationOrder) => ({
  questionId: question.id,
  questionType: question.type,
  presentationOrder,
  response: {
    selectedIds: [],
    selectionOrder: [],
    selectionTimestamps: [],
  },
  timing: {
    questionShownAt: performance.now(),
    optionsShownAt: null,
    firstInteractionAt: null,
    completedAt: null,
    responseTime: null,
    dwellTime: null,
    sliderDuration: null,
  },
  interactions: [],
  rankings: question.type === 'ranked-choice' ? {
    initial: [...presentationOrder],
    final: [],
    moves: [],
  } : null,
  sliderData: question.type === 'range' ? {} : null,
  freeResponse: question.type === 'free-response' ? {
    text: '',
    typingSpeed: 0,
    pauses: [],
    deletions: 0,
    keystrokes: [],
  } : null,
});

// Record an interaction event
export const recordInteraction = (analytics, event) => {
  const interaction = {
    type: event.type,
    targetId: event.targetId,
    timestamp: performance.now(),
    ...event.data,
  };

  // Record first interaction time
  if (!analytics.timing.firstInteractionAt) {
    analytics.timing.firstInteractionAt = interaction.timestamp;
  }

  // Add pressure if available (PointerEvent)
  if (event.pressure !== undefined) {
    interaction.pressure = event.pressure;
  }

  analytics.interactions.push(interaction);
  return analytics;
};

// Record a selection
export const recordSelection = (analytics, optionId, isSelected = true) => {
  const now = performance.now();
  
  if (isSelected) {
    if (!analytics.response.selectedIds.includes(optionId)) {
      analytics.response.selectedIds.push(optionId);
      analytics.response.selectionOrder.push(optionId);
      analytics.response.selectionTimestamps.push(now);
    }
  } else {
    // Deselection (for multiple choice)
    const idx = analytics.response.selectedIds.indexOf(optionId);
    if (idx > -1) {
      analytics.response.selectedIds.splice(idx, 1);
      // Keep in selectionOrder to track that it was selected then deselected
      analytics.response.selectionOrder.push(`-${optionId}`);
      analytics.response.selectionTimestamps.push(now);
    }
  }

  return analytics;
};

// Record ranked choice move
export const recordRankMove = (analytics, itemId, fromIndex, toIndex) => {
  if (!analytics.rankings) return analytics;
  
  analytics.rankings.moves.push({
    itemId,
    from: fromIndex,
    to: toIndex,
    timestamp: performance.now(),
  });
  
  return analytics;
};

// Record slider/range data
export const recordSliderChange = (analytics, sliderId, value, prevValue) => {
  if (!analytics.sliderData) analytics.sliderData = {};
  
  if (!analytics.sliderData[sliderId]) {
    analytics.sliderData[sliderId] = {
      value,
      initialValue: prevValue ?? value,
      moveHistory: [],
      totalMovement: 0,
      startTime: performance.now(),
    };
  }
  
  const slider = analytics.sliderData[sliderId];
  const movement = Math.abs(value - (slider.value || slider.initialValue));
  slider.totalMovement += movement;
  slider.value = value;
  slider.moveHistory.push({
    value,
    timestamp: performance.now(),
  });
  
  return analytics;
};

// Record free response typing
export const recordTyping = (analytics, text, event) => {
  if (!analytics.freeResponse) return analytics;
  
  const now = performance.now();
  const keystroke = {
    key: event.key,
    timestamp: now,
    textLength: text.length,
  };
  
  analytics.freeResponse.keystrokes.push(keystroke);
  analytics.freeResponse.text = text;
  
  // Track deletions
  if (event.key === 'Backspace' || event.key === 'Delete') {
    analytics.freeResponse.deletions++;
  }
  
  // Track pauses (gaps > 2 seconds between keystrokes)
  const keystrokes = analytics.freeResponse.keystrokes;
  if (keystrokes.length > 1) {
    const gap = now - keystrokes[keystrokes.length - 2].timestamp;
    if (gap > 2000) {
      analytics.freeResponse.pauses.push({
        duration: gap,
        afterChar: keystrokes.length - 1,
      });
    }
  }
  
  // Calculate typing speed (WPM)
  if (keystrokes.length > 10) {
    const duration = (now - keystrokes[0].timestamp) / 1000 / 60; // minutes
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    analytics.freeResponse.typingSpeed = Math.round(words / duration);
  }
  
  return analytics;
};

// Finalize question analytics
export const finalizeQuestionAnalytics = (analytics) => {
  const now = performance.now();
  analytics.timing.completedAt = now;
  
  if (analytics.timing.optionsShownAt) {
    analytics.timing.dwellTime = now - analytics.timing.optionsShownAt;
  }
  
  if (analytics.timing.firstInteractionAt) {
    analytics.timing.responseTime = now - analytics.timing.firstInteractionAt;
  }
  
  // Finalize ranked choice
  if (analytics.rankings) {
    // Final order will be set by the component
  }
  
  return analytics;
};

// Calculate personality scores from all analytics
export const calculateScores = (allAnalytics, questions, personalities) => {
  const scores = {};
  personalities.forEach(p => { scores[p.id] = 0; });
  
  allAnalytics.forEach((analytics, idx) => {
    const question = questions[idx];
    if (!question || !analytics) return;
    
    switch (question.type) {
      case 'text-multiple-choice':
      case 'image-multiple-choice':
      case 'slide-to-select': {
        const selectedIds = analytics.response?.selectedIds || [];
        selectedIds.forEach(id => {
          const option = question.options?.find(o => o.id === id);
          if (option?.weight) {
            Object.entries(option.weight).forEach(([pId, w]) => {
              scores[pId] = (scores[pId] || 0) + w;
            });
          }
        });
        break;
      }
      
      case 'ranked-choice': {
        const final = analytics.rankings?.final || [];
        final.forEach((id, rank) => {
          const option = question.options?.find(o => o.id === id);
          if (option?.weight) {
            // Higher rank = more weight (rank 0 = 1.0, rank 1 = 0.75, etc.)
            const multiplier = 1 - (rank * 0.25);
            Object.entries(option.weight).forEach(([pId, w]) => {
              scores[pId] = (scores[pId] || 0) + (w * Math.max(0.25, multiplier));
            });
          }
        });
        break;
      }
      
      case 'range': {
        question.statements?.forEach(stmt => {
          const value = analytics.sliderData?.[stmt.id]?.value;
          if (value !== undefined && stmt.weight) {
            // Normalize value to 0-1 range
            const normalized = (value - stmt.min) / (stmt.max - stmt.min);
            Object.entries(stmt.weight).forEach(([pId, w]) => {
              scores[pId] = (scores[pId] || 0) + (w * normalized);
            });
          }
        });
        break;
      }
      
      // Free response doesn't contribute to direct scoring
      // It will be analyzed by the AI
    }
  });
  
  return scores;
};

// Generate the complete data payload for AI analysis
export const generateAIPayload = (allAnalytics, questions, personalities, scores) => {
  return {
    timestamp: new Date().toISOString(),
    quizVersion: '2.0',
    totalDuration: allAnalytics.length > 0 
      ? allAnalytics[allAnalytics.length - 1]?.timing?.completedAt - allAnalytics[0]?.timing?.questionShownAt
      : 0,
    
    directScores: scores,
    
    questions: allAnalytics.map((analytics, idx) => ({
      questionId: analytics.questionId,
      questionType: analytics.questionType,
      questionText: questions[idx]?.text,
      presentationOrder: analytics.presentationOrder,
      response: analytics.response,
      timing: {
        ...analytics.timing,
        // Convert to relative times
        responseTimeMs: analytics.timing.responseTime,
        dwellTimeMs: analytics.timing.dwellTime,
      },
      interactionCount: analytics.interactions.length,
      interactionTypes: [...new Set(analytics.interactions.map(i => i.type))],
      
      // Type-specific data
      ...(analytics.rankings && { rankings: analytics.rankings }),
      ...(analytics.sliderData && { sliderData: analytics.sliderData }),
      ...(analytics.freeResponse && { freeResponse: analytics.freeResponse }),
      
      // Behavioral indicators
      behavioralSignals: {
        avgPressure: calculateAvgPressure(analytics.interactions),
        hesitationEvents: countHesitations(analytics),
        confidenceScore: calculateConfidenceScore(analytics),
      },
    })),
    
    personalities: personalities.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      aiPromptContext: p.aiPromptContext,
      rawScore: scores[p.id],
    })),
    
    globalBehavioralMetrics: {
      avgResponseTime: calculateAvgResponseTime(allAnalytics),
      totalInteractions: allAnalytics.reduce((sum, a) => sum + a.interactions.length, 0),
      overallConfidence: calculateOverallConfidence(allAnalytics),
    },
  };
};

// Helper functions
const calculateAvgPressure = (interactions) => {
  const pressures = interactions.filter(i => i.pressure !== undefined).map(i => i.pressure);
  return pressures.length > 0 ? pressures.reduce((a, b) => a + b, 0) / pressures.length : null;
};

const countHesitations = (analytics) => {
  let count = 0;
  
  // Multiple selections/deselections
  const deselections = analytics.response.selectionOrder.filter(s => s.startsWith('-'));
  count += deselections.length;
  
  // Multiple moves of same item in ranked choice
  if (analytics.rankings?.moves) {
    const moveCounts = {};
    analytics.rankings.moves.forEach(m => {
      moveCounts[m.itemId] = (moveCounts[m.itemId] || 0) + 1;
    });
    count += Object.values(moveCounts).filter(c => c > 1).length;
  }
  
  return count;
};

const calculateConfidenceScore = (analytics) => {
  let score = 1.0;
  
  // Reduce for long response times
  if (analytics.timing.responseTime > 5000) {
    score -= 0.1 * Math.min(5, (analytics.timing.responseTime - 5000) / 1000);
  }
  
  // Reduce for hesitations
  score -= countHesitations(analytics) * 0.1;
  
  // Increase for high pressure
  const avgPressure = calculateAvgPressure(analytics.interactions);
  if (avgPressure && avgPressure > 0.6) {
    score += 0.1;
  }
  
  return Math.max(0, Math.min(1, score));
};

const calculateAvgResponseTime = (allAnalytics) => {
  const times = allAnalytics.filter(a => a.timing.responseTime).map(a => a.timing.responseTime);
  return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
};

const calculateOverallConfidence = (allAnalytics) => {
  const scores = allAnalytics.map(calculateConfidenceScore);
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5;
};
