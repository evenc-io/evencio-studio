import {
	getSnippetComponentSourceMap,
	listSnippetComponentExports,
	listSnippetComponentExportsFromProgram,
	removeSnippetComponentExport,
} from "./exports"
import {
	deriveSnippetPropsFromAllExports,
	deriveSnippetPropsFromProgram,
	deriveSnippetPropsFromSource,
} from "./props"
import {
	DEFAULT_SNIPPET_EXPORT,
	type SnippetComponentExport,
	type SnippetComponentSourceMap,
} from "./types"

export { DEFAULT_SNIPPET_EXPORT }
export type { SnippetComponentExport, SnippetComponentSourceMap }
export { listSnippetComponentExports, getSnippetComponentSourceMap, removeSnippetComponentExport }
export { deriveSnippetPropsFromSource, deriveSnippetPropsFromAllExports }

export const analyzeSnippetProgram = (program: { body: unknown[] }) => ({
	exports: listSnippetComponentExportsFromProgram(program),
	...deriveSnippetPropsFromProgram(program),
})
