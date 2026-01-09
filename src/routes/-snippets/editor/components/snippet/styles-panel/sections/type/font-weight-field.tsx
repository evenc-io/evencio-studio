import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { FONT_WEIGHT_SCALE } from "../../constants"
import type { ScheduleApplyFn, StylesPanelDensity, StylesPanelExpandedState } from "../../types"
import { ensureOption, parseOptionalNumber } from "../../utils"

type FontWeightFieldProps = {
	show: boolean
	canApply: boolean
	baseSelectClassName: string
	density?: StylesPanelDensity
	fontWeightMode: "scale" | "custom"
	setFontWeightMode: Dispatch<SetStateAction<"scale" | "custom">>
	fontWeightScale: string
	setFontWeightScale: Dispatch<SetStateAction<string>>
	fontWeightCustom: string
	setFontWeightCustom: Dispatch<SetStateAction<string>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function FontWeightField({
	show,
	canApply,
	baseSelectClassName,
	density = "default",
	fontWeightMode,
	setFontWeightMode,
	fontWeightScale,
	setFontWeightScale,
	fontWeightCustom,
	setFontWeightCustom,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: FontWeightFieldProps) {
	const isCompact = density === "compact"
	const stackClassName = cn("space-y-2", isCompact && "space-y-1.5")
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

	if (!show) {
		return (
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={addButtonClassName}
				onClick={() => setExpanded((prev) => ({ ...prev, fontWeight: true }))}
				disabled={!canApply}
			>
				<Plus className={cn("mr-2 h-4 w-4", isCompact && "h-3.5 w-3.5")} />
				Add font weight
			</Button>
		)
	}

	return (
		<div className={stackClassName}>
			<div className="flex items-center justify-between gap-2">
				<Label className={labelClassName}>Font weight</Label>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={iconButtonClassName}
					onClick={() => {
						setExpanded((prev) => ({ ...prev, fontWeight: false }))
						scheduleApply({ fontWeight: null }, "Remove font weight", { immediate: true })
					}}
					disabled={!canApply}
					aria-label="Remove font weight"
					title="Remove"
				>
					<Trash2 className={iconClassName} />
				</Button>
			</div>
			<Tabs
				value={fontWeightMode}
				onValueChange={(next) => setFontWeightMode(next === "custom" ? "custom" : "scale")}
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
						value={fontWeightScale}
						onChange={(event) => {
							const next = event.target.value
							setFontWeightScale(next)
							setFontWeightMode("scale")
							scheduleApply({ fontWeight: next || null }, "Update typography")
						}}
						onFocus={() => {
							focusedFieldRef.current = "fontWeight-scale"
						}}
						onBlur={() => {
							if (focusedFieldRef.current === "fontWeight-scale") {
								focusedFieldRef.current = null
							}
						}}
						className={baseSelectClassName}
						disabled={!canApply}
					>
						{ensureOption(FONT_WEIGHT_SCALE, fontWeightScale, "Custom").map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</TabsContent>
				<TabsContent value="custom">
					<Input
						inputMode="numeric"
						value={fontWeightCustom}
						onChange={(event) => {
							const next = event.target.value
							setFontWeightCustom(next)
							setFontWeightMode("custom")
							const parsed = parseOptionalNumber(next)
							if (parsed === null) {
								scheduleApply({ fontWeight: null }, "Remove font weight", { immediate: true })
								return
							}
							if (parsed !== "invalid") {
								scheduleApply({ fontWeight: parsed }, "Update typography")
							}
						}}
						onFocus={() => {
							focusedFieldRef.current = "fontWeight-custom"
						}}
						onBlur={() => {
							if (focusedFieldRef.current === "fontWeight-custom") {
								focusedFieldRef.current = null
							}
							if (!fontWeightCustom.trim()) {
								setExpanded((prev) => ({ ...prev, fontWeight: false }))
							}
						}}
						placeholder="600"
						disabled={!canApply}
						className={inputClassName}
						aria-invalid={
							fontWeightCustom.trim().length > 0 &&
							parseOptionalNumber(fontWeightCustom) === "invalid"
								? true
								: undefined
						}
					/>
				</TabsContent>
			</Tabs>
		</div>
	)
}
