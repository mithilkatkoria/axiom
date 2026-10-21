export interface Section {
  title: string;
  text: string;
  code?: string;
}
export interface Article {
  path: string;
  title: string;
  eyebrow: string;
  intro: string;
  sections: Section[];
}
export const articles: Article[] = [
  {
    path: "/language",
    eyebrow: "THE LANGUAGE / v1.0",
    title: "Small language. Clear rules.",
    intro:
      "Axiom has four types, explicit declarations, and a deliberately small vocabulary. Every program follows the same path from source to bytecode.",
    sections: [
      {
        title: "01 / Values and variables",
        text: 'number is a finite IEEE 754 double. string is a double-quoted sequence with \\n, \\r, \\t, \\0, \\" and \\\\ escapes. boolean is true or false. void is a function result with no usable value. let is mutable, requires an initializer, and always keeps its declared type.',
        code: "let age: number = 17;\nage = age + 1;\nprint(age);",
      },
      {
        title: "02 / Expressions",
        text: "From lowest to highest precedence: ||, &&, == and !=, comparisons, + and -, * and / and %, unary ! and -. Binary operators associate left. Arithmetic and ordering require numbers. Equality requires the same primitive type. Boolean operators short circuit. There is no implicit conversion or string concatenation.",
        code: "print(2 + 3 * 4);\nprint(false && (1 / 0 > 0));",
      },
      {
        title: "03 / Control flow",
        text: "if and while conditions must be boolean. Braces introduce lexical scopes. Inner variables may shadow outer variables. Redeclaration in one scope is an error. Semicolons are required. else if is supported.",
        code: "let i: number = 0;\nwhile (i < 5) {\n    print(i);\n    i = i + 1;\n}",
      },
      {
        title: "04 / Functions",
        text: "Named functions are declared at the top level. Signatures are registered before bodies, so forward calls and mutual recursion work. Parameters are passed by value. Every path through a non-void function must return the declared type. A void function can end naturally or use return;.",
        code: "fn factorial(n: number): number {\n    if (n <= 1) { return 1; }\n    return n * factorial(n - 1);\n}\nprint(factorial(5));",
      },
      {
        title: "05 / Output and comments",
        text: "print is reserved and accepts exactly one number, string or boolean. Each call creates one output entry. // starts a line comment; /* and */ delimit a non-nested block comment.",
        code: '// Output is captured by the virtual machine.\nprint("Hello, world!");',
      },
      {
        title: "06 / Errors and boundaries",
        text: "Lexical, syntax, name and type errors prevent bytecode generation. Division by zero, modulo by zero, non-finite arithmetic and uninitialized global reads are runtime errors. Execution is bounded to 100,000 instructions, 128 frames including main, 8,192 operand values, 1,000 output entries and 64,000 output characters. Source is bounded to 100,000 characters and 20,000 tokens. Function values, arrays, closures, imports, classes and host access are intentionally absent.",
      },
    ],
  },
  {
    path: "/learn",
    eyebrow: "FIELD NOTES / A COMPILER IN TEN IDEAS",
    title: "Follow the transformation.",
    intro:
      "A compiler does not understand a program all at once. It builds progressively more useful representations. Open each stage in the studio and compare it with the source.",
    sections: [
      {
        title: "01 / Characters become tokens",
        text: "The lexer walks characters once, recognizes words, numbers and operators, and records exact offsets. A token keeps its spelling as well as its parsed value. Try changing 10 to 10.5 and inspect the Tokens panel.",
        code: "let count: number = 10;",
      },
      {
        title: "02 / Tokens become structure",
        text: "The recursive-descent parser handles statements. A precedence-climbing expression parser gives multiplication a deeper position than addition. Parentheses change that structure. In the AST panel, select a node to reveal its source.",
        code: "print(2 + 3 * 4);",
      },
      {
        title: "03 / Precedence is a parsing decision",
        text: "A minimum binding precedence decides whether an operator belongs inside the current expression. Parsing the right operand at precedence + 1 makes subtraction associate left. Compare the syntax trees for the two expressions.",
        code: "print(10 - 3 - 2);\nprint(10 - (3 - 2));",
      },
      {
        title: "04 / The AST removes surface detail",
        text: "An abstract syntax tree records meaning-bearing structure. Semicolons and comments do not become AST nodes. Each node has a compilation-local identity and a source span. The accessible tree and graph are views of the same parser output.",
      },
      {
        title: "05 / Names belong to scopes",
        text: "A stack of symbol maps resolves names from the innermost scope outward. Every declaration gets a unique storage slot. The two x declarations below therefore have different binding identities.",
        code: "let x: number = 10;\n{ let x: number = 20; print(x); }\nprint(x);",
      },
      {
        title: "06 / Types constrain operations",
        text: "The analyzer recursively assigns expression types. An arithmetic operation requires number on both sides. A variable initializer must have its declared type. This checks consistency before execution; it does not prove that a divisor is nonzero.",
        code: 'let x: number = "wrong";',
      },
      {
        title: "07 / Trees become instructions",
        text: "The compiler emits stack operations in evaluation order. Constants are interned into a pool. Branches are patched to actual instruction addresses. The VM never reads or evaluates source strings.",
        code: "print(2 + 3);",
      },
      {
        title: "08 / The operand stack holds unfinished work",
        text: "PUSH_CONST adds a value. ADD removes the right and left operands and pushes their sum. PRINT captures the result and pushes a void sentinel, which the expression statement discards. Step one instruction at a time and inspect the stack.",
      },
      {
        title: "09 / Calls create frames",
        text: "CALL pops arguments into new local slots, saves the return address and remembers the caller stack height. RETURN restores that height and pushes one result. Recursive calls have independent slots, even when their variable names match.",
        code: "fn f(n: number): number {\n    if (n <= 1) { return 1; }\n    return n * f(n - 1);\n}\nprint(f(4));",
      },
      {
        title: "10 / Debugging observes real state",
        text: "The debugger controls the same VM used for normal execution. A snapshot includes the instruction pointer, operand stack, frames, globals, output and a bounded trace. Source stepping uses line changes and call depth. It cannot undo instructions. Add a breakpoint in factorial and inspect n in each frame.",
      },
    ],
  },
  {
    path: "/architecture",
    eyebrow: "ENGINEERING / UNDER THE SURFACE",
    title: "One engine. Every view.",
    intro:
      "A Rust compiler and stack virtual machine run as WebAssembly inside browser workers. TypeScript connects that engine to the React interface, which renders versioned snapshots and real compiler results.",
    sections: [
      {
        title: "01 / The compilation pipeline",
        text: "source → tokenize → parse → analyze → compile → bytecode. engine/src/lib.rs orchestrates the Rust stages, tracks timings, applies a tree-depth limit, and prevents compilation after diagnostics. src/language/ provides typed UI adapters. Each stage returns data, not display markup.",
      },
      {
        title: "02 / Structure and names",
        text: "model.rs defines typed Rust syntax enums and spans. lexer.rs scans UTF-16 positions. parser.rs combines recursive descent with precedence climbing. semantic.rs registers function signatures, resolves scoped bindings, assigns expression types, and checks conservative return paths.",
      },
      {
        title: "03 / Bytecode and execution",
        text: "bytecode.rs lowers checked syntax to 25 numeric opcodes, a constant pool, function entries and source maps. vm.rs owns tagged primitive values, local and global slots, recursive frames, instruction budgets, snapshots and stepping. No eval, dynamic JavaScript functions or host imports are available to Axiom programs.",
      },
      {
        title: "04 / Worker protocol",
        text: "execution.worker.ts initializes the Rust WebAssembly module and accepts versioned compile, run, pause, reset and step requests. Rust retains the live VM; TypeScript schedules its batches. Execution yields every 1,500 instructions so pause messages can be handled. Stop terminates the worker. Every source change invalidates its generation; late responses are ignored. Editing never mixes new source with old runtime state.",
      },
      {
        title: "05 / Trade-offs",
        text: "A stack VM makes intermediate values visible but executes more instructions than a register VM might. Unique variable slots simplify shadowing but retain storage until a frame returns. Source stepping is based on lines, so several statements on one line form one source step. Large AST graphs display a bounded prefix; the full text tree remains available.",
      },
      {
        title: "06 / What is and is not guaranteed",
        text: "The tests cover concrete semantics and safety boundaries. They are evidence, not a formal proof of soundness. Compilation and execution happen locally in your browser. Local storage retains source and preferences; no account or external execution service is used. Fonts are bundled with the site, so no font service receives requests.",
      },
    ],
  },
];
