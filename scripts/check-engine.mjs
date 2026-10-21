import { readFile } from "node:fs/promises";
import { engineRoot, sourceHash, bytesHash } from "./engine-manifest.mjs";
const manifest = JSON.parse(
  await readFile(new URL("pkg/manifest.json", engineRoot), "utf8"),
);
const bytes = await readFile(new URL("pkg/axiom_engine.wasm", engineRoot));
if (
  manifest.abi !== 1 ||
  manifest.source !== (await sourceHash()) ||
  manifest.wasm !== bytesHash(bytes)
)
  throw new Error(
    "Rust sources or engine binary changed. Run npm run engine:build and commit the engine artifact.",
  );
if (!WebAssembly.validate(bytes))
  throw new Error("The engine artifact is not valid WebAssembly.");
console.log("Rust/WebAssembly source and artifact integrity verified.");

const imports = WebAssembly.Module.imports(new WebAssembly.Module(bytes));
if (
  imports.some(
    (item) =>
      item.module !== "env" || item.name !== "now" || item.kind !== "function",
  )
)
  throw new Error("Unexpected WebAssembly host capability.");
