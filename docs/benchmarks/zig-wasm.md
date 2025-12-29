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

## Run

```bash
bun run wasm:snippets
bun run perf:wasm
```

## Latest results (2025-12-28)

```
[bench] medium scan: wasm 3.74ms vs js 29.18ms (7.80x)
[bench] medium hash: wasm 3.43ms vs js 4.97ms (1.45x)
[bench] medium combined: wasm 1.14ms vs js 8.10ms (7.11x)
[bench] medium security scan: wasm 1.97ms vs js 13.85ms (7.02x)
[bench] medium inspect index: wasm 5.05ms vs js 8.61ms (1.71x)
[bench] medium worker roundtrip: 38.14ms for 20 iters (1.91ms/iter)
[bench] heavy scan: wasm 3.16ms vs js 23.27ms (7.37x)
[bench] heavy hash: wasm 5.57ms vs js 5.51ms (0.99x)
[bench] heavy combined: wasm 2.01ms vs js 13.38ms (6.67x)
[bench] heavy security scan: wasm 1.83ms vs js 12.71ms (6.95x)
[bench] heavy inspect index: wasm 3.30ms vs js 7.69ms (2.33x)
[bench] heavy worker roundtrip: 16.27ms for 6 iters (2.71ms/iter)
```

Notes:
- Results depend on machine and workload. Re-run after major changes.
- WASM scan is the primary win; hash is roughly parity with JS.
