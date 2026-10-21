import {
  diagnostic,
  type Binding,
  type Expr,
  type Fn,
  type Node,
  type Program,
  type SemanticInfo,
  type Span,
  type Stmt,
  type Type,
} from "./model";
interface Scope {
  id: number;
  symbols: Map<string, Binding>;
  span: Span;
}
export function analyze(ast: Program): SemanticInfo {
  const info: SemanticInfo = {
    bindings: [],
    references: {},
    types: {},
    functions: Object.create(null),
    diagnostics: [],
  };
  let scopeId = 0,
    globalSlot = 0,
    localSlot = 0;
  let owner = "<main>";
  let expectedReturn: Type | undefined;
  const global: Scope = { id: scopeId++, symbols: new Map(), span: ast.span };
  let scopes: Scope[] = [global];
  const error = (
    stage: "type" | "name",
    code: string,
    message: string,
    node: Node,
  ) => {
    if (info.diagnostics.length < 100)
      info.diagnostics.push(diagnostic(stage, code, message, node.span));
  };
  const match = (actual: Type, expected: Type, node: Node) => {
    if (actual !== expected)
      error(
        "type",
        "T001",
        `Expected '${expected}', received '${actual}'.`,
        node,
      );
  };
  function declare(node: Node & { name: string; type: Type }) {
    const scope = scopes[scopes.length - 1];
    if (scope.symbols.has(node.name))
      error(
        "name",
        "N002",
        `'${node.name}' is already declared in this scope.`,
        node,
      );
    if (node.name === "print" || info.functions[node.name])
      error("name", "N003", `'${node.name}' is reserved for a function.`, node);
    if (node.type === "void")
      error(
        "type",
        "T002",
        "Variables and parameters cannot have type void.",
        node,
      );
    const binding: Binding = {
      id: info.bindings.length,
      name: node.name,
      type: node.type,
      slot: owner === "<main>" ? globalSlot++ : localSlot++,
      global: owner === "<main>",
      scope: scope.id,
      owner,
      span: node.span,
      scopeSpan: scope.span,
    };
    if (binding.slot >= 4096)
      error(
        "type",
        "T003",
        "Variable limit exceeded (4,096 slots per context).",
        node,
      );
    info.bindings.push(binding);
    scope.symbols.set(node.name, binding);
    info.references[node.id] = binding.id;
  }
  function resolve(node: Node & { name: string }): Binding | undefined {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const binding = scopes[i].symbols.get(node.name);
      if (binding) {
        info.references[node.id] = binding.id;
        return binding;
      }
    }
    error(
      "name",
      "N001",
      `Unknown variable '${node.name}'. Declare it before use.`,
      node,
    );
    return undefined;
  }
  function expr(node: Expr): Type {
    let type: Type = "void";
    switch (node.kind) {
      case "Literal":
        type = typeof node.value as "number" | "string" | "boolean";
        break;
      case "Identifier":
        type = resolve(node)?.type ?? "void";
        break;
      case "Unary": {
        const t = expr(node.operand);
        match(t, node.operator === "!" ? "boolean" : "number", node.operand);
        type = node.operator === "!" ? "boolean" : "number";
        break;
      }
      case "Binary": {
        const l = expr(node.left),
          r = expr(node.right);
        if (["&&", "||"].includes(node.operator)) {
          match(l, "boolean", node.left);
          match(r, "boolean", node.right);
          type = "boolean";
        } else if (["==", "!="].includes(node.operator)) {
          if (l === "void" || l !== r)
            error(
              "type",
              "T004",
              "Equality requires two values of the same primitive type.",
              node,
            );
          type = "boolean";
        } else {
          match(l, "number", node.left);
          match(r, "number", node.right);
          type = ["<", "<=", ">", ">="].includes(node.operator)
            ? "boolean"
            : "number";
        }
        break;
      }
      case "Call": {
        const types = node.args.map(expr);
        if (node.name === "print") {
          if (types.length !== 1)
            error(
              "type",
              "T005",
              "print expects exactly one primitive argument.",
              node,
            );
          if (types.includes("void"))
            error("type", "T006", "Cannot print a void value.", node);
          type = "void";
          break;
        }
        const fn = info.functions[node.name];
        if (!fn) {
          error("name", "N004", `Unknown function '${node.name}'.`, node);
          break;
        }
        if (types.length !== fn.params.length)
          error(
            "type",
            "T007",
            `'${node.name}' expects ${fn.params.length} arguments, received ${types.length}.`,
            node,
          );
        types.forEach((t, i) => {
          if (fn.params[i]) match(t, fn.params[i], node.args[i]);
        });
        type = fn.result;
        break;
      }
    }
    info.types[node.id] = type;
    return type;
  }
  function statements(body: Stmt[]): boolean {
    let returned = false;
    for (const s of body) {
      const returns = statement(s);
      returned ||= returns;
    }
    return returned;
  }
  function statement(node: Stmt): boolean {
    switch (node.kind) {
      case "Block": {
        scopes.push({ id: scopeId++, symbols: new Map(), span: node.span });
        const returns = statements(node.body);
        scopes.pop();
        return returns;
      }
      case "Variable": {
        const type = expr(node.value);
        match(type, node.type, node.value);
        declare(node);
        break;
      }
      case "Assignment": {
        const binding = resolve(node),
          type = expr(node.value);
        if (binding) match(type, binding.type, node.value);
        break;
      }
      case "Expression":
        expr(node.value);
        break;
      case "If": {
        match(expr(node.condition), "boolean", node.condition);
        const a = statement(node.then),
          b = node.otherwise ? statement(node.otherwise) : false;
        return a && b;
      }
      case "While":
        match(expr(node.condition), "boolean", node.condition);
        statement(node.body);
        break;
      case "Return": {
        const actual = node.value ? expr(node.value) : "void";
        if (expectedReturn === undefined)
          error(
            "type",
            "T008",
            "return is only valid inside a function.",
            node,
          );
        else match(actual, expectedReturn, node);
        return true;
      }
      case "Function":
        error(
          "type",
          "T009",
          "Nested functions are not supported. Declare functions at the top level.",
          node,
        );
        break;
    }
    return false;
  }
  for (const node of ast.body)
    if (node.kind === "Function") {
      if (info.functions[node.name] || node.name === "print")
        error(
          "name",
          "N005",
          `Function '${node.name}' is already defined or reserved.`,
          node,
        );
      else
        info.functions[node.name] = {
          name: node.name,
          params: node.params.map((p) => p.type),
          result: node.returnType,
          node,
        };
    }
  for (const node of ast.body) if (node.kind !== "Function") statement(node);
  function checkFunction(node: Fn) {
    owner = node.name;
    localSlot = 0;
    expectedReturn = node.returnType;
    scopes = [
      global,
      { id: scopeId++, symbols: new Map(), span: node.body.span },
    ];
    node.params.forEach(declare);
    const returns = statements(node.body.body);
    if (node.returnType !== "void" && !returns)
      error(
        "type",
        "T010",
        `Function '${node.name}' must return '${node.returnType}' on every path.`,
        node,
      );
  }
  for (const node of ast.body)
    if (node.kind === "Function") checkFunction(node);
  return info;
}
