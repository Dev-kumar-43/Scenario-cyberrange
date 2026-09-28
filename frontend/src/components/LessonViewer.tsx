'use client';

import React, { useState } from 'react';
import ProgressRing from './ProgressRing';

export interface LessonModule {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  objective: string;
  explanation: string;
  codeSnippet?: string;
  question: string;
  options: string[];
  answerIndex: number;
  labId?: string | null;
  labName?: string | null;
  protocol?: string | null;
}

interface LessonViewerProps {
  module: LessonModule;
  onLaunchLab?: (labId: string) => void;
  onFlagSubmit?: (flag: string) => Promise<boolean>;
  onClose?: () => void;
}

const LESSON_TITLES = [
  'Meet the concept',
  'Read the evidence',
  'Understand the risk',
  'Protect the boundary',
  'Knowledge check',
  'Hands-on checkpoint'
];

export default function LessonViewer({
  module,
  onLaunchLab,
  onFlagSubmit,
  onClose
}: LessonViewerProps) {
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [completedLessons, setCompletedLessons] = useState<number[]>([0]);
  const [diagramStep, setDiagramStep] = useState(0);

  // Knowledge check state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(false);

  // Mini challenge (True/False) state
  const [miniAnswer, setMiniAnswer] = useState<boolean | null>(null);
  const [miniCorrect, setMiniCorrect] = useState<boolean | null>(null);

  // Lab flag submission state
  const [flagInput, setFlagInput] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagSuccess, setFlagSuccess] = useState(false);
  const [flagError, setFlagError] = useState('');

  const isCompleted = (index: number) => completedLessons.includes(index);
  const progressPercent = Math.round((completedLessons.length / 6) * 100);

  const handleNextLesson = () => {
    if (!completedLessons.includes(activeLessonIndex)) {
      setCompletedLessons(prev => [...prev, activeLessonIndex]);
    }
    if (activeLessonIndex < 5) {
      setActiveLessonIndex(prev => prev + 1);
    }
  };

  const handleCheckQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOption === null) return;

    setQuizSubmitted(true);
    const correct = selectedOption === module.answerIndex;
    setQuizCorrect(correct);

    if (correct && !completedLessons.includes(4)) {
      setCompletedLessons(prev => [...prev, 4]);
    }
  };

  const handleMiniChallenge = (val: boolean) => {
    setMiniAnswer(val);
    // True/False: False is correct for "A single security control eliminates all application risk"
    const correct = val === false;
    setMiniCorrect(correct);
  };

  const handleFlagSubmitInternal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagInput.trim()) return;

    setFlagSubmitting(true);
    setFlagError('');

    try {
      if (onFlagSubmit) {
        const success = await onFlagSubmit(flagInput.trim());
        if (success) {
          setFlagSuccess(true);
          if (!completedLessons.includes(5)) {
            setCompletedLessons(prev => [...prev, 5]);
          }
        } else {
          setFlagError('Invalid flag or checkpoint verification code. Review the lab instructions.');
        }
      } else {
        // Fallback demo check
        if (flagInput.trim().toUpperCase().includes('FLAG') || flagInput.trim().length > 6) {
          setFlagSuccess(true);
          if (!completedLessons.includes(5)) {
            setCompletedLessons(prev => [...prev, 5]);
          }
        } else {
          setFlagError('Invalid flag format. Flags typically follow the format CR{...}.');
        }
      }
    } catch {
      setFlagError('Network error submitting flag.');
    } finally {
      setFlagSubmitting(false);
    }
  };

  const diagramExplanations = [
    '1. Untrusted Input: The application receives parameters from an external request. Treat all incoming values as untrusted by default.',
    '2. Context Processing: The input is processed by database drivers or internal services. Parameterized boundaries isolate data from execution commands.',
    '3. Safe Outcome: The operation executes predictably without syntax injection or unexpected privilege elevation.'
  ];

  return (
    <div
      style={{
        background: 'var(--bg-card, #F9FAFC)',
        border: '1px solid var(--line)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-card)',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--line)', paddingBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span className="pill blue">{module.category || 'Security'}</span>
            <span className="pill">{module.difficulty || 'Beginner'}</span>
            <span className="pill">⏱️ ~{module.durationMinutes || 30} mins</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)' }}>
            {module.title}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--muted)', marginTop: '4px' }}>
            {module.objective}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <ProgressRing percentage={progressPercent} size={84} strokeWidth={6} />
          {onClose && (
            <button
              onClick={onClose}
              className="btn secondary small"
              title="Close lesson view"
            >
              Back to Overview
            </button>
          )}
        </div>
      </div>

      {/* Lesson Step Navigation Strip */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '6px',
          borderBottom: '1px solid var(--line)'
        }}
      >
        {LESSON_TITLES.map((title, idx) => {
          const active = activeLessonIndex === idx;
          const done = isCompleted(idx);

          return (
            <button
              key={idx}
              onClick={() => setActiveLessonIndex(idx)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: active ? '1px solid var(--blue)' : '1px solid var(--line)',
                background: active ? 'var(--sky)' : 'var(--bg-card, #F9FAFC)',
                color: active ? 'var(--blue)' : 'var(--muted)',
                fontWeight: active ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <span className={`check-circle ${done ? 'done' : active ? 'current' : ''}`}>
                {done ? '✓' : idx + 1}
              </span>
              <span>{title}</span>
            </button>
          );
        })}
      </div>

      {/* Lesson Body Content by Step */}
      <div style={{ minHeight: '280px' }}>
        {activeLessonIndex === 0 && (
          <div>
            <div className="eyebrow">STEP 1 • CORE CONCEPT</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem' }}>
              Why This Security Concept Matters
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-body)', lineHeight: 1.6, marginBottom: '1rem' }}>
              {module.explanation}
            </p>
            <div className="callout">
              <strong>Key Takeaway:</strong>
              <p>{module.objective}</p>
            </div>
          </div>
        )}

        {activeLessonIndex === 1 && (
          <div>
            <div className="eyebrow">STEP 2 • EVIDENCE & TELEMETRY</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem' }}>
              Reading The Indicators & Artifacts
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-body)', lineHeight: 1.6, marginBottom: '1rem' }}>
              In real-world offensive operations and defensive investigations, decisions must be backed by repeatable evidence rather than assumptions.
            </p>
            <div
              style={{
                background: 'var(--bg, #EEF2F7)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '14px 16px',
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                color: '#1e293b'
              }}
            >
              <div>[Telemetry Log] Component: {module.category || 'AppGateway'}</div>
              <div>[Observation] Input validation boundary tested with anomalous request shapes.</div>
              <div>[Status] Protocol inspection confirmed matching objective parameters.</div>
            </div>
          </div>
        )}

        {activeLessonIndex === 2 && (
          <div>
            <div className="eyebrow">STEP 3 • RISK EVALUATION</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem' }}>
              Code Example & Boundary Architecture
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-body)', lineHeight: 1.6 }}>
              Review the architectural pattern below. Notice how data boundaries are enforced through isolated handling:
            </p>
            <pre className="code">
              <code>
{module.codeSnippet || `// Enforce boundary parameters
const secureRequest = async (payload) => {
  const sanitizedInput = sanitizeContext(payload.input);
  return await executeSafeOperation(sanitizedInput);
};`}
              </code>
            </pre>
          </div>
        )}

        {activeLessonIndex === 3 && (
          <div>
            <div className="eyebrow">STEP 4 • INTERACTIVE PROCESS DIAGRAM</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem' }}>
              Trace The Request Lifecycle
            </h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              Click through the execution stages to inspect how security boundaries protect the system:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
              {['1. Input', '2. Process', '3. Outcome'].map((label, idx) => (
                <button
                  key={idx}
                  onClick={() => setDiagramStep(idx)}
                  style={{
                    padding: '14px 10px',
                    borderRadius: '10px',
                    border: diagramStep === idx ? '2px solid var(--blue)' : '1px solid var(--line)',
                    background: diagramStep === idx ? 'var(--sky)' : 'var(--bg-card, #F9FAFC)',
                    color: diagramStep === idx ? 'var(--blue)' : 'var(--ink)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              style={{
                background: 'var(--bg, #EEF2F7)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '14px 18px',
                fontSize: '14px',
                color: 'var(--ink)',
                minHeight: '60px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {diagramExplanations[diagramStep]}
            </div>
          </div>
        )}

        {activeLessonIndex === 4 && (
          <div>
            <div className="eyebrow">STEP 5 • KNOWLEDGE CHECK (+10 XP)</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '1rem' }}>
              Check Your Understanding
            </h3>

            <form onSubmit={handleCheckQuiz} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)', marginBottom: '4px' }}>
                {module.question}
              </div>

              {module.options.map((opt, i) => (
                <label
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: selectedOption === i ? '1px solid var(--blue)' : '1px solid var(--line)',
                    background: selectedOption === i ? 'var(--sky)' : 'var(--bg-card, #F9FAFC)',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  <input
                    type="radio"
                    name="quiz-option"
                    checked={selectedOption === i}
                    onChange={() => {
                      setSelectedOption(i);
                      setQuizSubmitted(false);
                    }}
                  />
                  <span>{opt}</span>
                </label>
              ))}

              <div style={{ marginTop: '8px' }}>
                <button type="submit" className="btn small" disabled={selectedOption === null}>
                  Verify Answer
                </button>
              </div>

              {quizSubmitted && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    marginTop: '8px',
                    background: quizCorrect ? 'var(--green-bg)' : 'var(--red-bg)',
                    color: quizCorrect ? 'var(--green)' : 'var(--red)',
                    border: `1px solid ${quizCorrect ? '#bbf7d0' : '#fecdd3'}`
                  }}
                >
                  {quizCorrect ? (
                    <>✓ Correct! +10 XP awarded. You have mastered this concept checkpoint.</>
                  ) : (
                    <>Not quite. Review the explanation in Step 1 and try again.</>
                  )}
                </div>
              )}
            </form>

            {/* Mini Challenge (True/False) */}
            <div style={{ background: 'var(--bg, #EEF2F7)', border: '1px solid var(--line)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--amber)', marginBottom: '4px' }}>
                MINI CHALLENGE • REFLECTION
              </div>
              <p style={{ fontSize: '14px', color: 'var(--ink)', marginBottom: '10px', fontWeight: 600 }}>
                &quot;Implementing input validation means authorization and role checks are no longer needed.&quot;
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleMiniChallenge(true)}
                  className={`btn small ${miniAnswer === true ? '' : 'secondary'}`}
                >
                  True
                </button>
                <button
                  type="button"
                  onClick={() => handleMiniChallenge(false)}
                  className={`btn small ${miniAnswer === false ? '' : 'secondary'}`}
                >
                  False
                </button>
              </div>

              {miniCorrect !== null && (
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: miniCorrect ? 'var(--green)' : 'var(--red)'
                  }}
                >
                  {miniCorrect
                    ? '✓ Correct! Defense-in-depth requires both input validation and authorization.'
                    : 'Not quite. Validation and authorization are independent layers of defense.'}
                </div>
              )}
            </div>
          </div>
        )}

        {activeLessonIndex === 5 && (
          <div>
            <div className="eyebrow">STEP 6 • HANDS-ON PRACTICE & CHECKPOINT</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', marginBottom: '0.75rem' }}>
              Apply Knowledge in a Live Cloud Sandbox
            </h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-body)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              Spin up your dedicated Kubernetes sandbox to execute the techniques covered in this module, explore the environment, and capture the flag.
            </p>

            {/* Lab Launch CTA Card */}
            {module.labId && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%)',
                  border: '1px solid #86efac',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  marginBottom: '1.5rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#15803d', letterSpacing: '0.05em' }}>
                    ASSOCIATED RANGE SANDBOX
                  </div>
                  <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#14532d', margin: '4px 0' }}>
                    {module.labName || 'Target Sandbox'}
                  </h4>
                  <span style={{ fontSize: '12px', color: '#15803d' }}>
                    Protocol: {module.protocol === 'VNC' ? '🖥️ Kali Linux Desktop GUI' : '💻 Terminal Shell'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => module.labId && onLaunchLab && onLaunchLab(module.labId)}
                  className="btn"
                  style={{ background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)' }}
                >
                  🚀 Spin Up Lab Sandbox
                </button>
              </div>
            )}

            {/* Flag / Objective Submission Form */}
            <form onSubmit={handleFlagSubmitInternal} style={{ background: 'var(--bg, #EEF2F7)', border: '1px solid var(--line)', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--blue)', marginBottom: '6px' }}>
                SUBMIT CHECKPOINT FLAG
              </div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '10px' }}>
                Enter the cryptographic verification flag discovered inside the target environment:
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={flagInput}
                  onChange={e => setFlagInput(e.target.value)}
                  placeholder="e.g. CR{sql_boundary_verified_2026}"
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
                <button type="submit" className="btn" disabled={flagSubmitting || !flagInput.trim()}>
                  {flagSubmitting ? 'Verifying...' : 'Submit Flag 🚩'}
                </button>
              </div>

              {flagSuccess && (
                <div style={{ marginTop: '10px', color: 'var(--green)', fontWeight: 700, fontSize: '13px' }}>
                  ✓ Flag Verified! Congratulations, this module checkpoint is complete!
                </div>
              )}
              {flagError && (
                <div style={{ marginTop: '10px', color: 'var(--red)', fontWeight: 600, fontSize: '13px' }}>
                  {flagError}
                </div>
              )}
            </form>
          </div>
        )}
      </div>

      {/* Bottom Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: '1rem', marginTop: 'auto' }}>
        <button
          onClick={() => setActiveLessonIndex(prev => Math.max(0, prev - 1))}
          className="btn secondary small"
          disabled={activeLessonIndex === 0}
        >
          ← Previous
        </button>

        {activeLessonIndex < 5 ? (
          <button onClick={handleNextLesson} className="btn small">
            Continue to Step {activeLessonIndex + 2} →
          </button>
        ) : (
          <button
            onClick={() => {
              if (!completedLessons.includes(5)) {
                setCompletedLessons(prev => [...prev, 5]);
              }
              if (onClose) onClose();
            }}
            className="btn small"
          >
            Finish Module ✓
          </button>
        )}
      </div>
    </div>
  );
}
