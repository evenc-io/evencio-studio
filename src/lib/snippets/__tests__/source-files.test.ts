import { describe, expect, it } from "bun:test"
import {
	buildSnippetLineMapSegments,
	expandSnippetSource,
	extractSnippetImports,
	parseSnippetFiles,
} from "../source-files"

const source = [
	"// @snippet-file utils.ts",
	"export const foo = 1;",
	"// @snippet-file-end",
	"// @snippet-file widget.tsx",
	"// @import utils.ts",
	"export const Widget = () => <div />;",
	"// @snippet-file-end",
	"// @import widget.tsx",
	"export default function App() { return <Widget /> }",
].join("\n")

describe("source-files", () => {
	it("parses snippet file blocks", () => {
		const parsed = parseSnippetFiles(source)
		expect(parsed.hasFileBlocks).toBe(true)
		expect(parsed.mainSource).toBe(
			"// @import widget.tsx\nexport default function App() { return <Widget /> }",
		)
		expect(parsed.files["utils.ts"]).toBe("export const foo = 1;")
		expect(parsed.files["widget.tsx"]).toBe(
			"// @import utils.ts\nexport const Widget = () => <div />;",
		)
	})

	it("expands nested imports inside snippet files", () => {
		const expanded = expandSnippetSource(source)
		expect(expanded).toBe(
			"export const foo = 1;\nexport const Widget = () => <div />;\nexport default function App() { return <Widget /> }",
		)
	})

	it("builds line map segments for nested imports", () => {
		const parsed = parseSnippetFiles(source)
		const segments = buildSnippetLineMapSegments(parsed.mainSource, parsed.files)
		expect(segments).toEqual([
			{
				fileName: "utils.ts",
				expandedStartLine: 1,
				originalStartLine: 1,
				lineCount: 1,
			},
			{
				fileName: "widget.tsx",
				expandedStartLine: 2,
				originalStartLine: 2,
				lineCount: 1,
			},
			{
				fileName: null,
				expandedStartLine: 3,
				originalStartLine: 2,
				lineCount: 1,
			},
		])
	})

	it("extracts imports from main and component files", () => {
		const imports = extractSnippetImports(source)
		expect(imports.sort()).toEqual(["utils.ts", "widget.tsx"].sort())
	})
})
