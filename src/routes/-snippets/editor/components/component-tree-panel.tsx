import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"
import type { SnippetComponentTreeNode } from "@/lib/snippets/component-tree"
import { cn } from "@/lib/utils"

const DEFAULT_EXPAND_DEPTH = 2

const buildDefaultExpanded = (nodes: SnippetComponentTreeNode[]) => {
	const expanded = new Set<string>()
	const visit = (entry: SnippetComponentTreeNode, depth: number) => {
		if (entry.children.length > 0 && depth <= DEFAULT_EXPAND_DEPTH) {
			expanded.add(entry.id)
		}
		if (depth >= DEFAULT_EXPAND_DEPTH) return
		for (const child of entry.children) {
			visit(child, depth + 1)
		}
	}
	for (const node of nodes) {
		visit(node, 0)
	}
	return expanded
}

const formatClassName = (value: string | null, maxChars = 48) => {
	if (!value) return null
	const normalized = value.trim().replace(/\s+/g, " ")
	if (normalized.length <= maxChars) return normalized
	return `${normalized.slice(0, Math.max(0, maxChars - 3))}...`
}

interface ComponentTreePanelProps {
	fileLabel: string
	tree: SnippetComponentTreeNode[]
	width?: number
	selectedId?: string | null
	selectionEnabled?: boolean
	onSelectNode?: (node: SnippetComponentTreeNode) => void
	onClose?: () => void
}

export function SnippetComponentTreePanel({
	fileLabel,
	tree,
	width = 260,
	selectedId = null,
	selectionEnabled = true,
	onSelectNode,
	onClose,
}: ComponentTreePanelProps) {
	const [expanded, setExpanded] = useState<Set<string>>(() => buildDefaultExpanded(tree))

	useEffect(() => {
		setExpanded(buildDefaultExpanded(tree))
	}, [tree])

	const hasTree = tree.length > 0

	const toggleNode = (id: string) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}

	const handleSelect = (node: SnippetComponentTreeNode) => {
		if (!selectionEnabled) return
		onSelectNode?.(node)
	}

	const renderNode = (node: SnippetComponentTreeNode, depth: number) => {
		const isExpanded = expanded.has(node.id)
		const hasChildren = node.children.length > 0
		const rawClasses = node.className ? node.className.trim().replace(/\s+/g, " ") : null
		const displayClasses = formatClassName(rawClasses)
		const isSelected = selectedId === node.id
		const canSelect = selectionEnabled && Boolean(node.source)

		return (
			<div key={node.id}>
				<div
					className={cn(
						"group flex items-center gap-1 rounded-sm px-1 py-0.5",
						isSelected ? "bg-neutral-100 text-neutral-900" : "text-neutral-600",
						canSelect && "hover:bg-neutral-50",
					)}
					style={{ paddingLeft: `${8 + depth * 12}px` }}
				>
					<button
						type="button"
						disabled={!hasChildren}
						onClick={() => toggleNode(node.id)}
						className={cn(
							"flex h-4 w-4 items-center justify-center text-neutral-400",
							hasChildren ? "opacity-100" : "opacity-0",
							hasChildren && "group-hover:text-neutral-500",
						)}
						aria-label={isExpanded ? "Collapse node" : "Expand node"}
						aria-expanded={hasChildren ? isExpanded : undefined}
					>
						{hasChildren &&
							(isExpanded ? (
								<ChevronDown className="h-3 w-3" />
							) : (
								<ChevronRight className="h-3 w-3" />
							))}
					</button>
					<button
						type="button"
						disabled={!canSelect}
						onClick={() => handleSelect(node)}
						className={cn(
							"flex min-w-0 flex-1 items-center gap-1 text-left text-xs",
							canSelect ? "cursor-pointer" : "cursor-default text-neutral-400",
						)}
						title={rawClasses ? `${node.name} ${rawClasses}` : node.name}
					>
						<span className="shrink-0 font-medium text-neutral-700">{node.name}</span>
						{displayClasses && (
							<span className="truncate text-[10px] text-neutral-400">.{displayClasses}</span>
						)}
					</button>
				</div>
				{hasChildren && isExpanded && (
					<div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
				)}
			</div>
		)
	}

	return (
		<aside
			className="flex h-full shrink-0 flex-col border-r border-neutral-200 bg-white"
			style={{ width: `${width}px` }}
		>
			<div className="flex h-9 items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-3">
				<div className="flex min-w-0 items-center gap-2">
					<span className="text-xs font-medium text-neutral-600">Components</span>
					<span
						title={fileLabel}
						className="max-w-[140px] truncate rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] text-neutral-500"
					>
						{fileLabel}
					</span>
				</div>
				{onClose && (
					<button
						type="button"
						onClick={onClose}
						className="flex h-6 w-6 items-center justify-center rounded-sm text-neutral-400 hover:text-neutral-600"
						aria-label="Hide component tree"
						title="Hide component tree"
					>
						<ChevronLeft className="h-3.5 w-3.5" />
					</button>
				)}
			</div>
			<div className="flex-1 overflow-auto px-2 py-2">
				{!selectionEnabled && (
					<div className="mb-2 rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] text-neutral-500">
						Selection is unavailable for the current preview.
					</div>
				)}
				{!hasTree && (
					<div className="rounded border border-neutral-200 bg-neutral-50 px-2 py-2 text-xs text-neutral-500">
						No JSX tree available for this file yet.
					</div>
				)}
				{hasTree && <div className="space-y-0.5">{tree.map((node) => renderNode(node, 0))}</div>}
			</div>
		</aside>
	)
}
