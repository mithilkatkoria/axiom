import { useCallback, useEffect, useRef, useState } from "react";
import type { Compilation, Snapshot, StepMode } from "../language";
import type { Request, Response } from "../workers/execution.worker";
export function useEngine(source: string) {
  const [compilation, setCompilation] = useState<Compilation>();
  const [state, setState] = useState<Snapshot>();
  const [compiling, setCompiling] = useState(true);
  const [revision, setRevision] = useState(0);
  const worker = useRef<Worker | undefined>(undefined),
    version = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const id = ++version.current;
    worker.current?.terminate();
    worker.current = undefined;
    setCompilation(undefined);
    setState(undefined);
    setCompiling(true);
    const timer = setTimeout(() => {
      const w = new Worker(
        new URL("../workers/execution.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = w;
      w.onmessage = (event: MessageEvent<Response>) => {
        if (event.data.version !== version.current) return;
        if (event.data.compilation) {
          setCompilation(event.data.compilation);
          setCompiling(false);
        }
        setState(event.data.state);
      };
      w.onerror = (event) => {
        if (id !== version.current) return;
        setCompiling(false);
        setCompilation({
          id,
          source,
          tokens: [],
          diagnostics: [
            {
              code: "I003",
              stage: "internal",
              severity: "error",
              message: `Worker failure: ${event.message}`,
              span: { start: 0, end: 0, line: 1, column: 1 },
            },
          ],
          timings: { lex: 0, parse: 0, analyze: 0, compile: 0, total: 0 },
        });
      };
      w.postMessage({
        version: id,
        command: "compile",
        source,
      } satisfies Request);
    }, 180);
    return () => {
      clearTimeout(timer);
      worker.current?.terminate();
    };
  }, [source, revision]);
  const command = useCallback(
    (
      command: "run" | "pause" | "reset" | "step",
      breakpoints: number[] = [],
      mode?: StepMode,
    ) => {
      if (!worker.current) {
        setRevision((r) => r + 1);
        return;
      }
      if (
        (command === "run" || command === "step") &&
        stateRef.current &&
        ["completed", "errored"].includes(stateRef.current.status)
      )
        worker.current.postMessage({
          version: version.current,
          command: "reset",
        } satisfies Request);
      worker.current.postMessage({
        version: version.current,
        command,
        mode,
        breakpoints,
      } satisfies Request);
    },
    [],
  );
  const stop = useCallback(() => {
    version.current++;
    worker.current?.terminate();
    worker.current = undefined;
    setState((s) => (s ? { ...s, status: "terminated" } : s));
    setCompiling(false);
  }, []);
  return { compilation, state, compiling, command, stop };
}
export function useStored<T>(key: string, initial: T): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const data = localStorage.getItem(key);
      const parsed: unknown = data ? JSON.parse(data) : initial;
      return typeof parsed === typeof initial &&
        (typeof parsed !== "number" || Number.isFinite(parsed))
        ? (parsed as T)
        : initial;
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* Storage may be disabled or full. The current session still works. */
      }
    },
    [key],
  );
  return [value, update];
}
