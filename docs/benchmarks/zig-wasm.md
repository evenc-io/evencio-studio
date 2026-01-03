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
- JSX component tree scanning for the snippet editor panel.
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

## Dev benchmark page

For browser-only timings (including real worker roundtrips), open `/benchmarks/wasm` while
running `bun run dev`. This route is dev-only so we do not ship internal tooling in
production builds or expose benchmark surfaces to end users.

## Latest results (2026-01-03)

Machine: MacBook M4 Max (36GB RAM)

```
[bench] medium scan: wasm 2.68ms vs js 29.26ms (10.91x)
[bench] medium hash: wasm 3.38ms vs js 4.73ms (1.40x)
[bench] medium combined: wasm 0.77ms vs js 7.97ms (10.32x)
[bench] medium security scan: wasm 1.58ms vs js 13.02ms (8.23x)
[bench] medium inspect index: wasm 3.62ms vs js 15.96ms (4.41x)
[bench] medium component tree: wasm 2.81ms vs js 3.84ms (1.37x)
[bench] medium snippet files: wasm 0.61ms vs js 0.23ms (0.38x)
[bench] medium strip directives: wasm 1.08ms vs js 1.35ms (1.25x)
[bench] medium strip auto imports: wasm 0.69ms vs js 1.56ms (2.26x)
[bench] medium export names: wasm 0.86ms vs js 1.44ms (1.68x)
[bench] medium primary export: wasm 0.32ms vs js 0.08ms (0.25x)
[bench] medium import offset: wasm 1.44ms vs js 2.15ms (1.50x)
[bench] medium worker roundtrip: 17.71ms for 20 iters (0.89ms/iter)
[bench] medium component tree worker roundtrip: 5.04ms for 12 iters (0.42ms/iter)
[bench] heavy scan: wasm 2.14ms vs js 21.86ms (10.21x)
[bench] heavy hash: wasm 4.75ms vs js 5.11ms (1.08x)
[bench] heavy combined: wasm 1.40ms vs js 12.26ms (8.73x)
[bench] heavy security scan: wasm 1.27ms vs js 11.64ms (9.18x)
[bench] heavy inspect index: wasm 3.55ms vs js 6.83ms (1.92x)
[bench] heavy component tree: wasm 2.43ms vs js 3.46ms (1.42x)
[bench] heavy snippet files: wasm 0.26ms vs js 0.25ms (0.99x)
[bench] heavy strip directives: wasm 0.72ms vs js 1.13ms (1.58x)
[bench] heavy strip auto imports: wasm 0.65ms vs js 1.64ms (2.54x)
[bench] heavy export names: wasm 0.80ms vs js 1.03ms (1.29x)
[bench] heavy primary export: wasm 0.14ms vs js 0.03ms (0.18x)
[bench] heavy import offset: wasm 0.40ms vs js 2.65ms (6.65x)
[bench] large snippet files: wasm 0.88ms vs js 0.20ms (0.22x)
[bench] heavy worker roundtrip: 7.53ms for 6 iters (1.25ms/iter)
[bench] heavy component tree worker roundtrip: 6.11ms for 6 iters (1.02ms/iter)
```

Notes:
- Results depend on machine and workload. Re-run after major changes.
- WASM scan is the primary win; hash is roughly parity with JS.
- New header scanners (strip directives/import block/export names/import offset) are wins, but primary export is still faster in JS for these workloads.
- Component tree benchmarks are now part of `bun run perf:wasm`; update this section after re-running.
