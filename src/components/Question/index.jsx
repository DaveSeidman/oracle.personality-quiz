import React, { useEffect, useMemo, useRef, useState } from "react";
import { TypeAnimation } from "react-type-animation";
import "./index.scss";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const haptic = (pattern = 10) => {
  if (navigator?.vibrate) navigator.vibrate(pattern);
};

function SortableRow({ id, text, index, typing, delayMs, ANSWER_SPEED }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`question-option ${isDragging ? "dragging" : ""}`}
    >
      <div className="question-option-rank">{index + 1}</div>

      <div className="question-option-text">
        {typing ? (
          <TypeAnimation
            sequence={[delayMs, text]}
            speed={ANSWER_SPEED}
            cursor={false}
            repeat={0}
          />
        ) : (
          text
        )}
      </div>

      <button
        type="button"
        className="question-option-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ≡
      </button>
    </div>
  );
}

function RankedChoiceSortable({
  runId,
  active,
  questionIndex,
  questionText,
  options,
  onSubmit,
  QUESTION_SPEED,
}) {
  const [order, setOrder] = useState(() => options.map((o) => o.id));

  const startedAtRef = useRef(null);
  const firstInteractAtRef = useRef(null);
  const swapsRef = useRef(0);
  const editsRef = useRef(0);

  // typing control
  const ANSWER_SPEED = 30; // tweak to taste
  const [typing, setTyping] = useState(false);

  // Reset on hard reset
  useEffect(() => {
    setOrder(options.map((o) => o.id));
    startedAtRef.current = null;
    firstInteractAtRef.current = null;
    swapsRef.current = 0;
    editsRef.current = 0;
    setTyping(false);
  }, [runId, options]);

  // Start timing + typing when question becomes active
  useEffect(() => {
    if (!active) return;
    startedAtRef.current = performance.now();
    setTyping(true);
  }, [active]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // prevents accidental drags while scrolling/tapping
    })
  );

  const idToOption = useMemo(() => {
    const m = new Map();
    options.forEach((o) => m.set(o.id, o));
    return m;
  }, [options]);

  const onDragStart = () => {
    if (!active) return;

    // freeze any in-progress typing so the list stays stable while dragging
    setTyping(false);

    haptic(8);
    if (!startedAtRef.current) startedAtRef.current = performance.now();
    if (!firstInteractAtRef.current) firstInteractAtRef.current = performance.now();
  };

  const onDragEnd = (event) => {
    if (!active) return;

    const { active: a, over } = event;
    if (!over) return;

    const activeId = a.id;
    const overId = over.id;

    if (activeId === overId) return;

    setOrder((prev) => {
      const oldIndex = prev.indexOf(activeId);
      const newIndex = prev.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1) return prev;

      swapsRef.current += 1;
      editsRef.current += 1;
      haptic(12);

      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const submit = () => {
    if (!active) return;

    haptic(20);

    const startedAt = startedAtRef.current ?? performance.now();
    const now = performance.now();

    const durationMs = Math.max(0, Math.round(now - startedAt));
    const timeToFirstPickMs = firstInteractAtRef.current
      ? Math.max(0, Math.round(firstInteractAtRef.current - startedAt))
      : 0;

    onSubmit(questionIndex, {
      type: "ordering",
      order,
      durationMs,
      timeToFirstPickMs,
      orderingSwaps: swapsRef.current,
      edits: editsRef.current,
    });
  };

  const orderedOptions = order.map((id) => idToOption.get(id)).filter(Boolean);

  // Staggered option reveal delay:
  // Wait for the question to type + a small buffer, then reveal each row.
  const questionDelayMs = QUESTION_SPEED * (questionText?.length ?? 0) + 350;

  return (
    <div className={`question-options ${active ? "" : "hidden"}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div className="question-sortable">
            {orderedOptions.map((opt, i) => (
              <SortableRow
                key={opt.id}
                id={opt.id}
                text={opt.text}
                index={i}
                typing={active && typing}
                delayMs={questionDelayMs + i * 180}
                ANSWER_SPEED={ANSWER_SPEED}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button type="button" className="question-continue" onClick={submit}>
        Continue
      </button>
    </div>
  );
}

export default function Question({
  runId,
  question,
  questionIndex,
  currentQuestionIndex,
  responses,
  QUESTION_SPEED,
  onSubmit,
}) {
  const isFuture = questionIndex > currentQuestionIndex;
  const isActive = questionIndex === currentQuestionIndex;
  const isAnswered = questionIndex < currentQuestionIndex;

  return (
    <div className={`question ${isFuture ? "hidden" : ""} ${isAnswered ? "answered" : ""}`}>
      <h1 className="question-text">
        {isActive && (
          <TypeAnimation sequence={[question.text]} speed={QUESTION_SPEED} />
        )}
        {isAnswered && <span>{question.text}</span>}
      </h1>

      <RankedChoiceSortable
        runId={runId}
        active={isActive}
        questionIndex={questionIndex}
        questionText={question.text}
        options={question.options}
        onSubmit={onSubmit}
        QUESTION_SPEED={QUESTION_SPEED}
      />

      {isAnswered && responses?.[questionIndex]?.type === "ordering" && (
        <div className="question-ranking-summary">
          {responses[questionIndex].order.map((id, i) => {
            const opt = question.options.find((o) => o.id === id);
            return (
              <div key={id} className="question-ranking-summary-item">
                {i + 1}. {opt?.text}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
