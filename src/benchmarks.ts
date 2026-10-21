export interface BenchmarkInput {
  name: string;
  source: string;
  expected: string[];
}
export const benchmarks: BenchmarkInput[] = [
  {
    name: "Arithmetic loop / 1,000",
    source:
      "let i:number=0;let s:number=0;while(i<1000){s=s+i;i=i+1;}print(s);",
    expected: ["499500"],
  },
  {
    name: "Nested loops / 20 × 20",
    source:
      "let i:number=0;let n:number=0;while(i<20){let j:number=0;while(j<20){n=n+1;j=j+1;}i=i+1;}print(n);",
    expected: ["400"],
  },
  {
    name: "Function calls / 500",
    source:
      "fn inc(n:number):number{return n+1;}let i:number=0;while(i<500){i=inc(i);}print(i);",
    expected: ["500"],
  },
  {
    name: "Recursive Fibonacci / 12",
    source:
      "fn fib(n:number):number{if(n<=1){return n;}return fib(n-1)+fib(n-2);}print(fib(12));",
    expected: ["144"],
  },
  {
    name: "Iterative Fibonacci / 20",
    source:
      "let a:number=0;let b:number=1;let i:number=0;while(i<20){let next:number=a+b;a=b;b=next;i=i+1;}print(a);",
    expected: ["6765"],
  },
  {
    name: "Variable access / 1,000",
    source:
      "let a:number=1;let b:number=2;let i:number=0;while(i<1000){a=b;b=a;i=i+1;}print(a);",
    expected: ["2"],
  },
  {
    name: "Conditional branches / 500",
    source:
      "let i:number=0;let n:number=0;while(i<500){if(i%2==0){n=n+1;}else{n=n-1;}i=i+1;}print(n);",
    expected: ["0"],
  },
];
export interface Measurement {
  name: string;
  compileMs: number;
  executeMs: number;
  minMs: number;
  maxMs: number;
  steps: number;
  maxStack: number;
  maxDepth: number;
  samples: number;
}
