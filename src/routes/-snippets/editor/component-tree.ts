import type { SnippetComponentTreeNode } from "@/lib/snippets/component-tree"
import type { PreviewSourceLocation } from "@/lib/snippets/preview/runtime"
import {
	buildSnippetLineMapSegments,
	type SnippetLineMapSegment,
} from "@/lib/snippets/source/files"
import { scanAutoImportOffsetWasmSync } from "@/lib/wasm/snippet-wasm"
import type { SnippetEditorFileId } from "@/routes/-snippets/editor/snippet-editor-types"

const PREVIEW_SOURCE_FILENAME = "Snippet.tsx"
export type ComponentTreeNode = SnippetComponentTreeNode

const getAutoImportOffsetFallback = (mainSource: string) => {
	const lines = mainSource.split(/\r?\n/)
	let index = 0
	let sawImport = false

	while (index < lines.length) {
		const line = lines[index]
		if (/^\s*\/\/\s*Auto-managed imports/i.test(line) || /^\s*\/\/\s*@import\s+/.test(line)) {
			sawImport = true
			index += 1
			continue
		}
		if (sawImport && line.trim() === "") {
			index += 1
			continue
		}
		break
	}

	return index
}

export const getAutoImportOffset = (mainSource: string) =>
	scanAutoImportOffsetWasmSync(mainSource) ?? getAutoImportOffsetFallback(mainSource)

const resolveExpandedLine = (
	segments: SnippetLineMapSegment[],
	fileName: string | null,
	originalLine: number,
) => {
	for (const segment of segments) {
		if (segment.fileName !== fileName) continue
		const segmentEnd = segment.originalStartLine + segment.lineCount - 1
		if (originalLine < segment.originalStartLine || originalLine > segmentEnd) continue
		return segment.expandedStartLine + (originalLine - segment.originalStartLine)
	}
	return null
}

export const resolvePreviewSourceLocation = ({
	fileId,
	fileName,
	line,
	column,
	mainSource,
	files,
	lineMapSegments,
	autoImportOffset,
}: {
	fileId: SnippetEditorFileId
	fileName: string | null
	line: number
	column: number
	mainSource: string
	files: Record<string, string>
	lineMapSegments?: SnippetLineMapSegment[]
	autoImportOffset?: number
}): PreviewSourceLocation | null => {
	if (!Number.isFinite(line) || line <= 0 || !Number.isFinite(column)) return null
	const segments = lineMapSegments ?? buildSnippetLineMapSegments(mainSource, files)
	if (!segments || segments.length === 0) return null

	const isSourceFile = fileId === "source"
	if (!isSourceFile && !fileName) return null
	const offset =
		isSourceFile && typeof autoImportOffset === "number"
			? autoImportOffset
			: isSourceFile
				? getAutoImportOffset(mainSource)
				: 0
	const originalLine = Math.max(1, Math.floor(line + offset))
	const resolved = resolveExpandedLine(segments, isSourceFile ? null : fileName, originalLine)
	if (!resolved) return null

	return {
		fileName: PREVIEW_SOURCE_FILENAME,
		lineNumber: resolved,
		columnNumber: Math.max(0, Math.floor(column)),
	}
}
