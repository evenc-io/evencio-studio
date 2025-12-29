import { describe, expect, test } from "bun:test"
import { analyzeSnippetInEngine } from "@/lib/engine/client"
import { formatSample, measure } from "@/lib/perf"
import { SNIPPET_EXAMPLES } from "@/lib/snippets/examples"
import { buildSnippetInspectIndex } from "@/lib/snippets/inspect-index"
import { scanSnippetFilesSync } from "@/lib/snippets/source-files"
import { analyzeSnippetSource } from "@/lib/snippets/source-security"
import { extractTailwindCandidatesFromSource } from "@/lib/snippets/tailwind"
import { SNIPPET_TEMPLATES } from "@/lib/snippets/templates"
import {
	buildSnippetInspectIndexWasm,
	hashSourceWasm,
	scanSnippetFilesWasm,
	scanSnippetSecurityIssuesWasm,
	scanTailwindCandidatesWasm,
} from "@/lib/wasm/snippet-wasm"

const normalize = (value: string[]) => value.slice().sort()

describe("snippet wasm tailwind scanner", () => {
	test("extracts class candidates from static JSX", async () => {
		const source = `
      export default function Demo() {
        return (
          <div className="p-4 text-center">
            <span className={'bg-blue-500 text-white'} />
            <section className={"flex " + "items-center"} />
            <p className={\`mt-2 mb-4\`}>Hello</p>
            <div class="grid gap-2" />
            <div className={condition ? "skip" : "me"} />
          </div>
        )
      }
    `

		const result = await scanTailwindCandidatesWasm(source)
		expect(result).not.toBeNull()
		const candidates = normalize(result ?? [])
		expect(candidates).toEqual(
			normalize([
				"p-4",
				"text-center",
				"bg-blue-500",
				"text-white",
				"flex",
				"items-center",
				"mt-2",
				"mb-4",
				"grid",
				"gap-2",
			]),
		)
	})

	test("dedupes candidates", async () => {
		const source = `<div className="p-4 p-4 text-center" />`
		const result = await scanTailwindCandidatesWasm(source)
		expect(result).not.toBeNull()
		const candidates = normalize(result ?? [])
		expect(candidates).toEqual(normalize(["p-4", "text-center"]))
	})

	test("perf scan (optional)", async () => {
		if (!process.env.PERF_WASM) return
		const source = `<div className="p-4 text-center bg-blue-500 border border-neutral-200" />`
		const sample = await measure("scanTailwindCandidatesWasm", 200, async () => {
			await scanTailwindCandidatesWasm(source)
		})
		// eslint-disable-next-line no-console
		console.info(formatSample(sample))
		expect(sample.durationMs).toBeGreaterThan(0)
	})
})

const normalizeIssues = (issues: Awaited<ReturnType<typeof analyzeSnippetSource>>) =>
	issues
		.map((issue) => ({
			message: issue.message,
			line: issue.line,
			column: issue.column,
		}))
		.sort((a, b) => {
			if (a.message !== b.message) return a.message.localeCompare(b.message)
			if (a.line !== b.line) return a.line - b.line
			return a.column - b.column
		})

describe("snippet wasm security scanner", () => {
	test("matches JS scanner for common patterns", async () => {
		const source = `
      import React from "react"
      import fs from "fs"

      export const Demo = () => {
        fetch("/api")
        window.fetch("/bad")
        require("react-dom")
        new Worker("x")
        return <div>Hello</div>
      }
    `

		const jsIssues = await analyzeSnippetSource(source)
		const wasmIssues = await scanSnippetSecurityIssuesWasm(source)
		expect(wasmIssues).not.toBeNull()
		expect(normalizeIssues(wasmIssues ?? [])).toEqual(normalizeIssues(jsIssues))
	})
})

type InspectIndex = NonNullable<ReturnType<typeof buildSnippetInspectIndex>>

const normalizeElementNames = (elements: InspectIndex["elements"]) =>
	elements
		.map((entry) => `${entry.elementType}:${entry.elementName ?? ""}`)
		.sort((a, b) => a.localeCompare(b))

describe("snippet wasm inspect index", () => {
	test("builds element index for JSX", async () => {
		const source = `
      export default function Demo() {
        return (
          <section>
            <h1>Hello</h1>
            <div>{"World"}</div>
            <>
              <span>Inner</span>
            </>
          </section>
        )
      }
    `

		const jsIndex = buildSnippetInspectIndex(source)
		const wasmIndex = await buildSnippetInspectIndexWasm(source)
		expect(wasmIndex).not.toBeNull()
		expect(jsIndex).not.toBeNull()
		expect(normalizeElementNames(wasmIndex?.elements ?? [])).toEqual(
			normalizeElementNames(jsIndex?.elements ?? []),
		)
	})
})

describe("snippet wasm file scanner", () => {
	test("matches JS scanner for snippet-file blocks", async () => {
		const source = SNIPPET_TEMPLATES.multi.source
		const jsResult = scanSnippetFilesSync(source)
		const wasmResult = await scanSnippetFilesWasm(source)
		expect(wasmResult).not.toBeNull()
		if (!wasmResult) {
			throw new Error("Snippet file WASM result missing.")
		}

		expect(wasmResult.mainSource).toBe(jsResult.mainSource)
		expect(wasmResult.files).toEqual(jsResult.files)
		expect(wasmResult.fileOrder).toEqual(jsResult.fileOrder)
		expect(wasmResult.expandedSource).toBe(jsResult.expandedSource)
		expect(wasmResult.lineMapSegments).toEqual(jsResult.lineMapSegments)
		expect(wasmResult.hasFileBlocks).toBe(true)
	})
})

const repeat = (value: string, count: number) =>
	Array.from({ length: count }, () => value).join("\n")

const baseChunk = `
  <div className="p-4 text-center bg-blue-500 border border-neutral-200">
    <span className={'text-sm font-medium'} />
    <section className={"flex " + "items-center justify-between"} />
    <p className={\`mt-2 mb-4\`}>Hello</p>
    <div class="grid gap-2" />
    <div className={condition ? "skip" : "me"} />
  </div>
`

const buildSource = (chunk: string, count: number) => `
export default function Demo() {
  return (
    <section>
${repeat(chunk, count)}
    </section>
  )
}
`

const mediumSource = buildSource(baseChunk, 40)
const heavySource = buildSource(baseChunk, 120)

const templateSources = Object.values(SNIPPET_TEMPLATES).map((template) => template.source)
const exampleSources = SNIPPET_EXAMPLES.map((example) => example.source)
const realSnippetSources = [...templateSources, ...exampleSources].filter(
	(source) => source.trim().length > 0,
)

const pickSnippetSources = (count: number) => {
	if (realSnippetSources.length === 0) return [""]
	return Array.from(
		{ length: count },
		(_, index) => realSnippetSources[index % realSnippetSources.length],
	)
}

const buildLargeSnippetSources = (sources: string[], repeats: number, variants: number) => {
	const normalized = sources.map((source) => source.trim()).filter(Boolean)
	if (normalized.length === 0) return [""]
	const combined = Array.from(
		{ length: repeats },
		(_, index) => normalized[index % normalized.length],
	).join("\n\n")
	return Array.from({ length: variants }, (_, index) => `${combined}\n// seed:${index}`)
}

const mediumFileSources = pickSnippetSources(6)
const heavyFileSources = buildLargeSnippetSources(pickSnippetSources(6), 2, 6)
const largeFileSources = buildLargeSnippetSources(pickSnippetSources(8), 4, 4)

const hashSourceJs = (value: string) => {
	let hash = 0x811c9dc5
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193)
	}
	return hash >>> 0
}

const benchPair = async (
	label: string,
	iterations: number,
	wasmFn: () => Promise<void>,
	jsFn: () => Promise<void>,
) => {
	const wasmSample = await measure(`${label}: wasm`, iterations, wasmFn)
	const jsSample = await measure(`${label}: js`, iterations, jsFn)
	const ratio = jsSample.durationMs / Math.max(0.01, wasmSample.durationMs)
	// eslint-disable-next-line no-console
	console.info(
		`[bench] ${label}: wasm ${wasmSample.durationMs.toFixed(2)}ms vs js ${jsSample.durationMs.toFixed(
			2,
		)}ms (${ratio.toFixed(2)}x)`,
	)
	return { wasmSample, jsSample, ratio }
}

const createSourceCycler = (sources: string[]) => {
	let index = 0
	return () => {
		const source = sources[index % sources.length]
		index += 1
		return source
	}
}

const benchSnippetFiles = async (label: string, iterations: number, sources: string[]) => {
	const wasmNext = createSourceCycler(sources)
	const jsNext = createSourceCycler(sources)

	return benchPair(
		label,
		iterations,
		async () => {
			const source = wasmNext()
			const result = await scanSnippetFilesWasm(source)
			if (!result) throw new Error("Snippet file WASM result missing.")
		},
		async () => {
			const source = jsNext()
			scanSnippetFilesSync(source)
		},
	)
}

const benchWorkerRoundtrip = async (label: string, iterations: number, source: string) => {
	await analyzeSnippetInEngine(source, {
		includeInspect: false,
		includeTailwind: false,
		key: `bench-warm-${label}`,
	})
	const start = performance.now()
	for (let i = 0; i < iterations; i += 1) {
		await analyzeSnippetInEngine(source, {
			includeInspect: false,
			includeTailwind: false,
			key: `bench-${label}-${i}`,
		})
	}
	const duration = performance.now() - start
	// eslint-disable-next-line no-console
	console.info(
		`[bench] ${label} worker roundtrip: ${duration.toFixed(2)}ms for ${iterations} iters (${(
			duration / iterations
		).toFixed(2)}ms/iter)`,
	)
	return duration
}

describe("snippet wasm benchmarks", () => {
	test("benchmarks zig vs ts (logs timings)", async () => {
		if (!process.env.PERF_WASM) return

		const wasmScan = async (source: string) => {
			const result = await scanTailwindCandidatesWasm(source)
			expect(result).not.toBeNull()
		}

		const jsScan = async (source: string) => {
			await extractTailwindCandidatesFromSource(source)
		}

		const wasmHash = async (source: string) => {
			const result = await hashSourceWasm(source)
			expect(result).not.toBeNull()
		}

		const jsHash = async (source: string) => {
			hashSourceJs(source)
		}

		const wasmSecurity = async (source: string) => {
			const result = await scanSnippetSecurityIssuesWasm(source)
			expect(result).not.toBeNull()
		}

		const jsSecurity = async (source: string) => {
			await analyzeSnippetSource(source)
		}

		const wasmInspect = async (source: string) => {
			const result = await buildSnippetInspectIndexWasm(source)
			expect(result).not.toBeNull()
		}

		const jsInspect = async (source: string) => {
			buildSnippetInspectIndex(source)
		}

		const mediumScan = await benchPair(
			"medium scan",
			20,
			() => wasmScan(mediumSource),
			() => jsScan(mediumSource),
		)
		expect(mediumScan.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumHash = await benchPair(
			"medium hash",
			200,
			() => wasmHash(mediumSource),
			() => jsHash(mediumSource),
		)
		expect(mediumHash.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumCombined = await benchPair(
			"medium combined",
			10,
			async () => {
				await wasmScan(mediumSource)
				await wasmHash(mediumSource)
			},
			async () => {
				await jsScan(mediumSource)
				await jsHash(mediumSource)
			},
		)
		expect(mediumCombined.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumSecurity = await benchPair(
			"medium security scan",
			12,
			() => wasmSecurity(mediumSource),
			() => jsSecurity(mediumSource),
		)
		expect(mediumSecurity.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumInspect = await benchPair(
			"medium inspect index",
			12,
			() => wasmInspect(mediumSource),
			() => jsInspect(mediumSource),
		)
		expect(mediumInspect.wasmSample.durationMs).toBeGreaterThan(0)

		const mediumFiles = await benchSnippetFiles("medium snippet files", 10, mediumFileSources)
		expect(mediumFiles.wasmSample.durationMs).toBeGreaterThan(0)

		await benchWorkerRoundtrip("medium", 20, mediumSource)

		const heavyScan = await benchPair(
			"heavy scan",
			10,
			() => wasmScan(heavySource),
			() => jsScan(heavySource),
		)
		expect(heavyScan.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyHash = await benchPair(
			"heavy hash",
			120,
			() => wasmHash(heavySource),
			() => jsHash(heavySource),
		)
		expect(heavyHash.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyCombined = await benchPair(
			"heavy combined",
			6,
			async () => {
				await wasmScan(heavySource)
				await wasmHash(heavySource)
			},
			async () => {
				await jsScan(heavySource)
				await jsHash(heavySource)
			},
		)
		expect(heavyCombined.wasmSample.durationMs).toBeGreaterThan(0)

		const heavySecurity = await benchPair(
			"heavy security scan",
			6,
			() => wasmSecurity(heavySource),
			() => jsSecurity(heavySource),
		)
		expect(heavySecurity.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyInspect = await benchPair(
			"heavy inspect index",
			6,
			() => wasmInspect(heavySource),
			() => jsInspect(heavySource),
		)
		expect(heavyInspect.wasmSample.durationMs).toBeGreaterThan(0)

		const heavyFiles = await benchSnippetFiles("heavy snippet files", 6, heavyFileSources)
		expect(heavyFiles.wasmSample.durationMs).toBeGreaterThan(0)

		const largeFiles = await benchSnippetFiles("large snippet files", 4, largeFileSources)
		expect(largeFiles.wasmSample.durationMs).toBeGreaterThan(0)

		await benchWorkerRoundtrip("heavy", 6, heavySource)
	})
})
