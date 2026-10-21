import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], setupFiles: ["tests/setup.ts"] },
  worker: { format: "es" },
  server: { port: 5178, strictPort: true },
  preview: { port: 5178, strictPort: true },
});
