import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
export const engineRoot = new URL("../engine/", import.meta.url);
export async function sourceHash() {
  const files = [
    "Cargo.toml",
    "Cargo.lock",
    "../scripts/build-engine.mjs",
    "../scripts/engine-manifest.mjs",
    ...(await readdir(new URL("src/", engineRoot)))
      .filter((file) => file.endsWith(".rs"))
      .map((file) => "src/" + file),
  ].sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file + "\0");
    hash.update(
      (await readFile(new URL(file, engineRoot), "utf8")).replaceAll(
        "\r\n",
        "\n",
      ),
    );
  }
  return hash.digest("hex");
}
export function bytesHash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
