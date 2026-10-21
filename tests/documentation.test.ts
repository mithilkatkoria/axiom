import { describe, expect, it } from "vitest";
import { articles } from "../src/content";
import { build, executeProgram } from "../src/language";
const expected: Record<string, Record<number, string[] | "type">> = {
  "/language": {
    0: ["18"],
    1: ["14", "false"],
    2: ["0", "1", "2", "3", "4"],
    3: ["120"],
    4: ["Hello, world!"],
  },
  "/learn": {
    0: [],
    1: ["14"],
    2: ["5", "9"],
    4: ["20", "10"],
    5: "type",
    6: ["5"],
    8: ["24"],
  },
};
describe("every executable public documentation snippet", () => {
  for (const article of articles)
    article.sections.forEach((section, index) => {
      if (!section.code) return;
      it(`${article.path}: ${section.title}`, () => {
        const outcome = expected[article.path]?.[index];
        expect(outcome).toBeDefined();
        const c = build(section.code!);
        if (outcome === "type") {
          expect(c.diagnostics.some((d) => d.stage === "type")).toBe(true);
          expect(c.program).toBeUndefined();
        } else {
          expect(c.diagnostics).toEqual([]);
          const result = executeProgram(c.program!);
          expect(result.status).toBe("completed");
          expect(result.output).toEqual(outcome);
        }
      });
    });
});
