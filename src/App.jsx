import React, { useState, useEffect, useRef } from "react";
import { getBestOption, shuffle } from "./utils";
import { TypeAnimation } from "react-type-animation";
import questions from "./assets/data/questions.json";
import personalities from "./assets/data/personalities.json";
import backgroundVideo from "./assets/videos/redwoods.mp4";
import logo from "./assets/images/logo.png";

import "./index.scss";

function OptionButton({ runId, currentQuestionIndex, questionIndex, questionText, options, option, order, responses, addResponse, QUESTION_SPEED, ANSWER_SPEED, questionId }) {
  const [active, setActive] = useState(false);
  const timerRef = useRef(null);

  // timing math
  const questionDelay = QUESTION_SPEED * questionText.length + 500;
  const cumulativeDelay = options
    .slice(0, order)
    .reduce(
      (acc, prevOption) => acc + prevOption.text.length * ANSWER_SPEED,
      0
    );
  const interOptionDelay = order * 75;
  const startDelay = questionDelay + cumulativeDelay + interOptionDelay;

  // HARD RESET ONLY (restart / idle timeout)
  useEffect(() => {
    setActive(false);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [runId]);

  // Reveal when this question becomes active (never re-hide during run)
  useEffect(() => {
    if (currentQuestionIndex !== questionIndex) return;
    if (active) return;

    timerRef.current = setTimeout(() => {
      setActive(true);
    }, startDelay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentQuestionIndex, questionIndex, startDelay, active]);

  // If the question gets answered early, reveal immediately
  useEffect(() => {
    if (!responses[questionIndex]) return;

    // Question answered → show all options instantly
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setActive(true);
  }, [responses, questionIndex]);

  return (
    <button
      key={`${runId}-${questionId}-${option.id}`}
      data-index={questionIndex}
      data-id={option.id}
      data-order={order + 1}
      className={`questions-question-options-option ${active ? "" : "hidden"
        } ${responses[questionIndex]?.id === option.id ? "selected" : ""}`}
      onClick={addResponse}
    >
      <span className="questions-question-options-option-text">
        {option.text}
      </span>
    </button>
  );
}

const haptic = (pattern = 10) => {
  // pattern can be a number (ms) or an array (pattern)
  if (navigator?.vibrate) navigator.vibrate(pattern);
};


const App = () => {
  const [runId, setRunId] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [responses, setResponses] = useState([]);
  const [personality, setPersonality] = useState({});
  const [fullscreen, setFullscreen] = useState(false);

  const questionTimer = useRef();
  const questionsRef = useRef();
  const timeoutRef = useRef();

  const IDLE_DELAY = 45000;
  const QUESTION_SPEED = 50;
  const ANSWER_SPEED = 30;

  const handleFullscreenChange = () => {
    setFullscreen(document.fullscreenElement !== null);
  };

  const start = () => {
    setRunId((v) => v + 1);
    setCurrentQuestionIndex(0);
    setResponses([]);
    setPersonality({});

    questions.forEach((q) => {
      q.options = shuffle(q.options);
    });

    if (!fullscreen && location.hostname !== "localhost") {
      document.documentElement.webkitRequestFullScreen();
      setFullscreen(true);
    }
  };

  const restart = () => {
    setRunId((v) => v + 1);
    setCurrentQuestionIndex(-1);
    setResponses([]);
    setPersonality({});
  };

  const addResponse = (e) => {
    haptic(20)
    const startedAt = questionTimer.current ?? performance.now();
    const delay = Math.max(0, Math.round(performance.now() - startedAt));
    questionTimer.current = null;

    const answerId = e.target.getAttribute("data-id");
    const order = parseInt(e.target.getAttribute("data-order"), 10);
    const index = parseInt(e.target.getAttribute("data-index"), 10);

    setResponses((prev) => {
      const next = [...prev];
      next[index] = { id: answerId, order, delay };
      return next;
    });

    setCurrentQuestionIndex((prev) => prev + 1);
  };

  const idleTimeout = () => {
    setRunId((v) => v + 1);
    setCurrentQuestionIndex(-1);
    setPersonality({});
    setResponses([]);
  };

  const resetIdleTimeout = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(idleTimeout, IDLE_DELAY);
  };

  useEffect(() => {
    questionTimer.current = performance.now();

    if (responses.length === questions.length) {
      const bestOption = getBestOption(responses);
      const matchedPersonality = personalities.find(
        (p) => p.id === bestOption.id
      );
      setPersonality(matchedPersonality);
    }
  }, [responses.length]);

  useEffect(() => {
    if (currentQuestionIndex >= 0) {
      const questionEl = questionsRef.current?.children[currentQuestionIndex];
      setTimeout(() => {
        questionEl?.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 500);
    }
  }, [currentQuestionIndex]);

  useEffect(() => {
    addEventListener("click", resetIdleTimeout);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      removeEventListener("click", resetIdleTimeout);
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="app">
      <div className={`background ${currentQuestionIndex >= 0 ? "muted" : ""}`}>
        <video src={backgroundVideo} muted loop autoPlay playsInline />
      </div>

      <div className="questions" ref={questionsRef}>
        {questions.map((question, questionIndex) => (
          <div
            key={`${runId}-${question.id}`}
            className={
              `questions-question ` +
              `${questionIndex > currentQuestionIndex ? "hidden" : ""} ` +
              `${questionIndex >= currentQuestionIndex ? "" : "answered"}`
            }
          >
            <h1 className="questions-question-text">
              {currentQuestionIndex === questionIndex && (
                <TypeAnimation
                  sequence={[question.text]}
                  speed={QUESTION_SPEED}
                />
              )}
              {currentQuestionIndex > questionIndex && (
                <span>{question.text}</span>
              )}
            </h1>

            <div className="questions-question-options">
              {question.options.map((option, order) => (
                <OptionButton
                  key={`${runId}-${question.id}-${option.id}`}
                  runId={runId}
                  currentQuestionIndex={currentQuestionIndex}
                  questionIndex={questionIndex}
                  questionText={question.text}
                  options={question.options}
                  option={option}
                  order={order}
                  responses={responses}
                  addResponse={addResponse}
                  QUESTION_SPEED={QUESTION_SPEED}
                  ANSWER_SPEED={ANSWER_SPEED}
                  questionId={question.id}
                />
              ))}
            </div>
          </div>
        ))}

        <div className={`questions-results ${responses.length === questions.length ? "" : "hidden"}`}>
          <h2 className="questions-results-title">
            Based on your answers you've matched with:
          </h2>
          <h1 className="questions-results-personality">
            {personality?.name}
          </h1>
          <h2 className="questions-results-description">
            {personality?.description}
          </h2>
          <h2 className="questions-results-drink">
            <span>Ask your bartender for the </span>
            <span className="bold">{personality?.drink}</span>
            <span>🍹</span>
          </h2>
          <button className="questions-results-restart" onClick={restart}>
            Restart
          </button>
        </div>
      </div>

      <button
        className={`start ${currentQuestionIndex < 0 ? "" : "hidden"}`}
        onClick={start}
      >
        Begin
      </button>

      <img className="logo" src={logo} />
    </div>
  );
};

export default App;
