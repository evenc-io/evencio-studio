# Evencio Studio

> Code-first, AI-ready visual composition studio for marketing assets, brand systems, and presentations.

[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-black)](https://bun.sh)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-blue)](https://tanstack.com/start)

## What you can do

- Build reusable, parameterized visual components in React/TSX with Monaco + live preview
- Define typed props and defaults for safe, programmatic generation
- Compose multi-slide sets and presets for social, print, and presentation formats
- Render deterministically with sandboxed execution and constrained inputs
- Manage assets with tags, favorites, and scope levels (global/org/event/personal)
- Work local-first (IndexedDB) with thumbnails and storage management
- Configure integrations for upcoming connectors

## Why code-first

Design assets become executable, inspectable components instead of opaque pixels. That means:
- Structured inputs (props + schema) that automation can reason about
- Deterministic outputs for reliable generation and review
- Safe remixing without losing design intent across campaigns and decks

## Tech Stack

- Framework: TanStack Start + TanStack Router + TanStack Query (React 19)
- Runtime: Bun + Vite + Nitro
- Editor: Monaco Editor + React/TSX rendering pipeline
- Compiler: esbuild-wasm
- Performance: Zig/WASM helpers for snippet analysis (optional build)
- UI: shadcn/ui + Tailwind CSS v4
- State: Zustand
- Tooling: Biome, TypeScript

## Getting Started

### Prerequisites

- Bun v1.0+
- Zig (optional, only if building WASM)
- Node.js (optional, only for font/embed and license scripts)

### Installation

```bash
# Clone the repository
git clone https://github.com/evenc-io/evencio-studio.git
cd evencio-studio

# Install dependencies
bun install

# Start development server
bun run dev
```

The app will be available at http://localhost:3010.

### Production Build

```bash
# Build for production
bun run build

# Start production server
bun run start
```

## Project Structure

```
src/
├── routes/              # Dashboard, studio, asset library, snippets editor, settings
├── components/
│   ├── asset-library/   # Asset library UI
│   ├── dashboard/       # Project dashboard components
│   ├── editor/          # Studio editor UI
│   ├── layout/          # App layout and navigation
│   └── ui/              # shadcn/ui components
├── lib/
│   ├── asset-library/   # Asset registry, search, and rendering
│   ├── snippets/        # Snippet compiler, templates, and preview runtime
│   ├── export/          # Export utilities
│   ├── storage/         # IndexedDB storage, autosave, thumbnails
│   └── wasm/            # Zig/WASM helpers for snippet parsing
├── stores/              # Zustand stores
├── hooks/               # Shared hooks
└── types/               # TypeScript types
server/                  # Server-side rendering utilities (snippets)
scripts/                 # WASM build + maintenance scripts
docs/                    # Architecture and benchmarks
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server (port 3010) |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run preview` | Preview production build |
| `bun run lint` | Run Biome + TypeScript checks |
| `bun run lint:fix` | Fix lint issues |
| `bun run format` | Format code with Biome |
| `bun run test` | Run tests |
| `bun run wasm:snippets` | Build Zig/WASM snippet helpers |
| `bun run perf:wasm` | Run WASM benchmarks |
| `bun run third-party-notices` | Regenerate third-party notices |

## Snippet WASM (optional)

Zig/WASM helpers accelerate snippet parsing and inspection in the editor. To build and benchmark:

```bash
bun run wasm:snippets
bun run perf:wasm
```

See docs/benchmarks/README.md for details.

## Snippet Rendering Fonts

Server-side snippet rendering embeds font data to keep previews deterministic. To refresh the embedded fonts:

```bash
node scripts/generate-snippet-fonts.mjs
```

This script updates server/lib/snippet-fonts.ts and caches downloaded woff2 files in server/assets/fonts.

## Docs

- docs/animated-editor-architecture.md - editor architecture notes
- docs/benchmarks/README.md - Zig/WASM benchmark entry point
- docs/connector-ecosystem.md - connector strategy and ecosystem notes

## Contributing

We welcome contributions. Please see our Contributing Guide (CONTRIBUTING.md) for details.

## Ecosystem

Connector strategy and ecosystem notes live in docs/connector-ecosystem.md.

## Contact

Yan Malinovskiy - yanmalinovskiy@evenc.io

## License

This project is source-available (Fair Source) under FSL-1.1-MIT. See LICENSE.

Third-party dependencies and their licenses are listed in THIRD_PARTY_NOTICES.md. Regenerate with `bun run third-party-notices`.

### TL;DR (plain-language summary)

Allowed (Permitted Purpose):
- Use, modify, and run locally / self-host for internal use and evaluation
- Use for non-commercial education and non-commercial research
- Use as an agency / consultant to deliver professional services for a client who is using the Software under these terms

Not allowed (Competing Use) without a commercial license:
- Offering this editor/SDK/template system to third parties as part of a commercial product or service
- Shipping a hosted/SaaS editor, asset builder, or similar functionality that makes the Software available to your users/customers
- Embedding it into commercial platforms/marketplaces/resellers where customers can access the functionality as part of the platform's offering

If you are unsure whether your use is Competing Use, see COMMERCIAL.md.

### 2-year rolling conversion to MIT (per commit/version)

FSL applies per version of the software that is made available. In a git repository, treat each pushed commit as a version made available at the time it was first published.
Two years after a given commit was first made available, that commit is additionally available under the MIT License. Newer commits remain under FSL until they reach the 2-year mark.

### Trademarks / branding

The license does not grant rights to Evencio trademarks or logos beyond attribution/origin. Public forks must rebrand before publishing. See TRADEMARKS.md.
