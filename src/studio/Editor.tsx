import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
} from "@codemirror/language";
import { autocompletion, completeFromList } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { setDiagnostics } from "@codemirror/lint";
import { tags } from "@lezer/highlight";
import type { Diagnostic, Span } from "../language";
const activeLine = StateEffect.define<number | undefined>();
const breakpointEffect = StateEffect.define<number[]>();
const activeField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes);
    for (const effect of tr.effects)
      if (effect.is(activeLine)) {
        value =
          effect.value && effect.value <= tr.state.doc.lines
            ? Decoration.set([
                Decoration.line({ class: "cm-execution-line" }).range(
                  tr.state.doc.line(effect.value).from,
                ),
              ])
            : Decoration.none;
      }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});
const breakpointField = StateField.define<number[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) if (e.is(breakpointEffect)) return e.value;
    return value;
  },
});
class Breakpoint extends GutterMarker {
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "breakpoint-dot";
    dot.textContent = "●";
    dot.title = "Breakpoint";
    return dot;
  }
}
const marker = new Breakpoint();
const axiomLanguage = StreamLanguage.define({
  startState: () => ({ block: false, depth: 0 }),
  tokenTable: { functionName: tags.function(tags.variableName) },
  token(stream, state) {
    if (state.block) {
      if (stream.skipTo("*/")) {
        stream.match("*/");
        state.block = false;
      } else stream.skipToEnd();
      return "comment";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("//")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      state.block = true;
      return "comment";
    }
    if (stream.match(/"(?:[^"\\]|\\.)*"?/)) return "string";
    if (stream.match(/\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)) return "number";
    if (stream.match(/\b(?:fn|let|if|else|while|return)\b/)) return "keyword";
    if (stream.match(/\b(?:number|string|boolean|void)\b/)) return "typeName";
    if (stream.match(/\b(?:true|false)\b/)) return "bool";
    if (stream.match(/[a-zA-Z_]\w*(?=\s*\()/)) return "functionName";
    if (stream.match(/[a-zA-Z_]\w*/)) return "variableName";
    if (stream.match(/[+\-*/%!<>=&|]+/)) return "operator";
    const c = stream.next();
    if (c === "{") state.depth++;
    if (c === "}") state.depth = Math.max(0, state.depth - 1);
    return "{}():;,".includes(c ?? "") ? "punctuation" : "invalid";
  },
  indent: (state, textAfter, context) =>
    Math.max(0, state.depth - (textAfter.trim().startsWith("}") ? 1 : 0)) *
    context.unit,
  languageData: {
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
    closeBrackets: { brackets: ["(", "{", '"'] },
  },
});
const highlighting = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syntax-keyword)" },
  { tag: tags.typeName, color: "var(--syntax-type)" },
  { tag: tags.string, color: "var(--syntax-string)" },
  { tag: [tags.number, tags.bool], color: "var(--syntax-number)" },
  { tag: tags.function(tags.variableName), color: "var(--syntax-function)" },
  { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.operator, color: "var(--muted)" },
  {
    tag: tags.invalid,
    color: "var(--accent)",
    textDecoration: "underline wavy",
  },
]);
export interface EditorProps {
  source: string;
  onChange: (s: string) => void;
  diagnostics?: Diagnostic[];
  selected?: Span;
  line?: number;
  breakpoints: number[];
  onBreakpoint: (line: number) => void;
  onRun: () => void;
}
export function Editor(props: EditorProps) {
  const host = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | undefined>(undefined),
    latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: latest.current.source,
        extensions: [
          basicSetup,
          axiomLanguage,
          syntaxHighlighting(highlighting),
          activeField,
          breakpointField,
          gutter({
            class: "cm-breakpoints",
            renderEmptyElements: true,
            lineMarker: (v, line) =>
              v.state
                .field(breakpointField)
                .includes(v.state.doc.lineAt(line.from).number)
                ? marker
                : null,
            initialSpacer: () => marker,
            domEventHandlers: {
              mousedown: (v, line) => {
                latest.current.onBreakpoint(
                  v.state.doc.lineAt(line.from).number,
                );
                return true;
              },
            },
          }),
          EditorView.contentAttributes.of({
            "aria-label": "Axiom source code",
            spellcheck: "false",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged)
              latest.current.onChange(update.state.doc.toString());
          }),
          keymap.of([
            {
              key: "F9",
              run: (v) => {
                latest.current.onBreakpoint(
                  v.state.doc.lineAt(v.state.selection.main.head).number,
                );
                return true;
              },
            },
            {
              key: "Mod-Enter",
              run: () => {
                latest.current.onRun();
                return true;
              },
            },
            indentWithTab,
          ]),
          autocompletion({
            override: [
              completeFromList(
                [
                  "let",
                  "fn",
                  "return",
                  "if",
                  "else",
                  "while",
                  "number",
                  "string",
                  "boolean",
                  "void",
                  "true",
                  "false",
                  "print",
                ].map((label) => ({
                  label,
                  type: ["print"].includes(label) ? "function" : "keyword",
                })),
              ),
            ],
          }),
          EditorView.theme({
            "&": {
              height: "100%",
              backgroundColor: "var(--editor)",
              color: "var(--text)",
            },
            ".cm-scroller": {
              fontFamily: "var(--mono)",
              fontSize: "13px",
              lineHeight: "1.9",
            },
            ".cm-content": { padding: "20px 0" },
            ".cm-line": { padding: "0 18px 0 12px" },
            ".cm-gutters": {
              backgroundColor: "var(--editor)",
              color: "var(--faint)",
              border: "none",
              paddingLeft: "8px",
            },
            ".cm-activeLineGutter": {
              backgroundColor: "var(--hover)",
              color: "var(--text)",
            },
            ".cm-activeLine": { backgroundColor: "var(--hover)" },
            ".cm-cursor": { borderLeftColor: "var(--accent)" },
            "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
              backgroundColor: "var(--selection)",
            },
            ".cm-tooltip": {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            },
            ".cm-panels": {
              background: "var(--surface)",
              color: "var(--text)",
            },
            ".cm-searchMatch": { background: "var(--selection)" },
            ".cm-foldPlaceholder": {
              background: "var(--surface)",
              color: "var(--muted)",
              border: "none",
            },
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = undefined;
    };
  }, []);
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== props.source)
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: props.source },
      });
  }, [props.source]);
  useEffect(() => {
    const v = view.current;
    if (v)
      v.dispatch({
        effects: [
          activeLine.of(props.line),
          breakpointEffect.of(props.breakpoints),
        ],
      });
  }, [props.line, props.breakpoints]);
  useEffect(() => {
    const v = view.current;
    if (v)
      v.dispatch(
        setDiagnostics(
          v.state,
          (props.diagnostics ?? []).map((d) => ({
            from: Math.min(d.span.start, v.state.doc.length),
            to: Math.min(d.span.end, v.state.doc.length),
            severity: "error",
            message: `${d.code}: ${d.message}`,
          })),
        ),
      );
  }, [props.diagnostics]);
  useEffect(() => {
    const v = view.current,
      s = props.selected;
    if (v && s) {
      const from = Math.min(s.start, v.state.doc.length),
        to = Math.min(s.end, v.state.doc.length);
      v.dispatch({
        selection: { anchor: from, head: to },
        effects: EditorView.scrollIntoView(from, { y: "center" }),
      });
      v.focus();
    }
  }, [props.selected]);
  return <div className="editor-host" ref={host} />;
}
