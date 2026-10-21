import { readFile } from "node:fs/promises";
import { initializeEngine } from "../src/language/runtime";
await initializeEngine(
  new Uint8Array(
    await readFile(new URL("../engine/pkg/axiom_engine.wasm", import.meta.url)),
  ),
);
