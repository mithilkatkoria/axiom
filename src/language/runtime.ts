import wasmUrl from "../../engine/pkg/axiom_engine.wasm?url";
interface EngineExports {
  memory: WebAssembly.Memory;
  axiom_alloc(length: number): number;
  axiom_dealloc(pointer: number, length: number): void;
  axiom_dispatch(pointer: number, length: number): number;
  axiom_output_len(): number;
}
export interface EngineIdentity {
  language: "Rust";
  runtime: "WebAssembly";
  abi: number;
  version: string;
}
let engine: EngineExports | undefined;
let loading: Promise<void> | undefined;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export function initializeEngine(bytes?: BufferSource): Promise<void> {
  if (engine) return Promise.resolve();
  loading ??= (async () => {
    if (!bytes) {
      const response = await fetch(wasmUrl);
      if (!response.ok)
        throw new Error(
          "Could not load Axiom's WebAssembly engine (" +
            response.status +
            ").",
        );
      bytes = await response.arrayBuffer();
    }
    const result = await WebAssembly.instantiate(bytes, {
      env: { now: () => performance.now() },
    });
    engine = result.instance.exports as unknown as EngineExports;
    const identity = callRust<EngineIdentity>("identity");
    if (
      identity.language !== "Rust" ||
      identity.runtime !== "WebAssembly" ||
      identity.abi !== 1
    )
      throw new Error("Unsupported Axiom engine ABI.");
  })();
  return loading;
}
/** Copy JSON through a checked Wasm allocation. No Axiom execution happens in this adapter. */
export function callRust<T>(
  action: string,
  fields: Record<string, unknown> = {},
): T {
  if (!engine)
    throw new Error(
      "Initialize the Rust/WebAssembly engine before using the compiler.",
    );
  const input = encoder.encode(JSON.stringify({ action, ...fields }));
  const pointer = engine.axiom_alloc(input.length);
  try {
    new Uint8Array(engine.memory.buffer, pointer, input.length).set(input);
    const output = engine.axiom_dispatch(pointer, input.length);
    const length = engine.axiom_output_len();
    const response: unknown = JSON.parse(
      decoder.decode(new Uint8Array(engine.memory.buffer, output, length)),
    );
    if (response && typeof response === "object" && "error" in response)
      throw new Error(String(response.error));
    return response as T;
  } finally {
    engine.axiom_dealloc(pointer, input.length);
  }
}
