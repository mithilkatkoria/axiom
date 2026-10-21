import type { EngineIdentity } from "./language/runtime";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Command,
  Copy,
  FileCode2,
  FlaskConical,
  GitBranch,
  Github,
  Layers,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Search,
  Settings2,
  SkipForward,
  Square,
  StepForward,
  Sun,
  Terminal as TerminalIcon,
  X,
} from "lucide-react";
import { articles } from "./content";
import { GITHUB_URL } from "./project";
import { benchmarks, type Measurement } from "./benchmarks";
import { examples, starter } from "./examples";
import { type Diagnostic, type Span, type StepMode } from "./language";
const Editor = lazy(() =>
  import("./studio/Editor").then((module) => ({ default: module.Editor })),
);
import {
  Inspector,
  inspectorTabs,
  type InspectorTab,
} from "./studio/Inspector";
import { useEngine, useStored } from "./studio/hooks";
import "./styles.css";
function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? "small" : ""}`}>
      <svg
        width="27"
        height="29"
        viewBox="0 0 27 29"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M13.5 1L26 27H19.8L13.5 13L7.2 27H1L13.5 1Z"
          fill="currentColor"
        />
        <path d="M9 22H18" stroke="currentColor" strokeWidth="3" />
      </svg>
      <span>
        axiom<span className="brand-period">.</span>
      </span>
    </span>
  );
}
const statusLabels: Record<string, string> = {
  ready: "Ready",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  errored: "Runtime error",
  terminated: "Terminated",
};
function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true),
    [path, setPath] = useState(location.pathname.replace(/\/+$/, "") || "/"),
    [source, setSource] = useStored("axiom.source", starter.source),
    [theme, setTheme] = useStored<"dark" | "light">("axiom.theme", "dark"),
    [exampleId, setExampleId] = useStored("axiom.example", starter.id),
    [tab, setTab] = useState<InspectorTab>("AST"),
    [selected, setSelected] = useState<Span>(),
    [breakpoints, setBreakpoints] = useState<number[]>([]),
    [panelSize, setPanelSize] = useStored("axiom.split", 49),
    [terminalHeight, setTerminalHeight] = useStored(
      "axiom.terminalHeight",
      210,
    ),
    [terminalTab, setTerminalTab] = useState<"Output" | "Problems">("Output"),
    [showIntro, setShowIntro] = useStored("axiom.intro", true),
    [mobileTab, setMobileTab] = useState<"editor" | "inspector">("editor"),
    [copied, setCopied] = useState(false),
    [paletteOpen, setPaletteOpen] = useState(false),
    [commandQuery, setCommandQuery] = useState(""),
    [helpOpen, setHelpOpen] = useState(false),
    [terminalCollapsed, setTerminalCollapsed] = useState(false);
  const engine = useEngine(
    typeof source === "string" ? source : starter.source,
  );
  const { compilation, state, compiling } = engine;
  const diagnostics: Diagnostic[] = [
    ...(compilation?.diagnostics ?? []),
    ...(state?.diagnostic ? [state.diagnostic] : []),
  ];
  const currentExample = examples.find((e) => e.id === exampleId),
    valid = !!compilation?.program && !compiling,
    status = compiling
      ? "Compiling"
      : compilation?.diagnostics.length
        ? "Compilation failed"
        : statusLabels[state?.status ?? "ready"];
  const dialog = useRef<HTMLDialogElement>(null),
    help = useRef<HTMLDialogElement>(null),
    workspace = useRef<HTMLDivElement>(null);
  const navigate = (next: string) => {
    history.pushState({}, "", next);
    setPath(next.split("?")[0]);
    window.scrollTo(0, 0);
    setPaletteOpen(false);
  };
  const link = (href: string, label: React.ReactNode, className = "") => (
    <a
      key={href}
      href={href}
      className={className}
      onClick={(e) => {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          navigate(href);
        }
      }}
    >
      {label}
    </a>
  );
  const updateSource = (next: string) => {
    if (next !== source) {
      setSource(next);
      setBreakpoints([]);
      setSelected(undefined);
    }
  };
  const loadExample = (id: string) => {
    const e = examples.find((e) => e.id === id);
    if (e) {
      setSource(e.source);
      setExampleId(id);
      setBreakpoints([]);
      setSelected(undefined);
      setTerminalTab(e.error ? "Problems" : "Output");
      setPaletteOpen(false);
    }
  };
  const run = () => {
    if (valid && state?.status !== "running") {
      if (state?.status === "terminated") {
        engine.command("reset");
        return;
      }
      engine.command("run", breakpoints);
      setTerminalTab("Output");
    }
  };
  const step = (mode: StepMode) => {
    if (valid && state?.status !== "running") {
      engine.command("step", breakpoints, mode);
      setTab("Runtime");
    }
  };
  const toggleBreakpoint = (line: number) =>
    setBreakpoints((b) =>
      b.includes(line) ? b.filter((l) => l !== line) : [...b, line],
    );
  useEffect(() => {
    const listener = () =>
      setPath(location.pathname.replace(/\/+$/, "") || "/");
    window.addEventListener("popstate", listener);
    const code =
      new URLSearchParams(location.hash.slice(1)).get("code") ??
      new URLSearchParams(location.search).get("code");
    if (code !== null && code.length <= 10_000) {
      setSource(code);
      setExampleId("shared");
      history.replaceState({}, "", location.pathname);
    }
    return () => window.removeEventListener("popstate", listener);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme =
      theme === "light" ? "light" : "dark";
  }, [theme]);
  useEffect(() => {
    document.title =
      path === "/studio"
        ? "Studio | Axiom"
        : path === "/"
          ? "Axiom | The language, in motion."
          : `${articles.find((a) => a.path === path)?.title ?? "Experiments"} | Axiom`;
  }, [path]);
  useEffect(() => {
    if (paletteOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [paletteOpen]);
  useEffect(() => {
    if (helpOpen) help.current?.showModal();
    else help.current?.close();
  }, [helpOpen]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "Enter" &&
        !e.defaultPrevented
      ) {
        e.preventDefault();
        run();
      }
      if (e.key === "F10" && path === "/studio") {
        e.preventDefault();
        step("over");
      }
      if (e.key === "F11" && path === "/studio") {
        e.preventDefault();
        step(e.shiftKey ? "out" : "into");
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  async function share() {
    try {
      if (source.length > 6000) {
        setHelpOpen(true);
        return;
      }
      await navigator.clipboard.writeText(
        `${location.origin}/studio#code=${encodeURIComponent(source)}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setHelpOpen(true);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([source], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentExample?.id ?? "program"}.ax`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const commandActions = [
    { title: "Run program", hint: "Ctrl Enter", action: run },
    {
      title: "Reset execution",
      hint: "Clean VM state",
      action: () => engine.command("reset"),
    },
    {
      title: "Toggle theme",
      hint: theme,
      action: () => setTheme(theme === "dark" ? "light" : "dark"),
    },
    {
      title: "Open studio",
      hint: "/studio",
      action: () => navigate("/studio"),
    },
    {
      title: "Keyboard shortcuts",
      hint: "Help",
      action: () => setHelpOpen(true),
    },
    ...inspectorTabs.map((t) => ({
      title: `Inspect ${t}`,
      hint: "Compiler stage",
      action: () => {
        setTab(t);
        navigate("/studio");
      },
    })),
    ...examples.map((e) => ({
      title: `Load ${e.title}`,
      hint: e.category,
      action: () => {
        loadExample(e.id);
        navigate("/studio");
      },
    })),
    ...articles.map((a) => ({
      title: a.path.slice(1),
      hint: "Documentation",
      action: () => navigate(a.path),
    })),
  ];
  const activeLine =
    state && ["running", "paused"].includes(state.status) && state.steps > 0
      ? compilation?.program?.instructions[state.pc]?.span.line
      : undefined;
  const editor = (
    <Suspense
      fallback={<div className="empty-state">Loading source editor…</div>}
    >
      <Editor
        source={source}
        onChange={updateSource}
        diagnostics={diagnostics}
        selected={selected}
        line={activeLine}
        breakpoints={breakpoints}
        onBreakpoint={toggleBreakpoint}
        onRun={run}
      />
    </Suspense>
  );
  return (
    <div className={`app ${path === "/studio" ? "is-studio" : ""}`}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="global-header">
        {link("/", <Logo />, "brand-link")}
        <span className="header-divider" />
        <span className="product-label">LANGUAGE & COMPILER EXPLORER</span>
        <nav aria-label="Main navigation">
          {link("/studio", "Studio", path === "/studio" ? "nav-active" : "")}
          {link(
            "/language",
            "Language",
            path === "/language" ? "nav-active" : "",
          )}
          {link("/learn", "Learn", path === "/learn" ? "nav-active" : "")}
          {link(
            "/architecture",
            "Architecture",
            path === "/architecture" ? "nav-active" : "",
          )}
          {link(
            "/experiments",
            <>
              <FlaskConical size={13} />
              <span>Experiments</span>
            </>,
            path === "/experiments" ? "nav-active" : "",
          )}
        </nav>
        <div className="header-actions">
          <a
            className="icon-button source-link"
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Axiom source on GitHub"
            title="Source on GitHub"
          >
            <Github size={16} />
          </a>
          <button
            className="command-trigger"
            aria-label="Open command menu"
            onClick={() => setPaletteOpen(true)}
          >
            <Search size={14} />
            <kbd>Ctrl K</kbd>
          </button>
          <button
            className="icon-button theme-toggle"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {path !== "/studio" &&
            link(
              "/studio",
              <>
                Open studio <ArrowUpRight size={13} />
              </>,
              "button button-small header-cta",
            )}
        </div>
      </header>
      {path === "/" && (
        <main id="main" className="home">
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">
                <span className="accent-rule" /> A LANGUAGE YOU CAN SEE
                EXECUTING
              </p>
              <h1>
                The language,
                <br />
                <em>in motion.</em>
              </h1>
              <p className="hero-description">
                Write a program. Explore its structure.
                <br />
                Follow every instruction.
              </p>
              <div className="hero-actions">
                {link(
                  "/studio",
                  <>
                    Enter the studio <ArrowUpRight size={17} />
                  </>,
                  "button primary",
                )}
                {link(
                  "/learn",
                  <>
                    How it works <ArrowRight size={15} />
                  </>,
                  "text-link",
                )}
              </div>
              <div className="hero-footnote">
                <span className="tiny-brackets">[ ]</span>
                <span>
                  Statically typed. Compiled to bytecode.
                  <br />
                  Runs entirely in your browser.
                </span>
              </div>
            </div>
            <div className="hero-demo">
              <div className="demo-top">
                <span className="live-label">
                  <span className="status-dot success" /> LIVE COMPILER
                </span>
                <span className="micro muted">EDIT IT. RUN IT. SEE IT.</span>
              </div>
              <div className="demo-examples" aria-label="Demo programs">
                {[
                  { id: "factorial", label: "Factorial" },
                  { id: "fibonacci", label: "Fibonacci" },
                  { id: "short-circuit", label: "Short circuit" },
                ].map((example) => (
                  <button
                    key={example.id}
                    aria-pressed={exampleId === example.id}
                    onClick={() => loadExample(example.id)}
                  >
                    {example.label}
                  </button>
                ))}
                <span>TRY A PROGRAM</span>
              </div>
              <div className="demo-filename">
                <FileCode2 size={14} />
                {currentExample?.id ?? "program"}.ax
                <button
                  aria-label="Run homepage example"
                  className="demo-run"
                  disabled={!valid || state?.status === "running"}
                  onClick={run}
                >
                  <Play size={12} fill="currentColor" /> Run
                </button>
              </div>
              <div className="demo-editor">{editor}</div>
              <div className="demo-output">
                <div className="micro muted">
                  <TerminalIcon size={12} /> OUTPUT{" "}
                  <span
                    className={
                      state?.status === "completed" ? "success-text" : ""
                    }
                  >
                    {status}
                  </span>
                </div>
                <pre aria-live="polite">
                  {state?.output.length
                    ? state.output.join("\n")
                    : diagnostics.length
                      ? diagnostics[0].message
                      : "Run the program to follow its execution."}
                </pre>
                <div className="demo-metrics">
                  <span>{compilation?.tokens.length ?? 0} tokens</span>
                  <span>
                    {compilation?.program?.instructions.length ?? 0}{" "}
                    instructions
                  </span>
                  <span>{state?.steps ?? 0} executed</span>
                  <span className="local-label">
                    <span className="status-dot" /> Local execution
                  </span>
                </div>
              </div>
              <span className="demo-corner">01 / SOURCE TO EXECUTION</span>
            </div>
          </section>
          <section className="pipeline-section">
            <div className="section-caption">
              <span>NOT A BLACK BOX.</span>
              <span>THE WHOLE PIPELINE, IN THE OPEN.</span>
            </div>
            <div className="pipeline">
              {[
                "Source",
                "Tokens",
                "Syntax tree",
                "Types",
                "Bytecode",
                "Execution",
              ].map((stage, i) => (
                <button
                  key={stage}
                  onClick={() => {
                    setTab(inspectorTabs[[0, 1, 0, 2, 3, 4][i]]);
                    navigate("/studio");
                  }}
                >
                  <span className="micro">0{i + 1}</span>
                  <strong>{stage}</strong>
                  <span className="pipeline-arrow">
                    {i < 5 ? <ArrowRight size={17} /> : <Check size={17} />}
                  </span>
                  <small>
                    {
                      [
                        "Your idea, in code",
                        "Characters become meaning",
                        "Structure takes shape",
                        "Rules, checked before runtime",
                        "A machine-readable plan",
                        "Every operation, visible",
                      ][i]
                    }
                  </small>
                </button>
              ))}
            </div>
          </section>
          <section className="home-inspection">
            <div className="inspection-intro">
              <p className="eyebrow">THE LIVE PROGRAM / UNDER THE SURFACE</p>
              <h2>
                Follow the thought.
                <br />
                <em>All the way down.</em>
              </h2>
              <p>
                The program above is the source of every token, node and
                instruction here. Select a node. Find its source. See what it
                becomes.
              </p>
              <button
                className="text-link"
                onClick={() => {
                  setTab("Runtime");
                  navigate("/studio");
                }}
              >
                Step inside the machine <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="home-inspector">
              <Inspector
                compilation={compilation}
                state={state}
                tab={tab}
                setTab={setTab}
                onSelect={(span) => setSelected({ ...span })}
              />
            </div>
          </section>
          <section className="home-deeper">
            <div>
              <p className="eyebrow">UNDERSTANDING IS THE POINT.</p>
              <h2>
                Nothing up
                <br />
                the compiler’s sleeve.
              </h2>
              <p>
                A real lexer. A real type checker. A real virtual machine. Axiom
                makes each transformation inspectable, so you can connect the
                code you write to the work the machine does.
              </p>
              {link(
                "/architecture",
                <>
                  Explore the architecture <ArrowUpRight size={15} />
                </>,
                "text-link",
              )}
            </div>
            <div className="home-detail-list">
              {[
                {
                  n: "01",
                  title: "See the shape of an idea.",
                  text: "Explore the actual syntax tree. Select any node and find the exact source that created it.",
                  tab: "AST",
                },
                {
                  n: "02",
                  title: "Meet the machine.",
                  text: "Inspect the instructions, constants and jumps that your program compiles into.",
                  tab: "Bytecode",
                },
                {
                  n: "03",
                  title: "Slow down a thought.",
                  text: "Step into a function. Watch the call stack grow. Understand where each value comes from.",
                  tab: "Runtime",
                },
              ].map((item) => (
                <button
                  key={item.n}
                  onClick={() => {
                    setTab(item.tab as InspectorTab);
                    navigate("/studio");
                  }}
                >
                  <span>{item.n}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                  <ArrowUpRight size={19} />
                </button>
              ))}
            </div>
          </section>
          <section className="home-invitation">
            <div>
              <p className="eyebrow">THE NEXT INSTRUCTION IS YOURS.</p>
              <h2>Start with a little curiosity.</h2>
            </div>
            <div>
              {link(
                "/studio",
                <>
                  Open the studio <ArrowUpRight size={16} />
                </>,
                "button primary",
              )}
              <a
                className="text-link"
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github size={15} /> Read the source
              </a>
            </div>
          </section>
          <footer className="site-footer">
            <Logo small />
            <span>A small language. An open view of the machine.</span>
            {link("/language", "Language reference")}
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
              Source on GitHub
            </a>
            <span className="micro">AXIOM / v1.0</span>
          </footer>
        </main>
      )}
      {path === "/studio" && (
        <main id="main" className="studio">
          <div className="studio-toolbar">
            <div className="workspace-title">
              <span className="workspace-icon">
                <Code2 size={16} />
              </span>
              <strong>Workspace</strong>
              <span className="slash">/</span>
              <span className="file-label">
                {currentExample?.id ?? "program"}.ax
              </span>
              <span className="unsaved-dot" title="Saved locally" />
            </div>
            <div className="run-controls">
              <button
                className="button primary run-button"
                disabled={
                  !valid ||
                  state?.status === "running" ||
                  state?.status === "terminated"
                }
                onClick={run}
              >
                <Play size={13} fill="currentColor" />
                {state?.status === "paused" ? "Continue" : "Run"}
                <kbd>Ctrl ↵</kbd>
              </button>
              <button
                className="icon-button"
                aria-label="Pause execution"
                title="Pause execution"
                disabled={state?.status !== "running"}
                onClick={() => engine.command("pause")}
              >
                <Pause size={15} />
              </button>
              <button
                className="icon-button"
                aria-label="Stop execution"
                title="Stop execution"
                disabled={
                  !state ||
                  ["completed", "terminated", "errored"].includes(state.status)
                }
                onClick={engine.stop}
              >
                <Square size={13} />
              </button>
              <span className="control-divider" />
              <button
                className="icon-button"
                aria-label="Step instruction"
                title="Step instruction"
                disabled={
                  !valid ||
                  state?.status === "running" ||
                  state?.status === "terminated"
                }
                onClick={() => step("instruction")}
              >
                <StepForward size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Step into"
                title="Step into (F11)"
                disabled={
                  !valid ||
                  state?.status === "running" ||
                  state?.status === "terminated"
                }
                onClick={() => step("into")}
              >
                <ArrowDown size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Step over"
                title="Step over (F10)"
                disabled={
                  !valid ||
                  state?.status === "running" ||
                  state?.status === "terminated"
                }
                onClick={() => step("over")}
              >
                <SkipForward size={16} />
              </button>
              <button
                className="icon-button"
                aria-label="Step out"
                title="Step out (Shift F11)"
                disabled={
                  !valid ||
                  state?.status === "running" ||
                  state?.status === "terminated" ||
                  (state?.frames.length ?? 0) < 2
                }
                onClick={() => step("out")}
              >
                <ArrowUpRight size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Reset execution"
                title="Reset execution"
                disabled={compiling}
                onClick={() => engine.command("reset")}
              >
                <RotateCcw size={14} />
              </button>
            </div>
            <div className="studio-tools">
              <button className="text-button" onClick={share}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Share"}</span>
              </button>
              <button
                className="icon-button"
                aria-label="Download source"
                onClick={download}
              >
                <ArrowDownToLine size={15} />
              </button>
              <button
                className="icon-button"
                aria-label="Keyboard shortcuts"
                onClick={() => setHelpOpen(true)}
              >
                <CircleHelp size={15} />
              </button>
            </div>
          </div>
          <div
            className={`studio-shell ${sidebarOpen ? "" : "sidebar-hidden"}`}
          >
            <aside className="activity-rail">
              <button
                className="active icon-button"
                title="Examples"
                aria-label="Examples"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen((open) => !open)}
              >
                <FileCode2 size={19} />
              </button>
              <button
                className="icon-button"
                title="Inspect syntax tree"
                aria-label="Inspect syntax tree"
                onClick={() => {
                  setTab("AST");
                  setMobileTab("inspector");
                }}
              >
                <GitBranch size={19} />
              </button>
              <button
                className="icon-button"
                title="Inspect runtime"
                aria-label="Inspect runtime"
                onClick={() => {
                  setTab("Runtime");
                  setMobileTab("inspector");
                }}
              >
                <Layers size={19} />
              </button>
              {link(
                "/learn",
                <>
                  <BookOpen size={18} />
                  <span className="sr-only">Learning guide</span>
                </>,
                "icon-button",
              )}
              <div className="rail-bottom">
                <button
                  className="icon-button"
                  aria-label="Workspace layout settings"
                  onClick={() => setHelpOpen(true)}
                >
                  <Settings2 size={18} />
                </button>
              </div>
            </aside>
            <aside className="example-sidebar">
              <div className="sidebar-heading">
                <span>EXPLORER</span>
                <span className="micro">15</span>
              </div>
              <div className="project-tree-label">
                <ChevronDown size={13} />
                <Braces size={14} />
                <strong>AXIOM EXAMPLES</strong>
              </div>
              <div className="example-list">
                {examples.map((e, i) => (
                  <button
                    key={e.id}
                    className={exampleId === e.id ? "active" : ""}
                    onClick={() => loadExample(e.id)}
                    title={e.description}
                  >
                    <FileCode2 size={13} />
                    <span>{e.id}.ax</span>
                    <span className="example-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </button>
                ))}
              </div>
              <div className="example-context">
                <span className="micro">
                  {currentExample?.category ?? "YOUR PROGRAM"}
                </span>
                <h3>{currentExample?.title ?? "A blank canvas"}</h3>
                <p>
                  {currentExample?.description ??
                    "Your source is saved in this browser."}
                </p>
                {currentExample && (
                  <div className="expected-output">
                    <span>
                      {source !== currentExample.source
                        ? "ORIGINAL EXAMPLE "
                        : ""}
                      EXPECTED {currentExample.error ? "DIAGNOSTIC" : "OUTPUT"}
                    </span>
                    <code>
                      {currentExample.error ??
                        currentExample.output?.join(", ")}
                    </code>
                  </div>
                )}
              </div>
              <div className="sidebar-bottom">
                <span className="status-dot success" /> Browser-local workspace
              </div>
            </aside>
            <div
              className="workspace-main"
              ref={workspace}
              style={
                {
                  "--editor-width": `${Math.max(30, Math.min(70, typeof panelSize === "number" ? panelSize : 49))}%`,
                  "--terminal-height": `${Math.max(120, Math.min(500, typeof terminalHeight === "number" ? terminalHeight : 210))}px`,
                } as React.CSSProperties
              }
            >
              {showIntro && (
                <div className="intro-banner">
                  <span className="intro-symbol">λ</span>
                  <p>
                    <strong>Make the invisible visible.</strong> Run the
                    program, or step through one instruction at a time. Click
                    the gutter to set a breakpoint.
                  </p>
                  <button
                    className="icon-button"
                    aria-label="Dismiss introduction"
                    onClick={() => setShowIntro(false)}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="mobile-workspace-toolbar">
                <label>
                  Example
                  <select
                    aria-label="Choose example"
                    value={exampleId}
                    onChange={(e) => loadExample(e.target.value)}
                  >
                    {!currentExample && (
                      <option value={exampleId}>Custom program</option>
                    )}
                    {examples.map((e) => (
                      <option value={e.id} key={e.id}>
                        {e.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="segmented">
                  <button
                    className={mobileTab === "editor" ? "active" : ""}
                    onClick={() => setMobileTab("editor")}
                  >
                    Source
                  </button>
                  <button
                    className={mobileTab === "inspector" ? "active" : ""}
                    onClick={() => setMobileTab("inspector")}
                  >
                    Inspect
                  </button>
                </div>
              </div>
              <div className={`workspace-panes mobile-${mobileTab}`}>
                <section className="source-panel" aria-label="Source editor">
                  <div className="panel-heading">
                    <span>
                      <FileCode2 size={13} />
                      {currentExample?.id ?? "program"}.ax{" "}
                      <span className="file-dot" />
                    </span>
                    <span className="micro muted">AXIOM</span>
                  </div>
                  <div className="editor-breadcrumb">
                    <span>examples</span>
                    <ChevronDown size={11} />
                    <span>{currentExample?.id ?? "program"}.ax</span>
                    {activeLine && (
                      <span className="executing-label">LINE {activeLine}</span>
                    )}
                  </div>
                  {editor}
                  <div className="editor-bottom">
                    <span>{source.split("\n").length} lines</span>
                    <span>
                      {breakpoints.length} breakpoint
                      {breakpoints.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={() => setBreakpoints([])}
                      disabled={!breakpoints.length}
                    >
                      Clear breakpoints
                    </button>
                  </div>
                </section>
                <div
                  className="resize-handle vertical"
                  role="separator"
                  aria-label="Resize editor and inspector"
                  aria-orientation="vertical"
                  tabIndex={0}
                  aria-valuenow={panelSize}
                  aria-valuemin={30}
                  aria-valuemax={70}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft")
                      setPanelSize(Math.max(30, panelSize - 2));
                    if (e.key === "ArrowRight")
                      setPanelSize(Math.min(70, panelSize + 2));
                  }}
                  onPointerDown={(e) => {
                    const target = e.currentTarget;
                    target.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (
                      e.currentTarget.hasPointerCapture(e.pointerId) &&
                      workspace.current
                    ) {
                      const rect = workspace.current.getBoundingClientRect();
                      setPanelSize(
                        Math.max(
                          30,
                          Math.min(
                            70,
                            ((e.clientX - rect.left) / rect.width) * 100,
                          ),
                        ),
                      );
                    }
                  }}
                  onPointerUp={(e) =>
                    e.currentTarget.releasePointerCapture(e.pointerId)
                  }
                />
                <Inspector
                  compilation={compilation}
                  state={state}
                  tab={tab}
                  setTab={setTab}
                  onSelect={(span) => {
                    setSelected({ ...span });
                    if (innerWidth < 760) setMobileTab("editor");
                  }}
                />
              </div>
              <div
                className="resize-handle horizontal"
                role="separator"
                aria-label="Resize terminal"
                aria-orientation="horizontal"
                aria-valuenow={terminalHeight}
                aria-valuemin={120}
                aria-valuemax={500}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp")
                    setTerminalHeight(Math.min(500, terminalHeight + 20));
                  if (e.key === "ArrowDown")
                    setTerminalHeight(Math.max(120, terminalHeight - 20));
                }}
                onPointerDown={(e) =>
                  e.currentTarget.setPointerCapture(e.pointerId)
                }
                onPointerMove={(e) => {
                  if (
                    e.currentTarget.hasPointerCapture(e.pointerId) &&
                    workspace.current
                  )
                    setTerminalHeight(
                      Math.max(
                        120,
                        Math.min(
                          500,
                          workspace.current.getBoundingClientRect().bottom -
                            e.clientY,
                        ),
                      ),
                    );
                }}
                onPointerUp={(e) =>
                  e.currentTarget.releasePointerCapture(e.pointerId)
                }
              />
              <section
                className={`terminal-panel ${terminalCollapsed ? "collapsed" : ""}`}
                aria-label="Program terminal"
              >
                <div className="terminal-tabs">
                  <button
                    className={terminalTab === "Output" ? "active" : ""}
                    onClick={() => {
                      setTerminalTab("Output");
                      setTerminalCollapsed(false);
                    }}
                  >
                    <TerminalIcon size={13} />
                    Terminal
                  </button>
                  <button
                    className={terminalTab === "Problems" ? "active" : ""}
                    onClick={() => {
                      setTerminalTab("Problems");
                      setTerminalCollapsed(false);
                    }}
                  >
                    Problems{" "}
                    <span
                      className={
                        diagnostics.length
                          ? "problem-count has-errors"
                          : "problem-count"
                      }
                    >
                      {diagnostics.length}
                    </span>
                  </button>
                  <div className="terminal-info">
                    <span
                      className={`status-dot ${state?.status === "errored" || compilation?.diagnostics.length ? "error" : state?.status === "completed" ? "success" : ""}`}
                    />
                    <span aria-live="polite">{status}</span>
                    <span className="terminal-timing">
                      {state
                        ? `${state.steps.toLocaleString()} instructions · ${state.elapsedMs.toFixed(2)} ms`
                        : ""}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={
                        terminalCollapsed
                          ? "Expand terminal"
                          : "Collapse terminal"
                      }
                      onClick={() => setTerminalCollapsed(!terminalCollapsed)}
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                </div>
                {!terminalCollapsed && (
                  <div className="terminal-content" aria-live="polite">
                    {terminalTab === "Output" ? (
                      <>
                        <div className="terminal-welcome">
                          <span className="accent-text">axiom</span>{" "}
                          <span>v1.0 / stack virtual machine</span>
                          <span className="terminal-limits">
                            instruction budget: 100,000
                          </span>
                        </div>
                        {!state?.output.length && !diagnostics.length && (
                          <p className="terminal-placeholder">
                            <span>›</span>{" "}
                            {state?.status === "running"
                              ? "Executing in worker…"
                              : "Ready when you are. Run your program to see its output."}
                          </p>
                        )}
                        {state?.output.map((line, i) => (
                          <div className="output-line" key={i}>
                            <span>{String(i + 1).padStart(2, "0")}</span>
                            <pre>{line}</pre>
                          </div>
                        ))}
                        {diagnostics.map((d, i) => (
                          <button
                            className="diagnostic-line"
                            key={i}
                            onClick={() => {
                              setSelected({ ...d.span });
                              setMobileTab("editor");
                            }}
                          >
                            <span>
                              {d.stage === "budget" ? "LIMIT" : d.code}
                            </span>
                            <strong>{d.message}</strong>
                            <small>
                              {d.span.line}:{d.span.column}
                            </small>
                          </button>
                        ))}
                        {state?.status === "completed" && (
                          <p className="execution-complete">
                            <Check size={12} /> Program completed{" "}
                            <span>exit 0</span>
                          </p>
                        )}
                        {state?.status === "terminated" && (
                          <p className="accent-text">
                            Execution terminated. Reset to create a fresh
                            worker.
                          </p>
                        )}
                      </>
                    ) : diagnostics.length ? (
                      diagnostics.map((d, i) => (
                        <button
                          className="diagnostic-line"
                          key={i}
                          onClick={() => {
                            setSelected({ ...d.span });
                            setMobileTab("editor");
                          }}
                        >
                          <span>{d.code}</span>
                          <strong>{d.message}</strong>
                          <small>
                            {d.stage} · {d.span.line}:{d.span.column}
                          </small>
                        </button>
                      ))
                    ) : (
                      <div className="no-problems">
                        <Check size={15} />
                        <strong>No problems found.</strong>
                        <span>
                          {compiling
                            ? "Compilation in progress."
                            : "Your source passed the current compiler stages."}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
          <footer className="studio-statusbar">
            <span>
              <span className={`status-dot ${valid ? "success" : ""}`} />
              {status}
            </span>
            <span>
              <GitBranch size={11} />
              Axiom v1.0
            </span>
            <span className="status-spacer" />
            <span>
              {compilation
                ? `${compilation.timings.total.toFixed(2)} ms compile`
                : "Compiling"}
            </span>
            <span>UTF-8</span>
            <span>{new TextEncoder().encode(source).length} bytes</span>
            <button onClick={() => setPaletteOpen(true)}>
              <Command size={11} /> Commands
            </button>
          </footer>
        </main>
      )}
      {articles.some((a) => a.path === path) && (
        <main id="main" className="docs-page">
          <aside className="docs-sidebar">
            <p className="micro muted">THE AXIOM FIELD GUIDE</p>
            {articles.map((a) =>
              link(
                a.path,
                <>
                  <span>{a.path.slice(1)}</span>
                  <ArrowUpRight size={13} />
                </>,
                a.path === path ? "active" : "",
              ),
            )}
            {link(
              "/experiments",
              <>
                Experiments <FlaskConical size={13} />
              </>,
            )}
            <div className="docs-sidebar-note">
              Every explanation follows the implementation. Every example opens
              in the studio.
            </div>
          </aside>
          <article>
            {articles
              .filter((a) => a.path === path)
              .map((a) => (
                <div key={a.path}>
                  <p className="eyebrow">{a.eyebrow}</p>
                  <h1>{a.title}</h1>
                  <p className="article-intro">{a.intro}</p>
                  <div className="article-divider" />
                  {a.sections.map((section, i) => (
                    <section
                      className="article-section"
                      key={i}
                      id={`section-${i}`}
                    >
                      <h2>{section.title}</h2>
                      <p>{section.text}</p>
                      {section.code && (
                        <div className="article-code">
                          <div>
                            <span className="micro">EXAMPLE.AX</span>
                            <button
                              onClick={() => {
                                setSource(section.code!);
                                setExampleId("custom");
                                setBreakpoints([]);
                                navigate("/studio");
                              }}
                            >
                              Explore in studio <ArrowUpRight size={13} />
                            </button>
                          </div>
                          <pre>{section.code}</pre>
                        </div>
                      )}
                    </section>
                  ))}
                  <div className="article-next">
                    <span>SEE IT FOR YOURSELF</span>
                    {link(
                      "/studio",
                      <>
                        Open the studio <ArrowUpRight size={17} />
                      </>,
                      "button primary",
                    )}
                  </div>
                </div>
              ))}
          </article>
        </main>
      )}
      {path === "/experiments" && (
        <Experiments
          onExplore={(source) => {
            setSource(source);
            setExampleId("benchmark");
            setBreakpoints([]);
            navigate("/studio");
          }}
        />
      )}
      {![
        "/",
        "/studio",
        "/experiments",
        ...articles.map((a) => a.path),
      ].includes(path) && (
        <main id="main" className="not-found">
          <p className="eyebrow">404 / NO SUCH INSTRUCTION</p>
          <h1>This path has no destination.</h1>
          {link(
            "/studio",
            <>
              Return to the studio <ArrowRight size={16} />
            </>,
            "button primary",
          )}
        </main>
      )}
      <dialog
        className="command-dialog"
        ref={dialog}
        onClose={() => setPaletteOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPaletteOpen(false);
        }}
      >
        <div className="command-search">
          <Search size={18} />
          <input
            aria-label="Search commands"
            placeholder="What would you like to explore?"
            value={commandQuery}
            onChange={(e) => setCommandQuery(e.target.value)}
            autoFocus
          />
          <button
            aria-label="Close commands"
            onClick={() => setPaletteOpen(false)}
          >
            <kbd>Esc</kbd>
          </button>
        </div>
        <p className="micro muted command-section-label">
          COMMANDS & DESTINATIONS
        </p>
        <div className="command-list">
          {commandActions
            .filter((a) =>
              a.title.toLowerCase().includes(commandQuery.toLowerCase()),
            )
            .map((a) => (
              <button
                key={a.title}
                onClick={() => {
                  a.action();
                  setPaletteOpen(false);
                  setCommandQuery("");
                }}
              >
                <span>{a.title}</span>
                <small>{a.hint}</small>
                <ArrowUpRight size={13} />
              </button>
            ))}
        </div>
        <div className="command-footer">
          Navigate with Tab · Enter to select
        </div>
      </dialog>
      <dialog
        className="help-dialog"
        ref={help}
        onClose={() => setHelpOpen(false)}
      >
        <div className="dialog-title">
          <Logo small />
          <button
            className="icon-button"
            aria-label="Close help"
            onClick={() => setHelpOpen(false)}
          >
            <X size={17} />
          </button>
        </div>
        <h2>A few useful shortcuts.</h2>
        <div className="shortcut-list">
          {[
            ["Run / continue", "Ctrl + Enter"],
            ["Command menu", "Ctrl + K"],
            ["Step over", "F10"],
            ["Step into", "F11"],
            ["Step out", "Shift + F11"],
            ["Search source", "Ctrl + F"],
            ["Undo / redo", "Ctrl + Z / Ctrl + Shift + Z"],
            ["Toggle breakpoint", "F9 or click the gutter"],
          ].map(([label, key]) => (
            <div key={label}>
              <span>{label}</span>
              <kbd>{key}</kbd>
            </div>
          ))}
        </div>
        <p className="muted">
          Drag the panel dividers to resize. Focus a divider and use arrow keys
          for keyboard resizing. Source and layout preferences are stored
          locally. Share links support up to 6,000 source characters and never
          run automatically.
        </p>
        <button
          className="button"
          onClick={() => {
            setPanelSize(49);
            setTerminalHeight(210);
            setShowIntro(true);
            setHelpOpen(false);
          }}
        >
          Reset workspace layout
        </button>
      </dialog>
    </div>
  );
}
function Experiments({ onExplore }: { onExplore: (source: string) => void }) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]),
    [running, setRunning] = useState(false),
    [error, setError] = useState(""),
    [environment, setEnvironment] = useState(""),
    [timestamp, setTimestamp] = useState(""),
    [benchmarkEngine, setBenchmarkEngine] = useState<EngineIdentity>();
  const worker = useRef<Worker | undefined>(undefined);
  useEffect(() => () => worker.current?.terminate(), []);
  function run() {
    worker.current?.terminate();
    const w = new Worker(
      new URL("./workers/benchmark.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = w;
    setRunning(true);
    setMeasurements([]);
    setError("");
    setEnvironment(navigator.userAgent);
    setTimestamp(new Date().toISOString());
    w.onmessage = (
      e: MessageEvent<{
        measurements?: Measurement[];
        engine?: EngineIdentity;
        done: boolean;
        error?: string;
      }>,
    ) => {
      if (e.data.measurements) setMeasurements(e.data.measurements);
      if (e.data.engine) setBenchmarkEngine(e.data.engine);
      if (e.data.error) setError(e.data.error);
      if (e.data.done) {
        setRunning(false);
        w.terminate();
      }
    };
    w.onerror = (e) => {
      setError(e.message);
      setRunning(false);
      w.terminate();
    };
    w.postMessage("run");
  }
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            timestamp,
            environment,
            engine: benchmarkEngine,
            methodology: {
              warmup: 2,
              samples: 10,
              timing:
                "performance.now; median; includes trace and safety checks",
            },
            measurements,
            inputs: benchmarks,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "axiom-benchmark.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main id="main" className="experiments-page">
      <div className="experiment-header">
        <div>
          <p className="eyebrow">EXPERIMENTS / MEASURE, THEN UNDERSTAND</p>
          <h1>
            The machine,
            <br />
            <em>under observation.</em>
          </h1>
          <p>
            How does a stack-based VM behave as program complexity increases?
            Run a controlled set of programs on your own machine.
          </p>
        </div>
        <div className="experiment-actions">
          <button className="button primary" onClick={run} disabled={running}>
            <Play size={14} />
            {running ? "Measuring…" : "Run benchmarks"}
          </button>
          {running && (
            <button
              className="button"
              onClick={() => {
                worker.current?.terminate();
                setRunning(false);
                setError("Benchmark cancelled. Partial measurements remain.");
              }}
            >
              Stop
            </button>
          )}
          {!!measurements.length && (
            <button className="button" onClick={download}>
              <ArrowDownToLine size={14} />
              Export JSON
            </button>
          )}
        </div>
      </div>
      <div className="methodology">
        <div>
          <span>WARM-UP</span>
          <strong>2 runs</strong>
        </div>
        <div>
          <span>SAMPLE SIZE</span>
          <strong>10 runs / program</strong>
        </div>
        <div>
          <span>REPORTED TIME</span>
          <strong>Median, min, max</strong>
        </div>
        <div>
          <span>EXECUTION</span>
          <strong>Dedicated worker</strong>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!measurements.length ? (
        <div className="benchmark-empty">
          <FlaskConical size={35} />
          <h2>No measurements yet.</h2>
          <p>
            Results come from explicitly running the real compiler and VM.
            Nothing here is pre-populated.
          </p>
        </div>
      ) : (
        <>
          <div className="benchmark-table">
            <table>
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Compile median</th>
                  <th>Execute median</th>
                  <th>Execute min / max</th>
                  <th>Instructions</th>
                  <th>Stack / frames</th>
                </tr>
              </thead>
              <tbody>
                {measurements.map((m) => (
                  <tr key={m.name}>
                    <td>{m.name}</td>
                    <td>{m.compileMs.toFixed(3)} ms</td>
                    <td>{m.executeMs.toFixed(3)} ms</td>
                    <td>
                      {m.minMs.toFixed(3)} / {m.maxMs.toFixed(3)} ms
                    </td>
                    <td>{m.steps.toLocaleString()}</td>
                    <td>
                      {m.maxStack} / {m.maxDepth}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="benchmark-environment">
            {timestamp}
            <br />
            {environment}
          </p>
        </>
      )}
      <div className="experiment-bottom">
        <section>
          <h2>The method matters.</h2>
          <p>
            Each program runs twice to warm up the Rust/WebAssembly engine, then
            ten measured times. Compilation and execution are measured
            separately with performance.now(). Each output is checked before
            recording a sample. Execution includes safety checks and the bounded
            instruction trace.
          </p>
          <p>
            Browser scheduling, timer precision, WebAssembly tiering and other
            applications affect these results. Compare repeat runs on the same
            device. These are implementation measurements, not claims about
            other languages.
          </p>
          <h3>A testable hypothesis</h3>
          <p>
            Recursive Fibonacci should perform more calls and instructions than
            iterative Fibonacci. Vary the same input n in both programs before
            comparing growth rates. The default inputs are demonstrations, not a
            matched comparison.
          </p>
        </section>
        <section>
          <h2>The input programs.</h2>
          {benchmarks.map((input) => (
            <button
              className="benchmark-input"
              key={input.name}
              onClick={() => onExplore(input.source)}
            >
              <Code2 size={14} />
              <span>{input.name}</span>
              <ArrowUpRight size={14} />
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
export default App;
