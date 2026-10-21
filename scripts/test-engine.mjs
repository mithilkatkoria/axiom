import { rustCommand } from "./rust.mjs";
rustCommand(["test", "--manifest-path", "engine/Cargo.toml", "--locked"]);
