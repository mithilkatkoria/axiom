import { rustCommand } from "./rust.mjs";
rustCommand(["fmt", "--manifest-path", "engine/Cargo.toml", "--", "--check"]);
rustCommand([
  "clippy",
  "--manifest-path",
  "engine/Cargo.toml",
  "--all-targets",
  "--locked",
  "--",
  "-D",
  "warnings",
]);
