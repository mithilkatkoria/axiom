# Experiments

## Research question

How does a stack-based bytecode VM behave as program complexity increases, and which implementation choices most affect execution performance?

## Hypotheses

1. Loop instruction counts grow approximately linearly with iteration count when the loop body has fixed work.
2. Naive recursive Fibonacci grows far faster than iterative Fibonacci for the same n, due to repeated calls and repeated subproblems.
3. Recording a bounded trace and making snapshots have measurable cost, independent of arithmetic cost.
4. Replacing dynamically searched environment names with statically resolved slots reduces runtime lookup work, but a fair test requires a separate implementation with identical semantics.

Only the first two can be investigated directly by varying this version's inputs. The others require controlled implementation variants; they are hypotheses, not measured conclusions.

## Inputs

`src/benchmarks.ts` contains arithmetic loops, nested loops, repeated function calls, recursive Fibonacci, iterative Fibonacci, variable-heavy loops and condition-heavy loops. Each includes an expected output. Browser measurements validate that output before retaining a sample. All seven inputs also run as Vitest tests.

## Browser procedure

1. Open `/experiments`, record browser version and device/power state, and close avoidable heavy background work.
2. Choose Run benchmarks. Each input receives two warm-up compilation/execution runs and ten measured compilation/execution runs in a dedicated worker.
3. Report compile median, execution median, execution min/max, instruction count, maximum operand depth and maximum frame depth. Frame depth includes main. Times use performance.now(); the median averages the middle two sorted values.
4. Export JSON. It contains timestamp, user agent, actual Rust/WebAssembly engine identity, methodology, measured records and exact source inputs. No measurements are pre-populated, silently fetched or invented.
5. Repeat at least five times. Compare distributions rather than one fastest observation.

The default recursive and iterative Fibonacci inputs intentionally have different sizes to keep the demonstration useful. They are not a matched performance comparison. Set both to the same n for that experiment.

## Node procedure

```sh
npm ci
npm run benchmark
```

`tests/benchmark.test.ts` compiles each input, warms execution twice and measures ten VM executions. It validates every output and prints environment, samples, median/range and instruction counts. This Node command measures calls into the Wasm VM after compilation, including adapter and result serialization overhead; it does not claim to measure the browser worker transport. Browser and Node outputs must be labeled separately.

## What timing includes

Browser execution duration is measured inside Rust with the imported performance.now clock, excluding JSON result encoding and transfer. Node wrapper timings include boundary costs and are a different measurement. Execution timing includes instruction dispatch, safety checks, captured output and a bounded trace maintained with array operations. It does not include drawing the React UI. Browser compilation is timed by the actual compiler stages. The worker measurement loop does not take a full snapshot after each instruction. Studio execution sends snapshots per chunk, so its elapsed time and wall-clock latency measure different things.

## Limits

Timer resolution can make tiny measurements quantized or zero. JIT, garbage collection, browser scheduling, thermal/power state and other applications matter. Never call this VM faster than another language based on these samples. Tests support output and count consistency; no statistically significant cross-implementation result is claimed. Store raw exported JSON with any future report so another student can reproduce the input and method.

## Implementation version

Current measurements use Rust/WebAssembly. Historical TypeScript timings remain historical evidence. A preserved reference exists for semantic comparisons; performance comparisons must match inputs, warm-up, transport, trace and timer boundaries. No speedup is claimed.
