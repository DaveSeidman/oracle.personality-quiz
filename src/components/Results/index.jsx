import React, { useState, useEffect } from 'react';
import './index.scss';

const Results = ({ 
  personality, 
  scores,
  allAnalytics,
  onRestart,
  isVisible,
}) => {
  const [showContent, setShowContent] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  
  useEffect(() => {
    if (isVisible) {
      // Stagger the reveal animations
      setTimeout(() => setShowContent(true), 300);
    } else {
      setShowContent(false);
      setShowDetails(false);
    }
  }, [isVisible]);
  
  if (!isVisible || !personality) return null;
  
  // Calculate percentage scores for visualization
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const scorePercentages = {};
  Object.entries(scores).forEach(([id, score]) => {
    scorePercentages[id] = totalScore > 0 ? (score / totalScore) * 100 : 0;
  });
  
  return (
    <div className={`results ${showContent ? 'visible' : ''}`}>
      <div className="results__content">
        <p className="results__intro">
          Based on your responses and behavioral patterns, you've matched with:
        </p>
        
        <h1 className="results__personality">
          {personality.name}
        </h1>
        
        <div className="results__traits">
          {personality.traits?.map(trait => (
            <span key={trait} className="results__trait">
              {trait}
            </span>
          ))}
        </div>
        
        <p className="results__description">
          {personality.description}
        </p>
        
        <div className="results__drink">
          <span className="results__drink-label">Your signature drink:</span>
          <span className="results__drink-name">{personality.drink}</span>
          <span className="results__drink-emoji">🍹</span>
        </div>
        
        {/* Score breakdown */}
        <button 
          className="results__details-toggle"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide' : 'Show'} Analysis Details
        </button>
        
        {showDetails && (
          <div className="results__details">
            <h3>Personality Score Breakdown</h3>
            <div className="results__scores">
              {Object.entries(scores).map(([id, score]) => (
                <div key={id} className="results__score-row">
                  <span className="results__score-label">{id}</span>
                  <div className="results__score-bar">
                    <div 
                      className="results__score-fill"
                      style={{ width: `${scorePercentages[id]}%` }}
                    />
                  </div>
                  <span className="results__score-value">
                    {score.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            
            <h3>Behavioral Metrics</h3>
            <div className="results__metrics">
              <div className="results__metric">
                <span className="results__metric-label">Questions Answered</span>
                <span className="results__metric-value">{allAnalytics.length}</span>
              </div>
              <div className="results__metric">
                <span className="results__metric-label">Total Interactions</span>
                <span className="results__metric-value">
                  {allAnalytics.reduce((sum, a) => sum + a.interactions.length, 0)}
                </span>
              </div>
              <div className="results__metric">
                <span className="results__metric-label">Avg Response Time</span>
                <span className="results__metric-value">
                  {(allAnalytics.reduce((sum, a) => sum + (a.timing.responseTime || 0), 0) / allAnalytics.length / 1000).toFixed(1)}s
                </span>
              </div>
            </div>
          </div>
        )}
        
        <button className="results__restart" onClick={onRestart}>
          Take Quiz Again
        </button>
      </div>
    </div>
  );
};

export default Results;
