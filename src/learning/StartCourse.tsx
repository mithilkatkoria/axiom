import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Play,
  RotateCcw,
} from "lucide-react";
import lessons from "./lessons.json";
import { useEngine, useStored } from "../studio/hooks";
const Editor = lazy(() =>
  import("../studio/Editor").then((module) => ({ default: module.Editor })),
);
function record<T>(value: Record<string, T>): Record<string, T> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}
export function StartCourse({
  onExplore,
}: {
  onExplore: (source: string) => void;
}) {
  const [activeId, setActiveId] = useStored(
    "axiom.course.lesson",
    lessons[0].id,
  );
  const [saved, setSaved] = useStored<Record<string, string>>(
    "axiom.course.source",
    {},
  );
  const [progress, setProgress] = useStored<Record<string, boolean>>(
    "axiom.course.progress",
    {},
  );
  const [attempted, setAttempted] = useState(false);
  const lesson = lessons.find((item) => item.id === activeId) ?? lessons[0];
  const index = lessons.indexOf(lesson);
  const edits = record(saved),
    completed = record(progress);
  const source =
    typeof edits[lesson.id] === "string" ? edits[lesson.id] : lesson.starter;
  const engine = useEngine(source);
  const { compilation, state, compiling } = engine;
  const diagnostics = [
    ...(compilation?.diagnostics ?? []),
    ...(state?.diagnostic ? [state.diagnostic] : []),
  ];
  const runnable =
    !!compilation?.program && compilation.source === source && !compiling;
  const passed =
    attempted &&
    state?.status === "completed" &&
    JSON.stringify(state.output) === JSON.stringify(lesson.expected);
  const count = lessons.filter((item) => completed[item.id] === true).length;
  useEffect(() => {
    if (passed && !completed[lesson.id])
      setProgress({ ...completed, [lesson.id]: true });
  }, [passed, completed, lesson.id, setProgress]);
  function change(next: string) {
    setAttempted(false);
    setSaved({ ...edits, [lesson.id]: next });
  }
  function run() {
    if (!runnable || state?.status === "running") return;
    setAttempted(true);
    engine.command("run");
  }
  function select(id: string) {
    setAttempted(false);
    setActiveId(id);
  }
  return (
    <main id="main" className="course-page">
      <header className="course-intro">
        <div>
          <p className="eyebrow">START HERE / NO EXPERIENCE NEEDED</p>
          <h1>
            Your first <em>Axiom program.</em>
          </h1>
          <p>
            Six small steps. Real code. A little more understanding each time.
          </p>
        </div>
        <div className="course-progress">
          <span>
            {count} of {lessons.length} lessons completed
          </span>
          <progress
            value={count}
            max={lessons.length}
            aria-label="Completed lessons"
          />
          <small>Progress stays in this browser.</small>
        </div>
      </header>
      <div className="course-layout">
        <nav className="course-steps" aria-label="Beginner lessons">
          {lessons.map((item, i) => (
            <button
              key={item.id}
              aria-current={item.id === lesson.id ? "step" : undefined}
              onClick={() => select(item.id)}
            >
              <span className="course-step-number">
                {completed[item.id] ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  String(i + 1).padStart(2, "0")
                )}
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.concept}</small>
              </span>
            </button>
          ))}
          <a href="/learn">
            Curious how compilers work? <ArrowUpRight size={13} />
          </a>
        </nav>
        <article className="course-lesson">
          <p className="eyebrow">
            LESSON {index + 1} / {lesson.concept.toUpperCase()}
          </p>
          <h2>{lesson.title}</h2>
          <p className="course-lead">{lesson.intro}</p>
          <p>{lesson.explanation}</p>
          <div className="course-challenge">
            <span className="micro">YOUR TURN</span>
            <h3>{lesson.challenge}</h3>
            <span className="micro muted">TARGET OUTPUT</span>
            <pre>{lesson.expected.join("\n")}</pre>
          </div>
          <details key={lesson.id + "-hint"}>
            <summary>A small hint</summary>
            <p>{lesson.hint}</p>
          </details>
          <details key={lesson.id + "-solution"}>
            <summary>Show a worked example</summary>
            <pre>{lesson.solution}</pre>
          </details>
          <p className="course-check-note">
            Checks compare your output with the target. Try explaining why your
            program works, too.
          </p>
        </article>
        <section className="course-workspace" aria-label="Lesson workspace">
          <div className="course-editor-bar">
            <span>lesson-{index + 1}.ax</span>
            <button
              className="icon-button"
              aria-label="Reset lesson code"
              onClick={() => {
                change(lesson.starter);
                if (compilation?.program) engine.command("reset");
              }}
            >
              <RotateCcw size={14} />
            </button>
            <button
              className="button primary"
              disabled={!runnable || state?.status === "running"}
              onClick={run}
            >
              <Play size={13} fill="currentColor" />{" "}
              {state?.status === "running" ? "Running…" : "Run and check"}
            </button>
          </div>
          <div className="course-editor">
            <Suspense
              fallback={<div className="empty-state">Loading your editor…</div>}
            >
              <Editor
                key={lesson.id}
                source={source}
                onChange={change}
                diagnostics={diagnostics}
                breakpoints={[]}
                onBreakpoint={() => {}}
                onRun={run}
              />
            </Suspense>
          </div>
          <div className="course-output">
            <div className="micro muted">
              YOUR OUTPUT{" "}
              <span>
                {compiling
                  ? "Checking…"
                  : state?.status === "completed"
                    ? "Completed"
                    : "Ready"}
              </span>
            </div>
            <pre aria-live="polite">
              {state?.output.length
                ? state.output.join("\n")
                : "Run your program to see what it says."}
            </pre>
          </div>
          {diagnostics.length > 0 && (
            <div className="course-feedback is-error" role="alert">
              <strong>Let’s fix one thing.</strong>
              <p>{diagnostics[0].message}</p>
              {diagnostics[0].note && <p>{diagnostics[0].note}</p>}
              <small>
                Line {diagnostics[0].span.line}, column{" "}
                {diagnostics[0].span.column}
              </small>
            </div>
          )}
          <div
            className={"course-feedback " + (passed ? "is-passed" : "")}
            role="status"
          >
            {passed ? (
              <>
                <strong>
                  <Check size={15} /> You’ve got it.
                </strong>
                <p>{lesson.takeaway}</p>
              </>
            ) : attempted && state?.status === "completed" ? (
              <>
                <strong>Your program runs. One more change to try.</strong>
                <p>
                  Compare your output with the target, then edit and run again.
                </p>
              </>
            ) : (
              <p>
                Your code runs in Axiom’s real compiler and virtual machine,
                locally in your browser.
              </p>
            )}
          </div>
          <button
            className="text-link course-inspect"
            onClick={() => onExplore(source)}
          >
            Inspect this program in the studio <ArrowUpRight size={14} />
          </button>
        </section>
      </div>
      <footer className="course-footer">
        <button
          className="text-link"
          disabled={index === 0}
          onClick={() => select(lessons[index - 1].id)}
        >
          <ArrowLeft size={15} /> Previous lesson
        </button>
        <span>
          {count === lessons.length
            ? "All six lessons complete. Keep exploring."
            : "Take your time. Every lesson is available."}
        </span>
        {index < lessons.length - 1 ? (
          <button
            className="button primary"
            onClick={() => select(lessons[index + 1].id)}
          >
            Next lesson <ArrowRight size={15} />
          </button>
        ) : (
          <button className="button primary" onClick={() => onExplore(source)}>
            Keep exploring <ArrowUpRight size={15} />
          </button>
        )}
      </footer>
    </main>
  );
}
