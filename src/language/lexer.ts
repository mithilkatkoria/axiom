import { diagnostic, origin, type Diagnostic, type Token } from "./model";
const keywords = new Set([
  "let",
  "fn",
  "if",
  "else",
  "while",
  "return",
  "true",
  "false",
  "number",
  "string",
  "boolean",
  "void",
]);
export function tokenize(source: string): {
  tokens: Token[];
  diagnostics: Diagnostic[];
} {
  const tokens: Token[] = [],
    diagnostics: Diagnostic[] = [];
  if (source.length > 100_000)
    return {
      tokens,
      diagnostics: [
        diagnostic(
          "lexical",
          "L000",
          "Source exceeds the 100,000 character limit.",
          origin,
        ),
      ],
    };
  let i = 0,
    line = 1,
    column = 1;
  const advance = () => {
    if (i >= source.length) return "";
    const c = source[i++];
    if (c === "\n") {
      line++;
      column = 1;
    } else column++;
    return c;
  };
  while (i < source.length && diagnostics.length < 100) {
    const c = source[i];
    if (/\s/.test(c)) {
      advance();
      continue;
    }
    const start = i,
      ln = line,
      col = column;
    const span = () => ({ start, end: i, line: ln, column: col });
    const error = (code: string, message: string) =>
      diagnostics.push(diagnostic("lexical", code, message, span()));
    if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") advance();
      continue;
    }
    if (c === "/" && source[i + 1] === "*") {
      advance();
      advance();
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/"))
        advance();
      if (i === source.length)
        error("L001", "Unterminated block comment. Add */.");
      else {
        advance();
        advance();
      }
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      while (i < source.length && /[a-zA-Z0-9_]/.test(source[i])) advance();
      const lexeme = source.slice(start, i);
      tokens.push({
        ...span(),
        kind: keywords.has(lexeme) ? "keyword" : "identifier",
        lexeme,
      });
    } else if (/[0-9]/.test(c)) {
      while (i < source.length && /[0-9]/.test(source[i])) advance();
      if (source[i] === "." && /[0-9]/.test(source[i + 1] ?? "")) {
        advance();
        while (i < source.length && /[0-9]/.test(source[i])) advance();
      }
      if (source[i] === "e" || source[i] === "E") {
        advance();
        if (source[i] === "+" || source[i] === "-") advance();
        const exponentStart = i;
        while (i < source.length && /[0-9]/.test(source[i])) advance();
        if (i === exponentStart)
          error("L002", "Expected digits after the exponent.");
      }
      const lexeme = source.slice(start, i),
        literal = Number(lexeme);
      if (!Number.isFinite(literal))
        error("L003", "Number literal must be finite.");
      tokens.push({ ...span(), kind: "number", lexeme, literal });
    } else if (c === '"') {
      advance();
      let literal = "",
        closed = false;
      while (i < source.length) {
        const ch = advance();
        if (ch === '"') {
          closed = true;
          break;
        }
        if (ch === "\n" || ch === "\r") {
          error("L004", "String literals cannot cross a line. Use \\n.");
          break;
        }
        if (ch === "\\") {
          const esc = advance();
          const escapes: Record<string, string> = {
            n: "\n",
            r: "\r",
            t: "\t",
            '"': '"',
            "\\": "\\",
            "0": "\0",
          };
          if (esc in escapes) literal += escapes[esc];
          else error("L005", `Unsupported escape sequence \\${esc ?? ""}.`);
        } else literal += ch;
      }
      if (!closed)
        error("L006", "Unterminated string literal. Add a closing quote.");
      tokens.push({
        ...span(),
        kind: "string",
        lexeme: source.slice(start, i),
        literal,
      });
    } else {
      const pair = source.slice(i, i + 2);
      if (["==", "!=", "<=", ">=", "&&", "||"].includes(pair)) {
        advance();
        advance();
        tokens.push({ ...span(), kind: "operator", lexeme: pair });
      } else if ("+-*/%!=<>".includes(c)) {
        advance();
        tokens.push({ ...span(), kind: "operator", lexeme: c });
      } else if ("(){}:;,".includes(c)) {
        advance();
        tokens.push({ ...span(), kind: "punctuation", lexeme: c });
      } else {
        advance();
        error("L007", `Unexpected character '${c}'.`);
      }
    }
    if (tokens.length > 20_000) {
      error("L008", "Token limit exceeded (20,000).");
      break;
    }
  }
  tokens.push({
    kind: "eof",
    lexeme: "",
    start: source.length,
    end: source.length,
    line,
    column,
  });
  return { tokens, diagnostics };
}
