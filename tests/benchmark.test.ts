import { describe, it, expect } from "vitest";
import { benchmarks } from "../src/benchmarks";
import { build, executeProgram } from "../src/language";
describe("repeatable benchmark inputs", () => {
  for (const input of benchmarks)
    it(input.name, () => {
      const compilation = build(input.source);
      expect(compilation.diagnostics).toEqual([]);
      for (let i = 0; i < 2; i++) executeProgram(compilation.program!);
      const samples: number[] = [];
      let steps = 0;
      for (let i = 0; i < 10; i++) {
        const result = executeProgram(compilation.program!);
        expect(result.status).toBe("completed");
        expect(result.output).toEqual(input.expected);
        samples.push(result.elapsedMs);
        steps = result.steps;
      }
      const sorted = [...samples].sort((a, b) => a - b);
      console.info(
        JSON.stringify({
          program: input.name,
          environment: `Node ${process.version} / ${process.platform} / ${process.arch}`,
          samples: 10,
          executionMedianMs: (sorted[4] + sorted[5]) / 2,
          minMs: sorted[0],
          maxMs: sorted[9],
          steps,
        }),
      );
    });
});
