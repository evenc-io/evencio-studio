import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { CollapsibleSection } from "@/routes/-snippets/editor/components/collapsible-section"
import { BORDER_WIDTH_SCALE } from "../constants"
import { TailwindColorPicker } from "../tailwind-color-picker"
import type {
	ColorDraft,
	ScheduleApplyFn,
	StylesPanelDensity,
	StylesPanelExpandedState,
} from "../types"
import { normalizeHexColor, parseOptionalNumber } from "../utils"

type BorderSectionProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	canApply: boolean
	baseSelectClassName: string
	density?: StylesPanelDensity
	showBorderWidth: boolean
	showBorderColor: boolean
	hasBorderWidth: boolean
	hasBorderColor: boolean
	borderWidthMode: "scale" | "custom"
	setBorderWidthMode: Dispatch<SetStateAction<"scale" | "custom">>
	borderWidthScale: string
	setBorderWidthScale: Dispatch<SetStateAction<string>>
	borderWidthCustom: string
	setBorderWidthCustom: Dispatch<SetStateAction<string>>
	borderColorDraft: ColorDraft
	setBorderColorDraft: Dispatch<SetStateAction<ColorDraft>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function BorderSection({
	open,
	onOpenChange,
	canApply,
	baseSelectClassName,
	density = "default",
	showBorderWidth,
	showBorderColor,
	hasBorderWidth,
	hasBorderColor,
	borderWidthMode,
	setBorderWidthMode,
	borderWidthScale,
	setBorderWidthScale,
	borderWidthCustom,
	setBorderWidthCustom,
	borderColorDraft,
	setBorderColorDraft,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: BorderSectionProps) {
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
		<div data-testid="snippet-styles-section-border">
			<CollapsibleSection title="Border" open={open} onOpenChange={onOpenChange}>
				<div className={stackClassName}>
					{showBorderWidth ? (
						<div className={fieldStackClassName}>
							<div className="flex items-center justify-between gap-2">
								<Label className={labelClassName}>Width</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className={iconButtonClassName}
									onClick={() => {
										setExpanded((prev) => ({ ...prev, borderWidth: false }))
										if (!hasBorderColor) {
											onOpenChange(false)
										}
										scheduleApply({ borderWidth: null }, "Remove border width", { immediate: true })
									}}
									disabled={!canApply}
									aria-label="Remove border width"
									title="Remove"
								>
									<Trash2 className={iconClassName} />
								</Button>
							</div>
							<Tabs
								value={borderWidthMode}
								onValueChange={(next) => setBorderWidthMode(next === "custom" ? "custom" : "scale")}
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
										value={borderWidthScale}
										onChange={(event) => {
											const next = event.target.value
											setBorderWidthScale(next)
											setBorderWidthMode("scale")
											const numeric = Number(next)
											if (Number.isFinite(numeric)) {
												scheduleApply({ borderWidth: numeric }, "Update border")
											}
										}}
										onFocus={() => {
											focusedFieldRef.current = "borderWidth-scale"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "borderWidth-scale") {
												focusedFieldRef.current = null
											}
										}}
										className={baseSelectClassName}
										disabled={!canApply}
									>
										{BORDER_WIDTH_SCALE.map((option) => (
											<option key={option.value} value={String(option.value)}>
												{option.label}
											</option>
										))}
									</select>
								</TabsContent>
								<TabsContent value="custom">
									<Input
										inputMode="numeric"
										value={borderWidthCustom}
										onChange={(event) => {
											const next = event.target.value
											setBorderWidthCustom(next)
											setBorderWidthMode("custom")
											const parsed = parseOptionalNumber(next)
											if (parsed === null) {
												scheduleApply({ borderWidth: null }, "Remove border width", {
													immediate: true,
												})
												return
											}
											if (parsed !== "invalid") {
												scheduleApply({ borderWidth: parsed }, "Update border")
											}
										}}
										onFocus={() => {
											focusedFieldRef.current = "borderWidth-custom"
										}}
										onBlur={() => {
											if (focusedFieldRef.current === "borderWidth-custom") {
												focusedFieldRef.current = null
											}
											if (!borderWidthCustom.trim()) {
												setExpanded((prev) => ({ ...prev, borderWidth: false }))
												if (!hasBorderColor) {
													onOpenChange(false)
												}
											}
										}}
										placeholder="1"
										disabled={!canApply}
										className={inputClassName}
										aria-invalid={
											borderWidthCustom.trim().length > 0 &&
											parseOptionalNumber(borderWidthCustom) === "invalid"
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
							onClick={() => setExpanded((prev) => ({ ...prev, borderWidth: true }))}
							disabled={!canApply}
						>
							<Plus className={cn("mr-2 h-4 w-4", isCompact && "h-3.5 w-3.5")} />
							Add border width
						</Button>
					)}

					{showBorderColor ? (
						<div className={fieldStackClassName}>
							<div className="flex items-center justify-between gap-2">
								<Label className={labelClassName}>Color</Label>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className={iconButtonClassName}
									onClick={() => {
										setExpanded((prev) => ({ ...prev, borderColor: false }))
										if (!hasBorderWidth) {
											onOpenChange(false)
										}
										scheduleApply({ borderColor: null }, "Remove border color", { immediate: true })
									}}
									disabled={!canApply}
									aria-label="Remove border color"
									title="Remove"
								>
									<Trash2 className={iconClassName} />
								</Button>
							</div>
							<Tabs
								value={borderColorDraft.mode}
								onValueChange={(next) =>
									setBorderColorDraft((prev) => ({
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
										value={borderColorDraft.token}
										onValueChange={(next) => {
											setBorderColorDraft((prev) => ({ ...prev, token: next, mode: "token" }))
											scheduleApply({ borderColor: next || null }, "Update border")
										}}
										disabled={!canApply}
										buttonClassName={baseSelectClassName}
										title="Border color"
										description="Select a Tailwind v4 border token like emerald-500."
										onOpenChange={(nextOpen) => {
											if (nextOpen) {
												focusedFieldRef.current = "borderColor-token"
												return
											}
											if (focusedFieldRef.current === "borderColor-token") {
												focusedFieldRef.current = null
											}
										}}
									/>
								</TabsContent>
								<TabsContent value="custom">
									<div className="flex items-center gap-2">
										<input
											type="color"
											value={normalizeHexColor(borderColorDraft.hex) ?? "#000000"}
											onChange={(event) => {
												const next = event.target.value
												setBorderColorDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
												const normalized = normalizeHexColor(next)
												if (normalized) {
													scheduleApply({ borderColor: normalized }, "Update border")
												}
											}}
											onFocus={() => {
												focusedFieldRef.current = "borderColor-hex"
											}}
											onBlur={() => {
												if (focusedFieldRef.current === "borderColor-hex") {
													focusedFieldRef.current = null
												}
											}}
											className={swatchInputClassName}
											disabled={!canApply}
											aria-label="Pick border color"
										/>
										<Input
											value={borderColorDraft.hex}
											onChange={(event) => {
												const next = event.target.value
												setBorderColorDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
												if (!next.trim()) {
													scheduleApply({ borderColor: null }, "Remove border color", {
														immediate: true,
													})
													return
												}
												const normalized = normalizeHexColor(next)
												if (normalized) {
													scheduleApply({ borderColor: normalized }, "Update border")
												}
											}}
											onFocus={() => {
												focusedFieldRef.current = "borderColor-hex-input"
											}}
											onBlur={() => {
												if (focusedFieldRef.current === "borderColor-hex-input") {
													focusedFieldRef.current = null
												}
												if (!borderColorDraft.hex.trim()) {
													setExpanded((prev) => ({ ...prev, borderColor: false }))
													if (!hasBorderWidth) {
														onOpenChange(false)
													}
												}
											}}
											placeholder="#000000"
											disabled={!canApply}
											className={inputClassName}
											aria-invalid={
												borderColorDraft.hex.trim().length > 0 &&
												normalizeHexColor(borderColorDraft.hex) === null
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
							onClick={() => setExpanded((prev) => ({ ...prev, borderColor: true }))}
							disabled={!canApply}
						>
							<Plus className={cn("mr-2 h-4 w-4", isCompact && "h-3.5 w-3.5")} />
							Add border color
						</Button>
					)}
				</div>
			</CollapsibleSection>
		</div>
	)
}
