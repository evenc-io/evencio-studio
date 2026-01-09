import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { CollapsibleSection } from "@/routes/-snippets/editor/components/collapsible-section"
import { TailwindColorPicker } from "../tailwind-color-picker"
import type {
	ColorDraft,
	ScheduleApplyFn,
	StylesPanelDensity,
	StylesPanelExpandedState,
} from "../types"
import { normalizeHexColor } from "../utils"

type BackgroundSectionProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	show: boolean
	canApply: boolean
	baseSelectClassName: string
	density?: StylesPanelDensity
	draft: ColorDraft
	setDraft: Dispatch<SetStateAction<ColorDraft>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function BackgroundSection({
	open,
	onOpenChange,
	show,
	canApply,
	baseSelectClassName,
	density = "default",
	draft,
	setDraft,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: BackgroundSectionProps) {
	const isCompact = density === "compact"
	const stackClassName = cn("space-y-3", isCompact && "space-y-2")
	const fieldStackClassName = cn("space-y-2", isCompact && "space-y-1.5")
	const labelClassName = cn("text-xs text-neutral-600", isCompact && "text-[11px]")
	const tabsListClassName = cn("w-full", isCompact && "h-8")
	const tabsTriggerClassName = cn(isCompact && "px-2 py-0.5 text-[11px]")
	const iconButtonClassName = cn(
		"h-7 w-7 text-neutral-400 hover:text-neutral-700",
		isCompact && "h-6 w-6",
	)
	const iconClassName = cn("h-4 w-4", isCompact && "h-3.5 w-3.5")
	const inputClassName = cn(isCompact && "h-8 px-2 text-[11px] md:text-[11px]")
	const swatchInputClassName = cn(
		"h-9 w-9 rounded-md border border-neutral-200 bg-white p-1",
		isCompact && "h-8 w-8",
	)
	const addButtonClassName = cn(
		"justify-start px-0 text-neutral-500 hover:text-neutral-900",
		isCompact && "h-7 text-[11px]",
	)
	return (
		<div data-testid="snippet-styles-section-background">
			<CollapsibleSection title="Background" open={open} onOpenChange={onOpenChange}>
				<div className={stackClassName}>
					{show ? (
						<div className={fieldStackClassName}>
							<div className="flex items-center justify-between gap-2">
								<Label className={labelClassName}>Color</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className={iconButtonClassName}
									onClick={() => {
										setExpanded((prev) => ({ ...prev, backgroundColor: false }))
										onOpenChange(false)
										scheduleApply({ backgroundColor: null }, "Remove background", {
											immediate: true,
										})
									}}
									disabled={!canApply}
									aria-label="Remove background"
									title="Remove"
								>
									<Trash2 className={iconClassName} />
								</Button>
							</div>
							<Tabs
								value={draft.mode}
								onValueChange={(next) =>
									setDraft((prev) => ({
										...prev,
										mode: next === "custom" ? "custom" : "token",
									}))
								}
							>
								<TabsList className={tabsListClassName}>
									<TabsTrigger className={tabsTriggerClassName} value="token">
										Token
									</TabsTrigger>
									<TabsTrigger className={tabsTriggerClassName} value="custom">
										Custom
									</TabsTrigger>
								</TabsList>
								<TabsContent value="token">
									<TailwindColorPicker
										value={draft.token}
										onValueChange={(next) => {
											setDraft((prev) => ({ ...prev, token: next, mode: "token" }))
											scheduleApply({ backgroundColor: next || null }, "Update background")
										}}
										disabled={!canApply}
										buttonClassName={baseSelectClassName}
										title="Background color"
										description="Select a Tailwind v4 background token like emerald-500."
										onOpenChange={(nextOpen) => {
											if (nextOpen) {
												focusedFieldRef.current = "backgroundColor-token"
												return
											}
											if (focusedFieldRef.current === "backgroundColor-token") {
												focusedFieldRef.current = null
											}
										}}
									/>
								</TabsContent>
								<TabsContent value="custom">
									<div className="flex items-center gap-2">
										<input
											type="color"
											value={normalizeHexColor(draft.hex) ?? "#000000"}
											onChange={(event) => {
												const next = event.target.value
												setDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
												const normalized = normalizeHexColor(next)
												if (normalized) {
													scheduleApply({ backgroundColor: normalized }, "Update background")
												}
											}}
											onFocus={() => {
												focusedFieldRef.current = "backgroundColor-hex"
											}}
											onBlur={() => {
												if (focusedFieldRef.current === "backgroundColor-hex") {
													focusedFieldRef.current = null
												}
											}}
											className={swatchInputClassName}
											disabled={!canApply}
											aria-label="Pick background color"
										/>
										<Input
											value={draft.hex}
											onChange={(event) => {
												const next = event.target.value
												setDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
												if (!next.trim()) {
													scheduleApply({ backgroundColor: null }, "Remove background", {
														immediate: true,
													})
													return
												}
												const normalized = normalizeHexColor(next)
												if (normalized) {
													scheduleApply({ backgroundColor: normalized }, "Update background")
												}
											}}
											onFocus={() => {
												focusedFieldRef.current = "backgroundColor-hex-input"
											}}
											onBlur={() => {
												if (focusedFieldRef.current === "backgroundColor-hex-input") {
													focusedFieldRef.current = null
												}
												if (!draft.hex.trim()) {
													setExpanded((prev) => ({ ...prev, backgroundColor: false }))
													onOpenChange(false)
												}
											}}
											placeholder="#000000"
											disabled={!canApply}
											className={inputClassName}
											aria-invalid={
												draft.hex.trim().length > 0 && normalizeHexColor(draft.hex) === null
													? true
													: undefined
											}
										/>
									</div>
								</TabsContent>
							</Tabs>
						</div>
					) : (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className={addButtonClassName}
							onClick={() => setExpanded((prev) => ({ ...prev, backgroundColor: true }))}
							disabled={!canApply}
						>
							<Plus className={cn("mr-2 h-4 w-4", isCompact && "h-3.5 w-3.5")} />
							Add background
						</Button>
					)}
				</div>
			</CollapsibleSection>
		</div>
	)
}
