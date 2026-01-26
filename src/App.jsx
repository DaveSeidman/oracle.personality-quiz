import React, { useEffect, useMemo, useRef, useState } from "react";
import { shuffle } from "./utils";
import Question from "./components/Question";
import questionsData from "./assets/data/questions.json";
import personalities from "./assets/data/personalities.json";
import backgroundVideo from "./assets/videos/redwoods.mp4";
import logo from "./assets/images/logo.png";

import "./index.scss";

const analyzeWithBackend = async (payload, timeoutMs = 2500) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const base = import.meta.env.VITE_API_BASE || "";
  const url = `${base}/api/quiz/analyze`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("bad response");
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
};

const getBestFromRankings = (responses) => {
  // Weighted Borda count: 1st gets 4, 2nd gets 3, ...
  const score = new Map();

  for (const r of responses) {
    if (!r || r.type !== "ordering" || !Array.isArray(r.order)) continue;
    const n = r.order.length;

    r.order.forEach((id, i) => {
      const w = n - i;
      score.set(id, (score.get(id) ?? 0) + w);
    });
  }

  let bestId = null;
  let bestScore = -Infinity;

  for (const [id, s] of score.entries()) {
    if (s > bestScore) {
      bestScore = s;
      bestId = id;
    }
  }

  return { id: bestId ?? "A" };
};

const App = () => {
  const [runId, setRunId] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [responses, setResponses] = useState([]);
  const [personality, setPersonality] = useState({});
  const [fullscreen, setFullscreen] = useState(false);

  const [aiMode, setAiMode] = useState(""); // "ai" | "fallback" | "deterministic" | "timeout" | ""
  const [aiNarrative, setAiNarrative] = useState("");
  const [aiCallouts, setAiCallouts] = useState([]);

  const questionsRef = useRef(null);
  const timeoutRef = useRef(null);

  const IDLE_DELAY = 45000;
  const QUESTION_SPEED = 50;

  // Keep a shuffled, local copy so we don't mutate imported JSON
  const [quizQuestions, setQuizQuestions] = useState([]);

  const handleFullscreenChange = () => {
    setFullscreen(document.fullscreenElement !== null);
  };

  const resetRunState = () => {
    setResponses([]);
    setPersonality({});
    setAiMode("");
    setAiNarrative("");
    setAiCallouts([]);
  };

  const start = () => {
    setRunId((v) => v + 1);
    setCurrentQuestionIndex(0);
    resetRunState();

    // Clone + shuffle options per question
    const cloned = questionsData.map((q) => ({
      ...q,
      // ensure the new questions.json type field doesn't break anything
      type: q.type || "ranked",
      options: shuffle([...q.options]),
    }));

    setQuizQuestions(cloned);

    if (!fullscreen && location.hostname !== "localhost") {
      // Samsung browser uses webkitRequestFullScreen
      document.documentElement.webkitRequestFullScreen?.();
      setFullscreen(true);
    }
  };

  const restart = () => {
    setRunId((v) => v + 1);
    setCurrentQuestionIndex(-1);
    resetRunState();
    setQuizQuestions([]);
  };

  const idleTimeout = () => {
    setRunId((v) => v + 1);
    setCurrentQuestionIndex(-1);
    resetRunState();
    setQuizQuestions([]);
  };

  const resetIdleTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(idleTimeout, IDLE_DELAY);
  };

  const submitQuestion = (index, response) => {
    setResponses((prev) => {
      const next = [...prev];
      next[index] = response; // { type:"ordering", order:[...], durationMs, timeToFirstPickMs, edits }
      return next;
    });

    setCurrentQuestionIndex((prev) => prev + 1);
  };

  // Scroll the active question into view
  useEffect(() => {
    if (currentQuestionIndex >= 0) {
      const questionEl = questionsRef.current?.children?.[currentQuestionIndex];
      setTimeout(() => {
        questionEl?.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 300);
    }
  }, [currentQuestionIndex]);

  // Idle timeout + fullscreen listeners
  useEffect(() => {
    addEventListener("click", resetIdleTimeout);
    addEventListener("pointerdown", resetIdleTimeout);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      removeEventListener("click", resetIdleTimeout);
      removeEventListener("pointerdown", resetIdleTimeout);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // When quiz completes: local fallback immediately, then backend upgrade
  useEffect(() => {
    if (!quizQuestions.length) return;
    if (responses.length !== quizQuestions.length) return;

    // 1) Local fallback (instant)
    const bestOption = getBestFromRankings(responses);
    const matched = personalities.find((p) => p.id === bestOption.id);
    if (matched) setPersonality(matched);

    // 2) Backend payload (one call at end)
    const payload = {
      runId: String(runId),
      quizVersion: "v1",
      clientFallback: { personalityId: bestOption.id },
      personalities: personalities.map((p) => ({ id: p.id })),
      questions: responses.map((r, i) => ({
        id: quizQuestions[i].id,
        type: r.type, // "ordering"
        order: r.order,
        durationMs: r.durationMs,
        timeToFirstPickMs: r.timeToFirstPickMs,
        edits: r.edits,
      })),
    };

    analyzeWithBackend(payload, 2500)
      .then((result) => {
        if (!result?.ok) return;

        setAiMode(result.mode || "");

        if (result.narrative) setAiNarrative(result.narrative);
        if (Array.isArray(result.callouts)) setAiCallouts(result.callouts);

        if (result.personalityId) {
          const p = personalities.find((x) => x.id === result.personalityId);
          if (p) setPersonality(p);
        }
      })
      .catch(() => {
        setAiMode("timeout");
      });
  }, [responses.length, runId, quizQuestions.length]);

  const showResults =
    quizQuestions.length > 0 && responses.length === quizQuestions.length;

  return (
    <div className="app">
      <div className={`background ${currentQuestionIndex >= 0 ? "muted" : ""}`}>
        <video src={backgroundVideo} muted loop autoPlay playsInline />
      </div>

      <div className="questions" ref={questionsRef}>
        {quizQuestions.map((question, questionIndex) => (
          <Question
            key={`${runId}-${question.id}`}
            runId={runId}
            question={question}
            questionIndex={questionIndex}
            currentQuestionIndex={currentQuestionIndex}
            responses={responses}
            QUESTION_SPEED={QUESTION_SPEED}
            onSubmit={submitQuestion}
          />
        ))}

        <div className={`questions-results ${showResults ? "" : "hidden"}`}>
          <h2 className="questions-results-title">
            Based on your answers you've matched with:
          </h2>

          <h1 className="questions-results-personality">{personality?.name}</h1>

          <h2 className="questions-results-description">
            {personality?.description}
          </h2>

          <h2 className="questions-results-drink">
            <span>Ask your bartender for a </span>
            <span className="underline">{personality?.drink}</span>
            <span>🍹</span>
          </h2>

          {aiMode && (
            <div className="questions-results-mode">
              {/* keep subtle */}
              {aiMode === "ai" ? "AI enhanced" : aiMode}
            </div>
          )}

          {aiNarrative && <h2 className="questions-results-ai">{aiNarrative}</h2>}

          {aiCallouts?.length > 0 && (
            <ul className="questions-results-callouts">
              {aiCallouts.slice(0, 4).map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}

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
