import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { buildSnippetComponentTreeInEngine } from "@/lib/engine/client"
import type { SnippetComponentTreeNode } from "@/lib/snippets/component-tree"
import type { PreviewSourceLocation } from "@/lib/snippets/preview/runtime"
import {
	buildSnippetLineMapSegments,
	type SnippetLineMapSegment,
} from "@/lib/snippets/source/files"
import {
	getAutoImportOffset,
	resolvePreviewSourceLocation,
} from "@/routes/-snippets/editor/component-tree"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"

type UseSnippetComponentTreeOptions = {
	entryExport: string
	fileId: SnippetEditorFileId
	fileName: string | null
	fileSource: string
	mainSource: string
	files: Record<string, string>
	lineMapSegments?: SnippetLineMapSegment[]
	enabled?: boolean
	debounceMs?: number
}

type UseSnippetComponentTreeResult = {
	tree: SnippetComponentTreeNode[]
	resolvePreviewSource: (node: SnippetComponentTreeNode) => PreviewSourceLocation | null
}

export const useSnippetComponentTree = ({
	entryExport,
	fileId,
	fileName,
	fileSource,
	mainSource,
	files,
	lineMapSegments,
	enabled = true,
	debounceMs = 200,
}: UseSnippetComponentTreeOptions): UseSnippetComponentTreeResult => {
	const [tree, setTree] = useState<SnippetComponentTreeNode[]>([])
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const versionRef = useRef(0)
	const isMountedRef = useRef(true)

	useEffect(() => {
		isMountedRef.current = true
		return () => {
			isMountedRef.current = false
		}
	}, [])

	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current)
			debounceRef.current = null
		}

		const currentVersion = ++versionRef.current

		if (!enabled) {
			setTree([])
			return
		}

		const nextSource = fileSource ?? ""
		if (!nextSource.trim()) {
			setTree([])
			return
		}

		const applyTree = () => {
			void (async () => {
				try {
					const { data, stale } = await buildSnippetComponentTreeInEngine(nextSource, {
						entryExport,
						key: `snippet-component-tree-${fileId}`,
					})
					if (!isMountedRef.current || stale) return
					if (currentVersion !== versionRef.current) return
					setTree(data)
				} catch {
					if (!isMountedRef.current) return
					if (currentVersion !== versionRef.current) return
				}
			})()
		}

		if (debounceMs <= 0) {
			applyTree()
			return
		}

		debounceRef.current = setTimeout(applyTree, debounceMs)

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
				debounceRef.current = null
			}
		}
	}, [debounceMs, enabled, entryExport, fileId, fileSource])

	const resolvedLineMapSegments = useMemo(() => {
		if (!enabled) return null
		if (lineMapSegments) return lineMapSegments
		return buildSnippetLineMapSegments(mainSource, files)
	}, [enabled, files, lineMapSegments, mainSource])

	const autoImportOffset = useMemo(() => {
		if (!enabled || fileId !== "source") return 0
		return getAutoImportOffset(mainSource)
	}, [enabled, fileId, mainSource])

	const resolvePreviewSource = useCallback(
		(node: SnippetComponentTreeNode) => {
			if (!enabled) return null
			if (!node.source) return null
			return resolvePreviewSourceLocation({
				fileId,
				fileName,
				line: node.source.line,
				column: node.source.column,
				mainSource,
				files,
				lineMapSegments: resolvedLineMapSegments ?? undefined,
				autoImportOffset,
			})
		},
		[autoImportOffset, enabled, fileId, fileName, files, mainSource, resolvedLineMapSegments],
	)

	return { tree, resolvePreviewSource }
}
