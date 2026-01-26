import React, { useState, useEffect, useRef } from 'react';
import './index.scss';

// Sample analysis phrases to display during processing
const ANALYSIS_PHASES = [
  { text: 'Initializing behavioral pattern analysis...', duration: 1500 },
  { text: 'Processing response timing data...', duration: 1200 },
  { text: 'Calculating confidence coefficients...', duration: 1400 },
  { text: 'Analyzing interaction patterns...', duration: 1300 },
  { text: 'Cross-referencing personality markers...', duration: 1600 },
  { text: 'Synthesizing decision heuristics...', duration: 1200 },
  { text: 'Generating personality profile...', duration: 2000 },
];

const AnalysisAnimation = ({ 
  isActive, 
  videoSrc, 
  onComplete,
  duration = 10000, // Total animation duration
}) => {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dataPoints, setDataPoints] = useState([]);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  
  // Generate random data points for visualization
  useEffect(() => {
    if (!isActive) return;
    
    const points = [];
    for (let i = 0; i < 50; i++) {
      points.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 1 + Math.random() * 2,
      });
    }
    setDataPoints(points);
  }, [isActive]);
  
  // Cycle through analysis phases
  useEffect(() => {
    if (!isActive) {
      setCurrentPhase(0);
      return;
    }
    
    let phaseIndex = 0;
    const advancePhase = () => {
      if (phaseIndex < ANALYSIS_PHASES.length - 1) {
        phaseIndex++;
        setCurrentPhase(phaseIndex);
      }
    };
    
    const intervals = [];
    let elapsed = 0;
    
    ANALYSIS_PHASES.forEach((phase, index) => {
      if (index > 0) {
        const timer = setTimeout(() => {
          setCurrentPhase(index);
        }, elapsed);
        intervals.push(timer);
      }
      elapsed += phase.duration;
    });
    
    return () => {
      intervals.forEach(t => clearTimeout(t));
    };
  }, [isActive]);
  
  // Progress bar animation
  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      return;
    }
    
    const startTime = performance.now();
    let animationFrame;
    
    const updateProgress = () => {
      const elapsed = performance.now() - startTime;
      const newProgress = Math.min(100, (elapsed / duration) * 100);
      setProgress(newProgress);
      
      if (newProgress < 100) {
        animationFrame = requestAnimationFrame(updateProgress);
      } else {
        onComplete?.();
      }
    };
    
    animationFrame = requestAnimationFrame(updateProgress);
    
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [isActive, duration, onComplete]);
  
  // Play video when active
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive]);
  
  if (!isActive) return null;
  
  return (
    <div className="analysis-animation" ref={containerRef}>
      {/* Background video */}
      {videoSrc && (
        <video
          ref={videoRef}
          className="analysis-animation__video"
          src={videoSrc}
          muted
          loop
          playsInline
        />
      )}
      
      {/* Fallback animated background if no video */}
      {!videoSrc && (
        <div className="analysis-animation__fallback">
          {/* Neural network visualization */}
          <svg className="analysis-animation__network" viewBox="0 0 100 100">
            {dataPoints.map(point => (
              <circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r="0.5"
                className="analysis-animation__node"
                style={{
                  '--delay': `${point.delay}s`,
                  '--duration': `${point.duration}s`,
                }}
              />
            ))}
            {/* Connection lines */}
            {dataPoints.slice(0, 20).map((point, i) => {
              const nextPoint = dataPoints[(i + 1) % 20];
              return (
                <line
                  key={`line-${i}`}
                  x1={point.x}
                  y1={point.y}
                  x2={nextPoint.x}
                  y2={nextPoint.y}
                  className="analysis-animation__connection"
                  style={{ '--delay': `${point.delay}s` }}
                />
              );
            })}
          </svg>
          
          {/* Pulsing rings */}
          <div className="analysis-animation__rings">
            <div className="analysis-animation__ring" style={{ '--delay': '0s' }} />
            <div className="analysis-animation__ring" style={{ '--delay': '0.5s' }} />
            <div className="analysis-animation__ring" style={{ '--delay': '1s' }} />
          </div>
        </div>
      )}
      
      {/* Content overlay */}
      <div className="analysis-animation__content">
        <h2 className="analysis-animation__title">
          Analyzing Your Responses
        </h2>
        
        <div className="analysis-animation__phase">
          <span className="analysis-animation__phase-text">
            {ANALYSIS_PHASES[currentPhase]?.text}
          </span>
        </div>
        
        <div className="analysis-animation__progress">
          <div className="analysis-animation__progress-track">
            <div 
              className="analysis-animation__progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="analysis-animation__progress-text">
            {Math.round(progress)}%
          </span>
        </div>
        
        {/* Data stream visualization */}
        <div className="analysis-animation__stream">
          {Array.from({ length: 8 }).map((_, i) => (
            <div 
              key={i}
              className="analysis-animation__stream-line"
              style={{ '--index': i }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisAnimation;
