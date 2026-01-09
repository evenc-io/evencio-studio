import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { LINE_HEIGHT_SCALE } from "../../constants"
import type { ScheduleApplyFn, StylesPanelDensity } from "../../types"
import { ensureOption, parseOptionalNumber } from "../../utils"

type LineHeightFieldProps = {
	canApply: boolean
	baseSelectClassName: string
	density?: StylesPanelDensity
	lineHeightMode: "scale" | "custom"
	setLineHeightMode: Dispatch<SetStateAction<"scale" | "custom">>
	lineHeightScale: string
	setLineHeightScale: Dispatch<SetStateAction<string>>
	lineHeightCustom: string
	setLineHeightCustom: Dispatch<SetStateAction<string>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function LineHeightField({
	canApply,
	baseSelectClassName,
	density = "default",
	lineHeightMode,
	setLineHeightMode,
	lineHeightScale,
	setLineHeightScale,
	lineHeightCustom,
	setLineHeightCustom,
	focusedFieldRef,
	scheduleApply,
}: LineHeightFieldProps) {
	const isCompact = density === "compact"
	const stackClassName = cn("space-y-2", isCompact && "space-y-1.5")
	const labelClassName = cn("text-xs text-neutral-600", isCompact && "text-[11px]")
	const tabsListClassName = cn("w-full", isCompact && "h-8")
	const tabsTriggerClassName = cn(isCompact && "px-2 py-0.5 text-[11px]")
	const inputClassName = cn(isCompact && "h-8 px-2 text-[11px] md:text-[11px]")

	return (
		<div className={stackClassName}>
			<Label className={labelClassName}>Line height</Label>
			<Tabs
				value={lineHeightMode}
				onValueChange={(next) => setLineHeightMode(next === "custom" ? "custom" : "scale")}
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
						value={lineHeightScale}
						onChange={(event) => {
							const next = event.target.value
							setLineHeightScale(next)
							setLineHeightMode("scale")
							scheduleApply({ lineHeight: next || null }, "Update typography", { immediate: !next })
						}}
						onFocus={() => {
							focusedFieldRef.current = "lineHeight-scale"
						}}
						onBlur={() => {
							if (focusedFieldRef.current === "lineHeight-scale") {
								focusedFieldRef.current = null
							}
						}}
						className={baseSelectClassName}
						disabled={!canApply}
					>
						{ensureOption(LINE_HEIGHT_SCALE, lineHeightScale, "Custom").map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</TabsContent>
				<TabsContent value="custom">
					<Input
						value={lineHeightCustom}
						onChange={(event) => {
							const next = event.target.value
							setLineHeightCustom(next)
							setLineHeightMode("custom")
							const trimmed = next.trim()
							if (!trimmed) {
								scheduleApply({ lineHeight: null }, "Remove line height", { immediate: true })
								return
							}

							const numeric = parseOptionalNumber(trimmed)
							if (numeric !== "invalid" && numeric !== null) {
								scheduleApply({ lineHeight: numeric }, "Update typography")
								return
							}

							if (
								/^(none|tight|snug|normal|relaxed|loose|\\d+)$/.test(trimmed) ||
								(trimmed.startsWith("[") && trimmed.endsWith("]"))
							) {
								scheduleApply({ lineHeight: trimmed }, "Update typography")
								return
							}

							scheduleApply({ lineHeight: `[${trimmed}]` }, "Update typography")
						}}
						onFocus={() => {
							focusedFieldRef.current = "lineHeight-custom"
						}}
						onBlur={() => {
							if (focusedFieldRef.current === "lineHeight-custom") {
								focusedFieldRef.current = null
							}
						}}
						placeholder="1.05 or 104px"
						disabled={!canApply}
						className={inputClassName}
					/>
				</TabsContent>
			</Tabs>
		</div>
	)
}
