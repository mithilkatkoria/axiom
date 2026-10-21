export interface Example {
  id: string;
  title: string;
  category: string;
  description: string;
  source: string;
  output?: string[];
  error?: string;
}
export const examples: Example[] = [
  {
    id: "factorial",
    title: "Factorial",
    category: "Recursion",
    description: "Follow a value down the call stack and back again.",
    source: `// A small function. A deeper story.
fn factorial(n: number): number {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}

let result: number = factorial(5);
print(result);`,
    output: ["120"],
  },
  {
    id: "hello",
    title: "Hello, Axiom",
    category: "Getting started",
    description: "Your first instruction to the machine.",
    source: 'print("Hello, world!");',
    output: ["Hello, world!"],
  },
  {
    id: "arithmetic",
    title: "Order of operations",
    category: "Expressions",
    description: "Multiplication binds more tightly than addition.",
    source: "print(2 + 3 * 4);\nprint((2 + 3) * 4);\nprint(-10 % 3);",
    output: ["14", "20", "-1"],
  },
  {
    id: "variables",
    title: "Values that change",
    category: "Variables",
    description: "let is mutable. Its type stays fixed.",
    source: "let count: number = 10;\ncount = count + 20;\nprint(count);",
    output: ["30"],
  },
  {
    id: "boolean",
    title: "True or false",
    category: "Expressions",
    description: "Boolean operators require boolean values.",
    source: "print(!(5 > 10) && true);\nprint(3 != 4);",
    output: ["true", "true"],
  },
  {
    id: "conditional",
    title: "A fork in the road",
    category: "Control flow",
    description: "A condition selects a branch of instructions.",
    source:
      'let temperature: number = 32;\nif (temperature > 30) {\n    print("Hot");\n} else {\n    print("Normal");\n}',
    output: ["Hot"],
  },
  {
    id: "loop",
    title: "Around again",
    category: "Control flow",
    description: "A backward jump turns instructions into repetition.",
    source:
      "let i: number = 0;\nwhile (i < 5) {\n    print(i);\n    i = i + 1;\n}",
    output: ["0", "1", "2", "3", "4"],
  },
  {
    id: "functions",
    title: "Two become one",
    category: "Functions",
    description: "Arguments become local slots in a new frame.",
    source:
      "fn add(a: number, b: number): number {\n    return a + b;\n}\nprint(add(10, 20));",
    output: ["30"],
  },
  {
    id: "fibonacci",
    title: "Fibonacci",
    category: "Recursion",
    description: "Two recursive calls, one growing call tree.",
    source:
      "fn fib(n: number): number {\n    if (n <= 1) { return n; }\n    return fib(n - 1) + fib(n - 2);\n}\nprint(fib(8));",
    output: ["21"],
  },
  {
    id: "scope",
    title: "Same name, different scope",
    category: "Variables",
    description: "An inner declaration shadows the outer binding.",
    source:
      "let x: number = 10;\nif (true) {\n    let x: number = 20;\n    print(x);\n}\nprint(x);",
    output: ["20", "10"],
  },
  {
    id: "syntax-error",
    title: "An unfinished expression",
    category: "Diagnostics",
    description: "The parser needs an operand after +.",
    source: "let x: number = (10 + );",
    error: "syntax",
  },
  {
    id: "type-error",
    title: "A type mismatch",
    category: "Diagnostics",
    description: "The type checker rejects this before execution.",
    source: 'let age: number = "seventeen";',
    error: "type",
  },
  {
    id: "runtime-error",
    title: "Divide by zero",
    category: "Diagnostics",
    description: "Well-typed code can still fail at runtime.",
    source: "let divisor: number = 0;\nprint(10 / divisor);",
    error: "runtime",
  },
  {
    id: "infinite",
    title: "The loop that never ends",
    category: "Safety",
    description: "An instruction budget stops this program safely.",
    source:
      "while (true) {\n    // The worker stays isolated from the interface.\n}",
    error: "budget",
  },
  {
    id: "short-circuit",
    title: "The path not taken",
    category: "Expressions",
    description: "The right operand is never evaluated.",
    source: "print(false && (1 / 0 > 0));\nprint(true || (1 / 0 > 0));",
    output: ["false", "true"],
  },
];
export const starter = examples[0];
