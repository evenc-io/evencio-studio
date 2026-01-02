export const DEFAULT_SNIPPET_EXPORT = "default"

export type SnippetComponentExport = {
	exportName: string
	label: string
	isDefault: boolean
}

export type SnippetComponentSourceMap = Record<string, string>
