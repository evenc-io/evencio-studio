# Zig/WASM — Implementation and Benchmarks

## Why Zig/WASM in the snippet editor

The snippet editor performs repeated, CPU‑bound work while users type:

- Scanning JSX for Tailwind class candidates.
- Hashing source to drive caches and invalidation.
- Preparing data for preview compilation and inspection.

Doing this in JavaScript proved too slow on large snippets because it competes
with Monaco and React on the main thread, causing keystroke latency and preview
jank. Zig compiled to WASM solves that by keeping the hot path small, predictable,
GC‑free, and fast.

## What moved to WASM

- Tailwind class scanning (`scan_tailwind_candidates`).
- Source hashing (`hash_bytes`).
- Snippet security scanning (imports, banned globals, dynamic calls).
- JSX inspect indexing for preview highlighting.
- Snippet file scanning (`scan_snippet_files`) for `@snippet-file` blocks, nested `@import` expansion, and line-map segments.

These are deterministic, CPU‑bound kernels with tight loops — ideal for WASM.

## Integration

- Zig source: `scripts/wasm/snippet_wasm.zig`
- WASM binary: `src/lib/wasm/snippet_wasm.wasm`
- JS bridge: `src/lib/wasm/snippet-wasm.ts`
- Engine analysis: `src/lib/snippets/analyze-tsx.ts`

The analysis pipeline **requires WASM in the browser**. If the WASM binary is
missing, analysis fails fast with an explicit error so the issue is surfaced
immediately rather than silently falling back to slower JS.

## What improves

- Tailwind scanning latency drops by ~8–9x on medium/heavy sources in the
  current benchmark suite.
- Combined scan+hash work stays inside the debounce budget, keeping previews
  responsive even during fast edits.
- CPU usage is lower and more consistent, with fewer long GC pauses.
- Snippet file scanning improves on heavier, multi-file sources; smaller sources can be faster in JS because the WASM boundary adds fixed overhead.

## Run

```bash
bun run wasm:snippets
bun run perf:wasm
```

## Latest results (2025-12-29)

Machine: MacBook M4 Max (36GB RAM)

```
[bench] medium scan: wasm 2.78ms vs js 29.68ms (10.66x)
[bench] medium hash: wasm 3.43ms vs js 4.83ms (1.41x)
[bench] medium combined: wasm 0.77ms vs js 8.30ms (10.84x)
[bench] medium security scan: wasm 1.60ms vs js 12.50ms (7.80x)
[bench] medium inspect index: wasm 3.61ms vs js 11.46ms (3.17x)
[bench] medium snippet files: wasm 0.65ms vs js 0.25ms (0.38x)
[bench] medium worker roundtrip: 21.93ms for 20 iters (1.10ms/iter)
[bench] heavy scan: wasm 2.09ms vs js 21.29ms (10.18x)
[bench] heavy hash: wasm 5.28ms vs js 5.47ms (1.03x)
[bench] heavy combined: wasm 1.31ms vs js 13.64ms (10.41x)
[bench] heavy security scan: wasm 1.27ms vs js 11.76ms (9.27x)
[bench] heavy inspect index: wasm 3.87ms vs js 6.50ms (1.68x)
[bench] heavy snippet files: wasm 0.26ms vs js 0.36ms (1.37x)
[bench] large snippet files: wasm 0.34ms vs js 0.33ms (0.97x)
[bench] heavy worker roundtrip: 7.81ms for 6 iters (1.30ms/iter)
```

Notes:
- Results depend on machine and workload. Re-run after major changes.
- WASM scan is the primary win; hash is roughly parity with JS.
