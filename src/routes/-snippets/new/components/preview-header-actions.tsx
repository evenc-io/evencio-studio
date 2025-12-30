import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SnippetPreviewHeaderActionsProps {
	isExamplePreviewing: boolean
	activeExampleTitle?: string
	activeComponentLabel: string
	useComponentDefaults: boolean
	onExitExamplePreview: () => void
	onToggleDefaults: () => void
	inspectEnabled?: boolean
	onToggleInspect?: () => void
	layers3dEnabled?: boolean
	onToggleLayers3d?: () => void
}

export function SnippetPreviewHeaderActions({
	isExamplePreviewing,
	activeExampleTitle,
	activeComponentLabel,
	useComponentDefaults,
	onExitExamplePreview,
	onToggleDefaults,
	inspectEnabled = false,
	onToggleInspect,
	layers3dEnabled = false,
	onToggleLayers3d,
}: SnippetPreviewHeaderActionsProps) {
	if (isExamplePreviewing) {
		return (
			<>
				<span className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
					Example
				</span>
				<span className="max-w-[140px] truncate text-[11px] text-neutral-500">
					{activeExampleTitle}
				</span>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-6 px-2 text-[11px]"
					onClick={onExitExamplePreview}
				>
					Back to snippet
				</Button>
				{onToggleLayers3d && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							"h-6 px-2 text-[11px]",
							layers3dEnabled
								? "bg-neutral-900 text-white hover:bg-neutral-800"
								: "text-neutral-500 hover:text-neutral-700",
						)}
						aria-pressed={layers3dEnabled}
						onClick={onToggleLayers3d}
					>
						Layers 3D
					</Button>
				)}
			</>
		)
	}

	return (
		<>
			<span className="max-w-[140px] truncate text-[11px] text-neutral-500">
				Component: {activeComponentLabel}
			</span>
			{onToggleLayers3d && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={cn(
						"h-6 px-2 text-[11px]",
						layers3dEnabled
							? "bg-neutral-900 text-white hover:bg-neutral-800"
							: "text-neutral-500 hover:text-neutral-700",
					)}
					aria-pressed={layers3dEnabled}
					onClick={onToggleLayers3d}
				>
					Layers 3D
				</Button>
			)}
			{onToggleInspect && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className={cn(
						"h-6 px-2 text-[11px]",
						inspectEnabled
							? "bg-neutral-900 text-white hover:bg-neutral-800"
							: "text-neutral-500 hover:text-neutral-700",
					)}
					aria-pressed={inspectEnabled}
					onClick={onToggleInspect}
				>
					Inspect
				</Button>
			)}
			{inspectEnabled && (
				<span className="hidden text-[10px] font-semibold uppercase tracking-widest text-neutral-400 md:inline">
					Right click to edit text
				</span>
			)}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={cn(
					"h-6 px-2 text-[11px]",
					useComponentDefaults
						? "bg-neutral-900 text-white hover:bg-neutral-800"
						: "text-neutral-500 hover:text-neutral-700",
				)}
				aria-pressed={useComponentDefaults}
				onClick={onToggleDefaults}
			>
				Preview: {useComponentDefaults ? "Component defaults" : "Default props"}
			</Button>
		</>
	)
}
