import { homedir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { rustCommand } from "./rust.mjs";
import { engineRoot, sourceHash, bytesHash } from "./engine-manifest.mjs";
const flags = [
  "--remap-path-prefix=" + homedir() + "=/user",
  "--remap-path-prefix=" + homedir().replaceAll("\\", "/") + "=/user",
  "--remap-path-prefix=" + process.cwd() + "=/axiom",
  "--remap-path-prefix=" + process.cwd().replaceAll("\\", "/") + "=/axiom",
  "-C",
  "link-arg=-z",
  "-C",
  "link-arg=stack-size=8388608",
  "-C",
  "link-arg=--max-memory=268435456",
];
rustCommand(
  [
    "build",
    "--manifest-path",
    "engine/Cargo.toml",
    "--locked",
    "--release",
    "--target",
    "wasm32-unknown-unknown",
  ],
  {
    CARGO_ENCODED_RUSTFLAGS: flags.join("\x1f"),
  },
);
const bytes = await readFile(
  new URL(
    "target/wasm32-unknown-unknown/release/axiom_engine.wasm",
    engineRoot,
  ),
);
await mkdir(new URL("pkg/", engineRoot), { recursive: true });
await writeFile(new URL("pkg/axiom_engine.wasm", engineRoot), bytes);
await writeFile(
  new URL("pkg/manifest.json", engineRoot),
  JSON.stringify(
    {
      abi: 1,
      source: await sourceHash(),
      wasm: bytesHash(bytes),
      bytes: bytes.length,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Built Rust engine: " +
    bytes.length +
    " bytes. Source and binary digests recorded.",
);
