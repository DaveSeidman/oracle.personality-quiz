import React, { useState, useEffect } from 'react';
import './index.scss';

const StartScreen = ({ 
  onStart, 
  isVisible, 
  title = "Discover Your AI Personality",
  subtitle = "Answer a few questions to discover which AI approach matches your style",
  buttonText = "Begin",
  logoSrc,
}) => {
  const [isReady, setIsReady] = useState(false);
  
  useEffect(() => {
    if (isVisible) {
      // Small delay to allow CSS transition
      const timer = setTimeout(() => setIsReady(true), 100);
      return () => clearTimeout(timer);
    } else {
      setIsReady(false);
    }
  }, [isVisible]);
  
  const handleStart = (e) => {
    // Get pointer pressure if available
    const pressure = e.pressure ?? e.nativeEvent?.pressure ?? 0.5;
    onStart?.({ pressure, timestamp: performance.now() });
  };
  
  if (!isVisible) return null;
  
  return (
    <div className={`start-screen ${isReady ? 'ready' : ''}`}>
      <div className="start-screen__content">
        {logoSrc && (
          <img 
            src={logoSrc} 
            alt="Logo" 
            className="start-screen__logo"
          />
        )}
        
        <h1 className="start-screen__title">
          {title}
        </h1>
        
        <p className="start-screen__subtitle">
          {subtitle}
        </p>
        
        <div className="start-screen__features">
          <div className="start-screen__feature">
            <span className="start-screen__feature-icon">🎯</span>
            <span className="start-screen__feature-text">Personalized Results</span>
          </div>
          <div className="start-screen__feature">
            <span className="start-screen__feature-icon">⚡</span>
            <span className="start-screen__feature-text">2-3 Minutes</span>
          </div>
          <div className="start-screen__feature">
            <span className="start-screen__feature-icon">🧠</span>
            <span className="start-screen__feature-text">AI-Powered Analysis</span>
          </div>
        </div>
        
        <button 
          className="start-screen__button"
          onPointerDown={handleStart}
        >
          <span className="start-screen__button-text">{buttonText}</span>
          <span className="start-screen__button-arrow">→</span>
        </button>
        
        <p className="start-screen__privacy">
          Your responses are analyzed locally and not stored
        </p>
      </div>
      
      {/* Decorative elements */}
      <div className="start-screen__decoration">
        <div className="start-screen__circle start-screen__circle--1" />
        <div className="start-screen__circle start-screen__circle--2" />
        <div className="start-screen__circle start-screen__circle--3" />
      </div>
    </div>
  );
};

export default StartScreen;
