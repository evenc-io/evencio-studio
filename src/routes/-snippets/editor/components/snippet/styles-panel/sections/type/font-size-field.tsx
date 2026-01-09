import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { FONT_SIZE_SCALE } from "../../constants"
import type { ScheduleApplyFn, StylesPanelDensity, StylesPanelExpandedState } from "../../types"
import { ensureOption, parseOptionalNumber } from "../../utils"

type FontSizeFieldProps = {
	show: boolean
	canApply: boolean
	baseSelectClassName: string
	density?: StylesPanelDensity
	fontSizeMode: "scale" | "custom"
	setFontSizeMode: Dispatch<SetStateAction<"scale" | "custom">>
	fontSizeScale: string
	setFontSizeScale: Dispatch<SetStateAction<string>>
	fontSizeCustom: string
	setFontSizeCustom: Dispatch<SetStateAction<string>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function FontSizeField({
	show,
	canApply,
	baseSelectClassName,
	density = "default",
	fontSizeMode,
	setFontSizeMode,
	fontSizeScale,
	setFontSizeScale,
	fontSizeCustom,
	setFontSizeCustom,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: FontSizeFieldProps) {
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
				onClick={() => setExpanded((prev) => ({ ...prev, fontSize: true }))}
				disabled={!canApply}
			>
				<Plus className={cn("mr-2 h-4 w-4", isCompact && "h-3.5 w-3.5")} />
				Add font size
			</Button>
		)
	}

	return (
		<div className={stackClassName}>
			<div className="flex items-center justify-between gap-2">
				<Label className={labelClassName}>Font size</Label>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={iconButtonClassName}
					onClick={() => {
						setExpanded((prev) => ({ ...prev, fontSize: false }))
						scheduleApply({ fontSize: null }, "Remove font size", { immediate: true })
					}}
					disabled={!canApply}
					aria-label="Remove font size"
					title="Remove"
				>
					<Trash2 className={iconClassName} />
				</Button>
			</div>
			<Tabs
				value={fontSizeMode}
				onValueChange={(next) => setFontSizeMode(next === "custom" ? "custom" : "scale")}
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
						value={fontSizeScale}
						onChange={(event) => {
							const next = event.target.value
							setFontSizeScale(next)
							setFontSizeMode("scale")
							scheduleApply({ fontSize: next || null }, "Update typography")
						}}
						onFocus={() => {
							focusedFieldRef.current = "fontSize-scale"
						}}
						onBlur={() => {
							if (focusedFieldRef.current === "fontSize-scale") {
								focusedFieldRef.current = null
							}
						}}
						className={baseSelectClassName}
						disabled={!canApply}
					>
						{ensureOption(FONT_SIZE_SCALE, fontSizeScale, "Custom").map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</TabsContent>
				<TabsContent value="custom">
					<Input
						inputMode="numeric"
						value={fontSizeCustom}
						onChange={(event) => {
							const next = event.target.value
							setFontSizeCustom(next)
							setFontSizeMode("custom")
							const parsed = parseOptionalNumber(next)
							if (parsed === null) {
								scheduleApply({ fontSize: null }, "Remove font size", { immediate: true })
								return
							}
							if (parsed !== "invalid") {
								scheduleApply({ fontSize: parsed }, "Update typography")
							}
						}}
						onFocus={() => {
							focusedFieldRef.current = "fontSize-custom"
						}}
						onBlur={() => {
							if (focusedFieldRef.current === "fontSize-custom") {
								focusedFieldRef.current = null
							}
							if (!fontSizeCustom.trim()) {
								setExpanded((prev) => ({ ...prev, fontSize: false }))
							}
						}}
						placeholder="16"
						disabled={!canApply}
						className={inputClassName}
						aria-invalid={
							fontSizeCustom.trim().length > 0 && parseOptionalNumber(fontSizeCustom) === "invalid"
								? true
								: undefined
						}
					/>
				</TabsContent>
			</Tabs>
		</div>
	)
}
