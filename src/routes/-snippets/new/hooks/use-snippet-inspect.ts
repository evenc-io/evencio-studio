import { useCallback, useEffect, useMemo, useState } from "react"
import type { PreviewSourceLocation } from "@/lib/snippets/preview-runtime"
import type { SnippetEditorFileId } from "@/routes/-snippets/new/snippet-editor-types"
import { getComponentFileName, isComponentFileId } from "@/routes/-snippets/new/snippet-file-utils"
import {
	buildSnippetInspectMap,
	createSnippetElementLocator,
	type SnippetInspectHighlight,
	type SnippetInspectTarget,
} from "@/routes/-snippets/new/snippet-inspect-utils"

interface UseSnippetInspectOptions {
	mainSource: string
	mainEditorSource: string
	componentFiles: Record<string, string>
	activeFile: SnippetEditorFileId
	isExamplePreviewActive: boolean
	onOpenFileForInspect: (fileId: SnippetEditorFileId) => void
}

interface UseSnippetInspectResult {
	inspectMode: boolean
	setInspectMode: (next: boolean | ((prev: boolean) => boolean)) => void
	inspectEnabled: boolean
	inspectHighlight: SnippetInspectHighlight | null
	onPreviewInspectHover: (source: PreviewSourceLocation | null) => void
	onPreviewInspectSelect: (source: PreviewSourceLocation | null) => void
}

export function useSnippetInspect({
	mainSource,
	mainEditorSource,
	componentFiles,
	activeFile,
	isExamplePreviewActive,
	onOpenFileForInspect,
}: UseSnippetInspectOptions): UseSnippetInspectResult {
	const [inspectMode, setInspectMode] = useState(false)
	const [inspectHover, setInspectHover] = useState<SnippetInspectTarget | null>(null)
	const [inspectSelection, setInspectSelection] = useState<SnippetInspectTarget | null>(null)

	const inspectMap = useMemo(
		() => buildSnippetInspectMap(mainSource, componentFiles),
		[componentFiles, mainSource],
	)

	const resolveInspectTarget = useCallback(
		(source: PreviewSourceLocation | null) => {
			if (!source?.lineNumber) return null
			return inspectMap.resolve(source.lineNumber, source.columnNumber)
		},
		[inspectMap],
	)

	const onPreviewInspectHover = useCallback(
		(source: PreviewSourceLocation | null) => {
			if (!inspectMode) return
			const target = resolveInspectTarget(source)
			if (!target) {
				setInspectHover(null)
				return
			}
			setInspectHover(target)
		},
		[inspectMode, resolveInspectTarget],
	)

	const onPreviewInspectSelect = useCallback(
		(source: PreviewSourceLocation | null) => {
			if (!inspectMode) return
			const target = resolveInspectTarget(source)
			if (!target) {
				setInspectSelection(null)
				return
			}
			setInspectSelection(target)
			setInspectHover(null)
			if (target.fileId !== activeFile) {
				onOpenFileForInspect(target.fileId)
			}
		},
		[activeFile, inspectMode, onOpenFileForInspect, resolveInspectTarget],
	)

	const activeSource = useMemo(() => {
		if (activeFile === "source") return mainEditorSource
		if (!isComponentFileId(activeFile)) return ""
		const fileName = getComponentFileName(activeFile)
		if (!fileName) return ""
		return componentFiles[fileName] ?? ""
	}, [activeFile, componentFiles, mainEditorSource])

	const elementLocator = useMemo(
		() => createSnippetElementLocator(inspectMode ? activeSource : ""),
		[activeSource, inspectMode],
	)

	const resolveHighlight = useCallback(
		(target: SnippetInspectTarget | null, kind: "hover" | "select") => {
			if (!target || target.fileId !== activeFile) return null
			const match = elementLocator.findMatch(target.line, target.column)
			const startLine = match?.startLine ?? target.line
			const endLine = match?.endLine ?? target.line
			return {
				...target,
				kind,
				startLine,
				endLine,
				textRanges: match?.textRanges ?? [],
			}
		},
		[activeFile, elementLocator],
	)

	useEffect(() => {
		if (isExamplePreviewActive) {
			setInspectMode(false)
		}
	}, [isExamplePreviewActive])

	useEffect(() => {
		if (inspectMode) return
		setInspectHover(null)
		setInspectSelection(null)
	}, [inspectMode])

	const inspectHighlight = useMemo<SnippetInspectHighlight | null>(() => {
		if (inspectSelection) {
			return resolveHighlight(inspectSelection, "select")
		}
		if (inspectHover) {
			return resolveHighlight(inspectHover, "hover")
		}
		return null
	}, [inspectHover, inspectSelection, resolveHighlight])

	return {
		inspectMode,
		setInspectMode,
		inspectEnabled: inspectMode && !isExamplePreviewActive,
		inspectHighlight,
		onPreviewInspectHover,
		onPreviewInspectSelect,
	}
}
