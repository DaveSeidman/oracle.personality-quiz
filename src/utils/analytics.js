/**
 * Analytics Engine
 * Tracks all behavioral data during quiz interactions
 */

// Generate observational micro-feedback messages based on behavioral analytics
// These describe what the user did, with small qualifying statements about what it might mean
export const generateMicroFeedback = (questionAnalytics, questionType, question) => {
  const messages = [];
  const { timing, interactions, response, rankings, sliderData, freeResponse } = questionAnalytics;
  
  const rt = timing?.responseTime;
  const finalSelection = response?.selectedIds?.[0];
  const selectedIds = response?.selectedIds || [];
  const selectionOrder = response?.selectionOrder || [];
  const deselections = selectionOrder.filter(s => s.startsWith('-'));
  const presentationOrder = questionAnalytics.presentationOrder || [];
  
  // Calculate pressure stats
  const pressureEvents = interactions?.filter(i => i.pressure !== undefined && i.pressure > 0) || [];
  const avgPressure = pressureEvents.length > 0 
    ? pressureEvents.reduce((a, b) => a + b.pressure, 0) / pressureEvents.length 
    : null;
  
  // Helper to get position in presentation order
  const getPosition = (id) => {
    const pos = presentationOrder.indexOf(id);
    return pos >= 0 ? pos + 1 : null;
  };
  
  // Helper to format duration
  const formatDuration = (ms) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)} seconds`;
  };
  
  // 1. Selection change behavior (most insightful)
  if (deselections.length > 0 && finalSelection) {
    const originalChoice = selectionOrder.find(s => !s.startsWith('-'));
    if (originalChoice && originalChoice !== finalSelection) {
      messages.push({ 
        text: `User originally selected ${originalChoice}, then changed to ${finalSelection} — perhaps reconsidering their first instinct.` 
      });
    } else if (deselections.length > 1) {
      messages.push({ 
        text: `User toggled between options ${deselections.length} times before settling on ${finalSelection} — suggesting some uncertainty.` 
      });
    }
  }
  
  // 2. Drag-away behavior (started to select but pulled away)
  const dragAways = interactions?.filter(i => 
    i.type === 'pointerleave-while-pressed' || i.data?.changedMind
  ) || [];
  
  if (dragAways.length > 0 && finalSelection) {
    const abandonedTargets = [...new Set(dragAways.map(d => d.targetId))].filter(t => t !== finalSelection);
    if (abandonedTargets.length === 1) {
      messages.push({ 
        text: `User pressed on ${abandonedTargets[0]} but pulled away, then chose ${finalSelection} — initial hesitation before committing.` 
      });
    } else if (abandonedTargets.length > 1) {
      messages.push({ 
        text: `User touched ${abandonedTargets.length} different options before committing to ${finalSelection} — exploring before deciding.` 
      });
    }
  }
  
  // 3. Response time with context
  if (rt !== undefined && finalSelection) {
    const position = getPosition(finalSelection);
    if (rt < 1500 && position === 1) {
      messages.push({ 
        text: `User selected the first option shown (${finalSelection}) in ${formatDuration(rt)} — possibly a gut reaction.` 
      });
    } else if (rt < 2000) {
      messages.push({ 
        text: `User responded quickly in ${formatDuration(rt)} — suggesting confidence in their choice.` 
      });
    } else if (rt > 10000) {
      messages.push({ 
        text: `User took ${formatDuration(rt)} to decide — careful deliberation or perhaps difficulty choosing.` 
      });
    }
  }
  
  // 4. Multi-select specific (image grid)
  if (selectedIds.length > 1) {
    const firstPick = selectionOrder.find(s => !s.startsWith('-'));
    const secondPick = selectionOrder.filter(s => !s.startsWith('-'))[1];
    if (firstPick && secondPick) {
      messages.push({ 
        text: `User selected ${firstPick} first, then added ${secondPick} — primary preference may be ${firstPick}.` 
      });
    }
  }
  
  // 5. Touch pressure analysis
  if (avgPressure !== null && finalSelection) {
    if (avgPressure > 0.7) {
      messages.push({ 
        text: `User pressed firmly when selecting ${finalSelection} — physical confidence in the choice.` 
      });
    } else if (avgPressure < 0.3) {
      messages.push({ 
        text: `User used light touch pressure throughout — tentative interaction style.` 
      });
    }
  }
  
  // 6. Slide-to-select specific
  if (questionType === 'slide-to-select') {
    const sliderEnds = interactions?.filter(i => i.type === 'slider-end') || [];
    const abandoned = sliderEnds.filter(e => !e.data?.completed);
    const completed = sliderEnds.find(e => e.data?.completed);
    
    if (abandoned.length > 0 && completed) {
      const maxPull = Math.max(...abandoned.map(a => a.data?.finalValue || 0));
      const abandonedId = abandoned.find(a => a.data?.finalValue === maxPull)?.targetId;
      if (abandonedId && maxPull > 0.3) {
        messages.push({ 
          text: `User started sliding ${abandonedId} to ${Math.round(maxPull * 100)}%, then released and chose ${completed.targetId} instead.` 
        });
      }
    }
    
    if (completed?.data?.velocity) {
      const v = completed.data.velocity;
      if (v > 200) {
        messages.push({ 
          text: `User completed the slide with a quick swipe — decisive action.` 
        });
      } else if (v < 40) {
        messages.push({ 
          text: `User slid slowly and deliberately — measured, careful selection.` 
        });
      }
    }
  }
  
  // 7. Ranked choice specific
  if (questionType === 'ranked-choice' && rankings) {
    const moves = rankings.moves || [];
    const finalOrder = rankings.final || [];
    
    if (moves.length === 0) {
      messages.push({ 
        text: `User accepted the presented order without making any changes — either agreement or minimal engagement.` 
      });
    } else {
      // Find items moved multiple times
      const moveCounts = {};
      moves.forEach(m => { moveCounts[m.itemId] = (moveCounts[m.itemId] || 0) + 1; });
      
      const contested = Object.entries(moveCounts).filter(([, c]) => c >= 3);
      if (contested.length > 0) {
        const [itemId, count] = contested[0];
        messages.push({ 
          text: `User repositioned "${itemId}" ${count} times — significant uncertainty about where it belongs.` 
        });
      }
      
      // Top position analysis
      const topItem = finalOrder[0];
      const topMoves = moves.filter(m => m.to === 0);
      if (topMoves.length > 1) {
        messages.push({ 
          text: `User changed the top ranking ${topMoves.length} times before settling on ${topItem} — debating priorities.` 
        });
      } else if (topItem && moves.some(m => m.itemId === topItem && m.to === 0)) {
        messages.push({ 
          text: `User deliberately moved ${topItem} to the top position — clear priority identified.` 
        });
      }
      
      // Check if bottom items were untouched
      const movedIds = [...new Set(moves.map(m => m.itemId))];
      const unmovedIds = finalOrder.filter(id => !movedIds.includes(id));
      if (unmovedIds.length > 0 && movedIds.length > 0) {
        messages.push({ 
          text: `User focused on ranking ${movedIds.join(', ')} but left ${unmovedIds.join(', ')} in place — selective engagement.` 
        });
      }
    }
  }
  
  // 8. Range slider specific
  if (questionType === 'range' && sliderData) {
    const sliders = Object.entries(sliderData);
    const modified = sliders.filter(([, s]) => s.totalMovement > 0);
    const unmodified = sliders.filter(([, s]) => !s.totalMovement || s.totalMovement === 0);
    
    if (unmodified.length > 0 && modified.length > 0) {
      messages.push({ 
        text: `User adjusted ${modified.length} sliders but left ${unmodified.length} at the default — partial engagement.` 
      });
    }
    
    // Extreme values
    const extremes = sliders.filter(([, s]) => s.value !== undefined && (s.value <= 2 || s.value >= 9));
    if (extremes.length >= 2) {
      messages.push({ 
        text: `User set ${extremes.length} sliders to extreme positions — strong opinions on these topics.` 
      });
    }
    
    // Most adjusted slider
    const mostAdjusted = sliders.sort((a, b) => (b[1].changes || 0) - (a[1].changes || 0))[0];
    if (mostAdjusted && (mostAdjusted[1].changes || 0) > 3) {
      messages.push({ 
        text: `User adjusted "${mostAdjusted[0]}" ${mostAdjusted[1].changes} times before settling on ${mostAdjusted[1].value} — some difficulty deciding.` 
      });
    }
  }
  
  // 9. Free response specific
  if (questionType === 'free-response' && freeResponse) {
    const { keystrokes = [], deletions = 0, pauses = [] } = freeResponse;
    
    if (keystrokes.length > 0) {
      const delRatio = deletions / keystrokes.length;
      if (delRatio > 0.3) {
        messages.push({ 
          text: `User deleted about ${Math.round(delRatio * 100)}% of what they typed — editing heavily, refining their thoughts.` 
        });
      }
      if (pauses.length >= 3) {
        messages.push({ 
          text: `User paused ${pauses.length} times while typing — thoughtful composition.` 
        });
      }
    }
  }
  
  // 10. Position bias detection
  if (finalSelection && presentationOrder.length > 0) {
    const position = getPosition(finalSelection);
    const total = presentationOrder.length;
    
    if (position === total && rt > 5000) {
      messages.push({ 
        text: `User selected the last option (${finalSelection}) after ${formatDuration(rt)} — reviewed all options before choosing.` 
      });
    }
  }
  
  // Fallback messages if we don't have enough
  if (messages.length < 2) {
    if (rt) {
      messages.push({ 
        text: `Response recorded in ${formatDuration(rt)}.` 
      });
    }
    if (finalSelection || selectedIds.length > 0) {
      const selected = selectedIds.length > 1 ? selectedIds.join(' and ') : finalSelection;
      messages.push({ 
        text: `User selected ${selected}.` 
      });
    }
  }
  
  // Return up to 3 messages
  return messages.slice(0, 3);
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
