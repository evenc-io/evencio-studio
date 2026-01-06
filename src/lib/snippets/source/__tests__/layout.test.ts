import { describe, expect, it } from "bun:test"
import { applySnippetTranslate } from "../layout"

const runLayoutUpdate = async (source: string) =>
	applySnippetTranslate({
		source,
		line: 2,
		column: 4,
		translateX: 10,
		translateY: 20,
		width: 120,
		height: 80,
	})

describe("applySnippetTranslate", () => {
	it("writes translate + size as Tailwind classes when possible", async () => {
		const source = `
export const Snip = () => (
  <div className="box">Hello</div>
)
`.trim()
		const result = await runLayoutUpdate(source)
		expect(result.changed).toBe(true)
		expect(result.source).toContain("box")
		expect(result.source).toContain("translate-x-[10px]")
		expect(result.source).toContain("translate-y-[20px]")
		expect(result.source).toContain("w-[120px]")
		expect(result.source).toContain("h-[80px]")
	})

	it("updates existing style object while preserving other properties", async () => {
		const source = `
export const Snip = () => (
  <div style={{ color: "red", translate: "1px 2px" }} />
)
`.trim()
		const result = await runLayoutUpdate(source)
		expect(result.changed).toBe(true)
		expect(result.source).toContain('color: "red"')
		expect(result.source).not.toContain('translate: "1px 2px"')
		expect(result.source).not.toContain('translate: "10px 20px"')
		expect(result.source).toContain("translate-x-[10px]")
		expect(result.source).toContain("translate-y-[20px]")
		expect(result.source).toContain("w-[120px]")
		expect(result.source).toContain("h-[80px]")
	})

	it("inserts className for style expressions", async () => {
		const source = `
export const Snip = () => (
  <div style={styles.card} />
)
`.trim()
		const result = await runLayoutUpdate(source)
		expect(result.changed).toBe(true)
		expect(result.source).toContain("style={styles.card}")
		expect(result.source).toContain("translate-x-[10px]")
		expect(result.source).toContain("translate-y-[20px]")
		expect(result.source).toContain("w-[120px]")
		expect(result.source).toContain("h-[80px]")
	})

	it("removes conflicting translate/size utilities", async () => {
		const source = `
export const Snip = () => (
  <div className="max-w-[28rem] w-32 h-10 translate-x-4 translate-y-2 bg-red-500" />
)
`.trim()
		const result = await runLayoutUpdate(source)
		expect(result.changed).toBe(true)
		expect(result.source).toContain("bg-red-500")
		expect(result.source).toContain("translate-x-[10px]")
		expect(result.source).toContain("translate-y-[20px]")
		expect(result.source).toContain("w-[120px]")
		expect(result.source).toContain("h-[80px]")
		expect(result.source).not.toContain("translate-x-4")
		expect(result.source).not.toContain("translate-y-2")
		expect(result.source).not.toContain("w-32")
		expect(result.source).not.toContain("h-10")
		expect(result.source).not.toContain("max-w-[28rem]")
	})
})
