import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { CollapsibleSection } from "@/routes/-snippets/editor/components/collapsible-section"
import { RADIUS_SCALE } from "../constants"
import type { ScheduleApplyFn, StylesPanelDensity, StylesPanelExpandedState } from "../types"
import { ensureOption, parseOptionalNumber } from "../utils"

type RadiusSectionProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	show: boolean
	canApply: boolean
	baseSelectClassName: string
	density?: StylesPanelDensity
	radiusMode: "scale" | "custom"
	setRadiusMode: Dispatch<SetStateAction<"scale" | "custom">>
	radiusScale: string
	setRadiusScale: Dispatch<SetStateAction<string>>
	radiusCustom: string
	setRadiusCustom: Dispatch<SetStateAction<string>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function RadiusSection({
	open,
	onOpenChange,
	show,
	canApply,
	baseSelectClassName,
	density = "default",
	radiusMode,
	setRadiusMode,
	radiusScale,
	setRadiusScale,
	radiusCustom,
	setRadiusCustom,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: RadiusSectionProps) {
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
	const addButtonClassName = cn(
		"justify-start px-0 text-neutral-500 hover:text-neutral-900",
		isCompact && "h-7 text-[11px]",
	)
	return (
		<div data-testid="snippet-styles-section-radius">
			<CollapsibleSection title="Radius" open={open} onOpenChange={onOpenChange}>
				<div className={stackClassName}>
					{show ? (
						<div className={fieldStackClassName}>
							<div className="flex items-center justify-between gap-2">
								<Label className={labelClassName}>Radius</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className={iconButtonClassName}
									onClick={() => {
										setExpanded((prev) => ({ ...prev, borderRadius: false }))
										onOpenChange(false)
										scheduleApply({ borderRadius: null }, "Remove radius", { immediate: true })
									}}
									disabled={!canApply}
									aria-label="Remove radius"
									title="Remove"
								>
									<Trash2 className={iconClassName} />
								</Button>
							</div>
							<Tabs
								value={radiusMode}
								onValueChange={(next) => setRadiusMode(next === "custom" ? "custom" : "scale")}
							>
								<TabsList className={tabsListClassName}>
									<TabsTrigger className={tabsTriggerClassName} value="scale">
										Scale
									</TabsTrigger>
									<TabsTrigger className={tabsTriggerClassName} value="custom">
										Custom
									</TabsTrigger>
								</TabsList>
								<TabsContent value="scale">
									<select
										value={radiusScale}
										onChange={(event) => {
											const next = event.target.value
											setRadiusScale(next)
											setRadiusMode("scale")
											scheduleApply({ borderRadius: next || null }, "Update radius")
										}}
										onFocus={() => {
											focusedFieldRef.current = "borderRadius-scale"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "borderRadius-scale") {
												focusedFieldRef.current = null
											}
										}}
										className={baseSelectClassName}
										disabled={!canApply}
									>
										{ensureOption(RADIUS_SCALE, radiusScale, "Custom").map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</TabsContent>
								<TabsContent value="custom">
									<Input
										inputMode="numeric"
										value={radiusCustom}
										onChange={(event) => {
											const next = event.target.value
											setRadiusCustom(next)
											setRadiusMode("custom")
											const parsed = parseOptionalNumber(next)
											if (parsed === null) {
												scheduleApply({ borderRadius: null }, "Remove radius", { immediate: true })
												return
											}
											if (parsed !== "invalid") {
												scheduleApply({ borderRadius: parsed }, "Update radius")
											}
										}}
										onFocus={() => {
											focusedFieldRef.current = "borderRadius-custom"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "borderRadius-custom") {
												focusedFieldRef.current = null
											}
											if (!radiusCustom.trim()) {
												setExpanded((prev) => ({ ...prev, borderRadius: false }))
												onOpenChange(false)
											}
										}}
										placeholder="12"
										disabled={!canApply}
										className={inputClassName}
										aria-invalid={
											radiusCustom.trim().length > 0 &&
											parseOptionalNumber(radiusCustom) === "invalid"
												? true
												: undefined
										}
									/>
								</TabsContent>
							</Tabs>
						</div>
					) : (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className={addButtonClassName}
							onClick={() => setExpanded((prev) => ({ ...prev, borderRadius: true }))}
							disabled={!canApply}
						>
							<Plus className={cn("mr-2 h-4 w-4", isCompact && "h-3.5 w-3.5")} />
							Add radius
						</Button>
					)}
				</div>
			</CollapsibleSection>
		</div>
	)
}
