import {
  diagnostic,
  origin,
  type Block,
  type Diagnostic,
  type Expr,
  type Fn,
  type Parameter,
  type Program,
  type Span,
  type Stmt,
  type Token,
  type Type,
} from "./model";
class ParseError extends Error {}
const precedence: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};
export function parse(tokens: Token[]): {
  ast?: Program;
  diagnostics: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  let pos = 0,
    id = 0,
    depth = 0;
  const current = () => tokens[pos] ?? tokens[tokens.length - 1];
  const is = (s: string) => current()?.lexeme === s;
  const take = () => tokens[pos++];
  function fail(message: string): never {
    diagnostics.push(
      diagnostic("syntax", "P001", message, current() ?? origin),
    );
    throw new ParseError(message);
  }
  function expect(s: string) {
    if (!is(s))
      fail(`Expected '${s}', found '${current()?.lexeme || "end of file"}'.`);
    return take();
  }
  function identifier() {
    if (current()?.kind !== "identifier") fail("Expected an identifier.");
    return take();
  }
  function typeName(): Type {
    const t = current()?.lexeme;
    if (t !== "number" && t !== "string" && t !== "boolean" && t !== "void")
      fail("Expected a type: number, string, boolean or void.");
    take();
    return t;
  }
  const span = (start: Span): Span => ({
    ...start,
    end: tokens[Math.max(0, pos - 1)]?.end ?? start.end,
  });
  function guarded<T>(f: () => T): T {
    if (++depth > 128) fail("Syntax nesting exceeds the limit of 128.");
    try {
      return f();
    } finally {
      depth--;
    }
  }
  function primary(): Expr {
    return guarded(() => {
      const t = current();
      if (is("-") || is("!")) {
        take();
        return {
          kind: "Unary",
          id: ++id,
          operator: t.lexeme,
          operand: primary(),
          span: span(t),
        };
      }
      if (is("(")) {
        take();
        const expr = expression();
        expect(")");
        return expr;
      }
      if (
        t?.kind === "number" ||
        t?.kind === "string" ||
        is("true") ||
        is("false")
      ) {
        take();
        return {
          kind: "Literal",
          id: ++id,
          value: t.literal ?? t.lexeme === "true",
          span: t,
        };
      }
      if (t?.kind === "identifier") {
        take();
        if (is("(")) {
          take();
          const args: Expr[] = [];
          if (!is(")")) {
            do {
              args.push(expression());
              if (!is(",")) break;
              take();
            } while (true);
          }
          expect(")");
          return {
            kind: "Call",
            name: t.lexeme,
            args,
            id: ++id,
            span: span(t),
          };
        }
        return { kind: "Identifier", name: t.lexeme, id: ++id, span: t };
      }
      return fail("Expected an expression.");
    });
  }
  function expression(min = 1): Expr {
    return guarded(() => {
      let left = primary();
      while ((precedence[current()?.lexeme] ?? 0) >= min) {
        const operator = take().lexeme;
        const right = expression(precedence[operator] + 1);
        left = {
          kind: "Binary",
          id: ++id,
          operator,
          left,
          right,
          span: { ...left.span, end: right.span.end },
        };
      }
      return left;
    });
  }
  function block(): Block {
    return guarded(() => {
      const t = expect("{");
      const body: Stmt[] = [];
      while (!is("}") && current()?.kind !== "eof") body.push(statement());
      expect("}");
      return { kind: "Block", id: ++id, body, span: span(t) };
    });
  }
  function statement(): Stmt {
    return guarded(() => {
      const t = current();
      if (is("{")) return block();
      if (is("let")) {
        take();
        const name = identifier().lexeme;
        expect(":");
        const type = typeName();
        expect("=");
        const value = expression();
        expect(";");
        return { kind: "Variable", name, type, value, id: ++id, span: span(t) };
      }
      if (is("fn")) {
        take();
        const name = identifier().lexeme;
        expect("(");
        const params: Parameter[] = [];
        if (!is(")")) {
          do {
            const p = identifier();
            expect(":");
            const type = typeName();
            params.push({
              kind: "Parameter",
              id: ++id,
              name: p.lexeme,
              type,
              span: span(p),
            });
            if (!is(",")) break;
            take();
          } while (true);
        }
        expect(")");
        expect(":");
        const returnType = typeName();
        const body = block();
        const fn: Fn = {
          kind: "Function",
          id: ++id,
          name,
          params,
          returnType,
          body,
          span: span(t),
        };
        return fn;
      }
      if (is("if")) {
        take();
        expect("(");
        const condition = expression();
        expect(")");
        const then = block();
        let otherwise: Stmt | undefined;
        if (is("else")) {
          take();
          otherwise = is("if") ? statement() : block();
        }
        return {
          kind: "If",
          id: ++id,
          condition,
          then,
          otherwise,
          span: span(t),
        };
      }
      if (is("while")) {
        take();
        expect("(");
        const condition = expression();
        expect(")");
        const body = block();
        return { kind: "While", id: ++id, condition, body, span: span(t) };
      }
      if (is("return")) {
        take();
        const value = is(";") ? undefined : expression();
        expect(";");
        return { kind: "Return", id: ++id, value, span: span(t) };
      }
      if (t?.kind === "identifier" && tokens[pos + 1]?.lexeme === "=") {
        take();
        take();
        const value = expression();
        expect(";");
        return {
          kind: "Assignment",
          id: ++id,
          name: t.lexeme,
          value,
          span: span(t),
        };
      }
      const value = expression();
      expect(";");
      return { kind: "Expression", id: ++id, value, span: span(t) };
    });
  }
  const body: Stmt[] = [];
  while (current()?.kind !== "eof" && current() && diagnostics.length < 100) {
    const before = pos;
    try {
      body.push(statement());
    } catch (error) {
      if (!(error instanceof ParseError)) throw error;
      while (
        current()?.kind !== "eof" &&
        !is(";") &&
        !["let", "fn", "if", "while", "return"].includes(current()?.lexeme)
      )
        take();
      if (is(";") || pos === before) take();
    }
  }
  return {
    ast: {
      kind: "Program",
      id: ++id,
      body,
      span: { ...origin, end: current()?.end ?? 0 },
    },
    diagnostics,
  };
}
