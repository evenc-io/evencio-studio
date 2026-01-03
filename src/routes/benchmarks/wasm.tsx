import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import type { ComponentTreeRequest, EngineResponse } from "@/lib/engine/protocol"
import { measure } from "@/lib/perf"
import {
	buildComponentTreeFromEntries,
	buildComponentTreeFromSource,
} from "@/lib/snippets/component-tree"
import { scanComponentTreeWasm, warmSnippetWasm } from "@/lib/wasm/snippet-wasm"

export const Route = createFileRoute("/benchmarks/wasm")({
	component: WasmBenchmarks,
})

const repeat = (value: string, count: number) =>
	Array.from({ length: count }, () => value).join("\n")

const componentTreeChunk = `
  <Card className="card">
    <Header />
    <Content>
      <Badge className="badge" />
      <span className="text-sm" />
    </Content>
  </Card>
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

const componentTreeMediumSource = buildSource(componentTreeChunk, 40)
const componentTreeHeavySource = buildSource(componentTreeChunk, 120)

const clampIterations = (value: number) => {
	if (!Number.isFinite(value)) return 1
	return Math.min(500, Math.max(1, Math.floor(value)))
}

type Comparison = {
	label: string
	wasmMs: number
	wasmIterations: number
	jsMs: number
	jsIterations: number
	ratio: number
	note?: string
}

type BenchmarkStatus = "idle" | "running" | "done" | "error"

type PendingRequest = {
	resolve: () => void
	reject: (reason?: unknown) => void
}

type BenchmarkMode = "wasm" | "js"

type BenchmarkRequest = {
	id: string
	type: "component-tree" | "component-tree-js"
	payload: ComponentTreeRequest
}

function WasmBenchmarks() {
	const [sourceProfile, setSourceProfile] = useState<"medium" | "heavy">("medium")
	const [iterations, setIterations] = useState(20)
	const [roundtripIterations, setRoundtripIterations] = useState(12)
	const [status, setStatus] = useState<BenchmarkStatus>("idle")
	const [error, setError] = useState<string | null>(null)
	const [results, setResults] = useState<Comparison[]>([])

	const workerRef = useRef<Worker | null>(null)
	const pendingRef = useRef(new Map<string, PendingRequest>())
	const requestCounter = useRef(0)

	const isDev = import.meta.env.DEV
	const source = useMemo(
		() => (sourceProfile === "heavy" ? componentTreeHeavySource : componentTreeMediumSource),
		[sourceProfile],
	)

	useEffect(() => {
		if (!isDev || typeof Worker === "undefined") return
		const worker = new Worker(new URL("../../lib/engine/worker.ts", import.meta.url), {
			type: "module",
		})
		workerRef.current = worker

		const rejectPending = (reason: unknown) => {
			for (const handler of pendingRef.current.values()) {
				handler.reject(reason)
			}
			pendingRef.current.clear()
		}

		worker.onmessage = (event: MessageEvent<EngineResponse>) => {
			const data = event.data
			if (!data || typeof data.id !== "string") return
			const handler = pendingRef.current.get(data.id)
			if (!handler) return
			pendingRef.current.delete(data.id)
			if (data.type === "error") {
				handler.reject(new Error(data.error))
				return
			}
			handler.resolve()
		}

		worker.onmessageerror = (event) => {
			rejectPending(event)
		}

		worker.onerror = (event) => {
			rejectPending(event)
		}

		return () => {
			rejectPending(new Error("Benchmark worker terminated."))
			worker.terminate()
			workerRef.current = null
		}
	}, [])

	const postRequest = (mode: BenchmarkMode, payload: string) => {
		const worker = workerRef.current
		if (!worker) {
			return Promise.reject(new Error("Benchmark worker unavailable."))
		}
		const id = `bench-${++requestCounter.current}`
		const type = mode === "wasm" ? "component-tree" : "component-tree-js"
		const request: BenchmarkRequest = {
			id,
			type,
			payload: { source: payload },
		}
		return new Promise<void>((resolve, reject) => {
			pendingRef.current.set(id, { resolve, reject })
			worker.postMessage(request)
		})
	}

	const runBenchmarks = async () => {
		setStatus("running")
		setError(null)
		setResults([])

		try {
			await warmSnippetWasm()

			const safeIterations = clampIterations(iterations)
			const safeRoundtripIterations = clampIterations(roundtripIterations)

			const wasmSample = await measure("component tree wasm", safeIterations, async () => {
				const entries = await scanComponentTreeWasm(source, { expanded: true })
				if (!entries) {
					throw new Error("Component tree WASM scanner unavailable.")
				}
				buildComponentTreeFromEntries(entries)
			})

			const jsSample = await measure("component tree js", safeIterations, () => {
				buildComponentTreeFromSource(source)
			})

			const comparisons: Comparison[] = [
				{
					label: `${sourceProfile} component tree (direct)`,
					wasmMs: wasmSample.durationMs,
					wasmIterations: wasmSample.iterations,
					jsMs: jsSample.durationMs,
					jsIterations: jsSample.iterations,
					ratio: jsSample.durationMs / Math.max(0.01, wasmSample.durationMs),
					note: "Direct compute on the main thread.",
				},
			]

			if (workerRef.current) {
				await postRequest("wasm", source)
				await postRequest("js", source)

				const wasmRoundtrip = await measure(
					"component tree worker wasm",
					safeRoundtripIterations,
					() => postRequest("wasm", source),
				)

				const jsRoundtrip = await measure("component tree worker js", safeRoundtripIterations, () =>
					postRequest("js", source),
				)

				comparisons.push({
					label: `${sourceProfile} component tree (worker roundtrip)`,
					wasmMs: wasmRoundtrip.durationMs,
					wasmIterations: wasmRoundtrip.iterations,
					jsMs: jsRoundtrip.durationMs,
					jsIterations: jsRoundtrip.iterations,
					ratio: jsRoundtrip.durationMs / Math.max(0.01, wasmRoundtrip.durationMs),
					note: "Includes postMessage overhead and worker execution.",
				})
			}

			setResults(comparisons)
			setStatus("done")
		} catch (err) {
			setStatus("error")
			setError(err instanceof Error ? err.message : "Benchmark failed.")
		}
	}

	if (!isDev) {
		return (
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 py-12">
				<p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-400">
					Benchmarks
				</p>
				<h1 className="font-lexend text-3xl font-semibold text-neutral-900">
					Zig/WASM benchmarks are dev-only.
				</h1>
				<p className="text-sm text-neutral-600">
					This route is intentionally disabled outside local development.
				</p>
			</div>
		)
	}

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
			<header className="flex flex-col gap-4">
				<p className="text-xs font-semibold uppercase tracking-[0.32em] text-neutral-400">
					Benchmarks · Dev only
				</p>
				<h1 className="font-lexend text-3xl font-semibold text-neutral-900">
					Component tree Zig/WASM benchmarks
				</h1>
				<p className="max-w-3xl text-sm text-neutral-600">
					This page compares the Zig/WASM component tree scanner against the JS parser, including
					full worker roundtrips. Use this to validate real browser speedups before updating docs.
				</p>
			</header>

			<section className="grid gap-6 border-t border-neutral-200 pt-8">
				<div className="grid gap-6 rounded-md border border-neutral-200 bg-neutral-50 p-5 md:grid-cols-2">
					<div className="flex flex-col gap-3">
						<p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
							Source profile
						</p>
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => setSourceProfile("medium")}
								className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-colors ${
									sourceProfile === "medium"
										? "border-neutral-900 bg-neutral-900 text-white"
										: "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
								}`}
							>
								Medium
							</button>
							<button
								type="button"
								onClick={() => setSourceProfile("heavy")}
								className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-colors ${
									sourceProfile === "heavy"
										? "border-neutral-900 bg-neutral-900 text-white"
										: "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100"
								}`}
							>
								Heavy
							</button>
						</div>
						<p className="text-xs text-neutral-500">
							Medium uses 40 repeated chunks; heavy uses 120 repeated chunks.
						</p>
					</div>
					<div className="grid gap-4">
						<label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
							Direct iterations
							<input
								type="number"
								min={1}
								max={500}
								value={iterations}
								onChange={(event) => setIterations(Number(event.target.value))}
								className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700"
							/>
						</label>
						<label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
							Worker roundtrip iterations
							<input
								type="number"
								min={1}
								max={500}
								value={roundtripIterations}
								onChange={(event) => setRoundtripIterations(Number(event.target.value))}
								className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700"
							/>
						</label>
					</div>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-neutral-200 bg-white px-5 py-4">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
							Status
						</p>
						<p className="text-sm text-neutral-700">
							{status === "running"
								? "Running benchmarks..."
								: status === "error"
									? "Benchmark failed."
									: status === "done"
										? "Complete."
										: "Idle."}
						</p>
						{error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
					</div>
					<button
						type="button"
						onClick={runBenchmarks}
						disabled={status === "running"}
						className="rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-300"
					>
						Run benchmarks
					</button>
				</div>
			</section>

			<section className="grid gap-4 border-t border-neutral-200 pt-8">
				<h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
					Results
				</h2>
				{results.length === 0 ? (
					<div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-500">
						Run the benchmarks to see a JS vs WASM comparison.
					</div>
				) : (
					<div className="grid gap-4">
						{results.map((result) => (
							<div key={result.label} className="rounded-md border border-neutral-200 bg-white p-5">
								<p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">
									{result.label}
								</p>
								<div className="mt-3 grid gap-2 text-sm text-neutral-700">
									<div className="flex items-center justify-between">
										<span>WASM</span>
										<span className="font-mono">
											{result.wasmMs.toFixed(2)}ms / {result.wasmIterations} runs
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span>JS</span>
										<span className="font-mono">
											{result.jsMs.toFixed(2)}ms / {result.jsIterations} runs
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span>Ratio (JS/WASM)</span>
										<span className="font-mono">{result.ratio.toFixed(2)}x</span>
									</div>
								</div>
								{result.note ? (
									<p className="mt-3 text-xs text-neutral-500">{result.note}</p>
								) : null}
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	)
}
