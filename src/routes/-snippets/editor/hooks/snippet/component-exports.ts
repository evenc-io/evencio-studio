import { type MutableRefObject, useCallback, useEffect, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import type { AnalyzeTsxResponse } from "@/lib/engine/protocol"
import {
	getSnippetComponentSourceMap,
	parseSnippetFiles,
	removeSnippetComponentExport,
	type SnippetComponentExport,
	serializeSnippetFiles,
} from "@/lib/snippets"
import type { CustomSnippetValues } from "@/routes/-snippets/editor/schema"
import { syncImportBlock } from "@/routes/-snippets/editor/snippet-file-utils"

interface UseSnippetComponentExportsOptions {
	source: string
	form: UseFormReturn<CustomSnippetValues>
	fileMigrationRef: MutableRefObject<boolean>
	analysis: AnalyzeTsxResponse | null
}

export function useSnippetComponentExports({
	source,
	form,
	fileMigrationRef,
	analysis,
}: UseSnippetComponentExportsOptions) {
	const [componentExports, setComponentExports] = useState<SnippetComponentExport[]>([])
	const [componentExportsLoaded, setComponentExportsLoaded] = useState(false)

	const resetComponentExports = useCallback(() => {
		setComponentExportsLoaded(false)
	}, [])

	useEffect(() => {
		if (!analysis) return
		setComponentExports(analysis.exports)
		setComponentExportsLoaded(true)
	}, [analysis])

	useEffect(() => {
		if (fileMigrationRef.current) return
		if (!componentExportsLoaded) return
		const parsed = parseSnippetFiles(source)
		if (parsed.hasFileBlocks) {
			fileMigrationRef.current = true
			return
		}
		const namedExports = componentExports.filter((component) => !component.isDefault)
		if (namedExports.length === 0) {
			fileMigrationRef.current = true
			return
		}

		void (async () => {
			try {
				const currentSource = form.getValues("source") ?? ""
				const { mainSource } = parseSnippetFiles(currentSource)
				const sourceMap = await getSnippetComponentSourceMap(currentSource)
				let nextMain = mainSource
				const nextFiles: Record<string, string> = {}

				for (const component of namedExports) {
					const exportName = component.exportName
					const fileName = `${exportName}.tsx`
					const componentSource = sourceMap[exportName]
					if (!componentSource) continue
					nextFiles[fileName] = componentSource.trimEnd()
					const removal = await removeSnippetComponentExport(nextMain, exportName)
					if (removal.removed) {
						nextMain = removal.source
					}
				}

				if (Object.keys(nextFiles).length === 0) {
					fileMigrationRef.current = true
					return
				}

				const nextSerialized = serializeSnippetFiles(
					syncImportBlock(nextMain, Object.keys(nextFiles)),
					nextFiles,
				)
				form.setValue("source", nextSerialized, {
					shouldValidate: true,
					shouldDirty: true,
				})
			} catch {
				// Ignore migration errors to avoid blocking edits.
			} finally {
				fileMigrationRef.current = true
			}
		})()
	}, [componentExports, componentExportsLoaded, fileMigrationRef, form, source])

	return {
		componentExports,
		resetComponentExports,
	}
}
