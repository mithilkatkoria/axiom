import { useMemo, useState } from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Layers,
  Search,
  Terminal,
  Workflow,
} from "lucide-react";
import {
  children,
  Op,
  opcodeDescription,
  type Compilation,
  type Node,
  type Snapshot,
  type Span,
} from "../language";
import { AstExplorer } from "./AstExplorer";
export type InspectorTab = "AST" | "Tokens" | "Types" | "Bytecode" | "Runtime";
export const inspectorTabs: InspectorTab[] = [
  "AST",
  "Tokens",
  "Types",
  "Bytecode",
  "Runtime",
];
const empty = (
  <div className="empty-state">
    <Workflow size={25} />
    <strong>Structure starts with source.</strong>
    <p>Write a valid program to inspect this stage.</p>
  </div>
);
export function Inspector({
  compilation,
  state,
  tab,
  setTab,
  onSelect,
}: {
  compilation?: Compilation;
  state?: Snapshot;
  tab: InspectorTab;
  setTab: (tab: InspectorTab) => void;
  onSelect: (span: Span) => void;
}) {
  const [query, setQuery] = useState(""),
    [limit, setLimit] = useState(300),
    [manualPage, setManualPage] = useState<number | undefined>(undefined),
    [compact, setCompact] = useState(false),
    [frameIndex, setFrameIndex] = useState<number | undefined>(undefined);
  const ast = compilation?.ast,
    program = compilation?.program,
    semantic = compilation?.semantic;
  const nodes = useMemo(() => {
    if (!ast) return [];
    const flat: Node[] = [],
      pending: Node[] = [ast];
    while (pending.length) {
      const node = pending.pop()!;
      flat.push(node);
      pending.push(...[...children(node)].reverse());
    }
    return flat;
  }, [ast]);
  const tokens =
    compilation?.tokens.filter(
      (t) =>
        t.lexeme.toLowerCase().includes(query.toLowerCase()) ||
        t.kind.includes(query.toLowerCase()),
    ) ?? [];
  const page = manualPage ?? Math.floor((state?.pc ?? 0) / 200),
    instructions =
      program?.instructions.slice(page * 200, (page + 1) * 200) ?? [];
  const actualFrame =
      frameIndex !== undefined && state?.frames[frameIndex]
        ? frameIndex
        : (state?.frames.length ?? 1) - 1,
    frame = state?.frames[actualFrame];
  return (
    <section className="inspector-panel" aria-label="Compiler inspector">
      <div className="panel-tabs" role="tablist" aria-label="Compiler stages">
        {inspectorTabs.map((t, i) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tab}
            className={t === tab ? "active" : ""}
            onClick={() => {
              setTab(t);
              setManualPage(undefined);
            }}
          >
            <span className="tab-number" aria-hidden="true">
              0{i + 1}
            </span>
            {t}
          </button>
        ))}
      </div>
      <div
        className="inspector-body"
        role="tabpanel"
        aria-label={`${tab} inspector`}
      >
        {tab === "AST" &&
          (ast ? (
            <AstExplorer
              key={compilation?.id}
              root={ast}
              semantic={semantic}
              program={program}
              onSelect={onSelect}
            />
          ) : (
            empty
          ))}
        {tab === "Tokens" && (
          <>
            <div className="inspection-toolbar">
              <Search size={13} />
              <input
                aria-label="Filter tokens"
                placeholder="Find a lexeme or token kind…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(300);
                }}
              />
              <span className="micro muted">{tokens.length} TOKENS</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Lexeme</th>
                    <th>Kind</th>
                    <th>Position</th>
                    <th>Literal</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.slice(0, limit).map((t, i) => (
                    <tr key={`${t.start}-${i}`}>
                      <td>{i}</td>
                      <td>
                        <button
                          className="code-link"
                          title={`${t.kind}: source characters ${t.start} to ${t.end}`}
                          onClick={() => onSelect(t)}
                        >
                          {t.lexeme || "EOF"}
                        </button>
                      </td>
                      <td>
                        <span className={`token-kind ${t.kind}`}>{t.kind}</span>
                      </td>
                      <td>
                        {t.line}:{t.column}
                      </td>
                      <td>
                        {t.literal === undefined
                          ? "N/A"
                          : JSON.stringify(t.literal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tokens.length > limit && (
                <button
                  className="load-more"
                  onClick={() => setLimit((n) => n + 300)}
                >
                  Show 300 more tokens
                </button>
              )}
            </div>
          </>
        )}
        {tab === "Types" &&
          (semantic ? (
            <div className="types-panel">
              <div className="analysis-banner">
                <span
                  className={
                    semantic.diagnostics.length
                      ? "status-dot error"
                      : "status-dot success"
                  }
                />
                <strong>
                  {semantic.diagnostics.length
                    ? `${semantic.diagnostics.length} diagnostics`
                    : "Static analysis complete"}
                </strong>
                <span>
                  {Object.keys(semantic.types).length} typed expressions
                </span>
              </div>
              <h3>SYMBOL TABLE</h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Scope</th>
                      <th>Storage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semantic.bindings.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <button
                            className="code-link"
                            onClick={() => onSelect(b.span)}
                          >
                            {b.name}
                          </button>
                        </td>
                        <td className="type-value">{b.type}</td>
                        <td>
                          #{b.scope} · {b.owner}
                        </td>
                        <td>
                          {b.global ? "global" : "local"} {b.slot}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>FUNCTION SIGNATURES</h3>
              {Object.values(semantic.functions).map((fn) => (
                <button
                  key={fn.name}
                  className="signature"
                  onClick={() => onSelect(fn.node.span)}
                >
                  {fn.name}({fn.params.join(", ")}):{" "}
                  <span className="type-value">{fn.result}</span>
                </button>
              ))}
              <h3>EXPRESSION TYPES</h3>
              <div className="expression-types">
                {nodes
                  .filter((n) => semantic.types[n.id] !== undefined)
                  .slice(0, limit)
                  .map((n) => (
                    <button key={n.id} onClick={() => onSelect(n.span)}>
                      <span>
                        #{n.id} {n.kind}
                      </span>
                      <span className="type-value">{semantic.types[n.id]}</span>
                      <small>
                        {n.span.line}:{n.span.column}
                      </small>
                    </button>
                  ))}
              </div>
              {Object.keys(semantic.types).length > limit && (
                <button onClick={() => setLimit((n) => n + 300)}>
                  Show more expressions
                </button>
              )}
            </div>
          ) : (
            empty
          ))}
        {tab === "Bytecode" &&
          (program ? (
            <>
              <div className="inspection-toolbar">
                <span className="micro muted">
                  {program.instructions.length} INSTRUCTIONS ·{" "}
                  {program.constants.length} CONSTANTS
                </span>
                <div className="toolbar-end">
                  <button
                    className={compact ? "text-button active" : "text-button"}
                    onClick={() => setCompact(!compact)}
                  >
                    {compact ? "Detailed" : "Compact"}
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Previous instructions"
                    disabled={page === 0}
                    onClick={() => setManualPage(Math.max(0, page - 1))}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="micro">{page * 200}</span>
                  <button
                    className="icon-button"
                    aria-label="Next instructions"
                    disabled={(page + 1) * 200 >= program.instructions.length}
                    onClick={() => setManualPage(page + 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setManualPage(undefined)}
                  >
                    Follow
                  </button>
                </div>
              </div>
              <div className="table-scroll">
                <table className="bytecode-table">
                  <thead>
                    <tr>
                      <th>Addr</th>
                      <th>Instruction</th>
                      <th>Operand</th>
                      {!compact && <th>Source</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {instructions.map((ins, i) => {
                      const addr = page * 200 + i;
                      return (
                        <tr
                          key={addr}
                          className={
                            state?.pc === addr && state.status !== "completed"
                              ? "executing"
                              : ""
                          }
                        >
                          <td>
                            {state?.pc === addr ? "› " : ""}
                            {String(addr).padStart(4, "0")}
                          </td>
                          <td>
                            <button
                              className="code-link"
                              title={opcodeDescription[ins.op]}
                              onClick={() => onSelect(ins.span)}
                            >
                              {Op[ins.op]}
                            </button>
                          </td>
                          <td>
                            {ins.operand === undefined
                              ? ""
                              : ins.op === Op.PUSH_CONST
                                ? `${ins.operand} (${JSON.stringify(program.constants[Number(ins.operand)].value)})`
                                : ins.operand}
                          </td>
                          {!compact && (
                            <td>
                              {ins.span.line}:{ins.span.column}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            empty
          ))}
        {tab === "Runtime" &&
          (state && program ? (
            <div className="runtime-panel">
              <div className="runtime-readout">
                <div>
                  <span>INSTRUCTION POINTER</span>
                  <strong>{String(state.pc).padStart(4, "0")}</strong>
                  <small>
                    {Op[program.instructions[state.pc]?.op] ?? state.status}
                  </small>
                </div>
                <div>
                  <span>EXECUTED</span>
                  <strong>{state.steps.toLocaleString()}</strong>
                  <small>of 100,000 instructions</small>
                </div>
              </div>
              <h3>
                <Layers size={13} /> CALL STACK{" "}
                <span>{state.frames.length}</span>
              </h3>
              <div className="call-stack">
                {state.frames
                  .map((f, i) => (
                    <button
                      key={i}
                      className={actualFrame === i ? "selected" : ""}
                      onClick={() => setFrameIndex(i)}
                    >
                      <span className="frame-depth">
                        {String(i).padStart(2, "0")}
                      </span>
                      <strong>{f.name}</strong>
                      <span>
                        {i === state.frames.length - 1 ? "active" : "caller"}
                      </span>
                    </button>
                  ))
                  .reverse()}
              </div>
              <h3>
                <Box size={13} /> VARIABLES <span>{frame?.name}</span>
              </h3>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {program.bindings
                      .filter((b) =>
                        b.global
                          ? b.scope === 0 || frame?.name === "<main>"
                          : b.owner === frame?.name,
                      )
                      .filter((b) => {
                        const value = b.global
                          ? state.globals[b.slot]
                          : frame?.locals[b.slot];
                        const at =
                          program.instructions[
                            actualFrame === state.frames.length - 1
                              ? state.pc
                              : (state.frames[actualFrame + 1]?.returnPc ?? 1) -
                                1
                          ]?.span;
                        return (
                          value !== undefined &&
                          (b.scope === 0 ||
                            b.span.start <= (at?.end ?? Infinity)) &&
                          (b.scope === 0 ||
                            !at ||
                            (at.start >= b.scopeSpan.start &&
                              at.start <= b.scopeSpan.end))
                        );
                      })
                      .map((b) => (
                        <tr key={b.id}>
                          <td>
                            <button
                              className="code-link"
                              onClick={() => onSelect(b.span)}
                            >
                              {b.name}
                              <small>
                                {" "}
                                {b.global ? "global" : "local"}:{b.slot}
                              </small>
                            </button>
                          </td>
                          <td className="type-value">{b.type}</td>
                          <td className="value">
                            {JSON.stringify(
                              (b.global
                                ? state.globals[b.slot]
                                : frame?.locals[b.slot]
                              )?.value,
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <h3>
                <Layers size={13} /> OPERAND STACK{" "}
                <span>{state.stack.length} values</span>
              </h3>
              {state.stack.length ? (
                <div className="operand-stack">
                  {state.stack
                    .map((v, i) => (
                      <div key={i}>
                        <span>{i}</span>
                        <strong>{JSON.stringify(v.value)}</strong>
                        <span className="type-value">{v.type}</span>
                      </div>
                    ))
                    .reverse()}
                </div>
              ) : (
                <p className="inspector-note">
                  The operand stack is empty. Step to observe intermediate
                  values.
                </p>
              )}
              <h3>
                <Terminal size={13} /> RECENT EXECUTION{" "}
                <span>last 160 instructions</span>
              </h3>
              <div className="trace-list">
                {state.trace
                  .slice(-40)
                  .reverse()
                  .map((event) => (
                    <button
                      key={event.step}
                      onClick={() =>
                        onSelect(program.instructions[event.pc].span)
                      }
                    >
                      <span>#{event.step}</span>
                      <strong>{event.opcode}</strong>
                      <span>
                        line {event.line} · depth {event.depth}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            empty
          ))}
      </div>
    </section>
  );
}
