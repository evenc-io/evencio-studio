import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { LETTER_SPACING_SCALE } from "../../constants"
import type { ScheduleApplyFn, StylesPanelDensity } from "../../types"
import { ensureOption } from "../../utils"

type LetterSpacingFieldProps = {
	canApply: boolean
	baseSelectClassName: string
	density?: StylesPanelDensity
	letterSpacingMode: "scale" | "custom"
	setLetterSpacingMode: Dispatch<SetStateAction<"scale" | "custom">>
	letterSpacingScale: string
	setLetterSpacingScale: Dispatch<SetStateAction<string>>
	letterSpacingCustom: string
	setLetterSpacingCustom: Dispatch<SetStateAction<string>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function LetterSpacingField({
	canApply,
	baseSelectClassName,
	density = "default",
	letterSpacingMode,
	setLetterSpacingMode,
	letterSpacingScale,
	setLetterSpacingScale,
	letterSpacingCustom,
	setLetterSpacingCustom,
	focusedFieldRef,
	scheduleApply,
}: LetterSpacingFieldProps) {
	const isCompact = density === "compact"
	const stackClassName = cn("space-y-2", isCompact && "space-y-1.5")
	const labelClassName = cn("text-xs text-neutral-600", isCompact && "text-[11px]")
	const tabsListClassName = cn("w-full", isCompact && "h-8")
	const tabsTriggerClassName = cn(isCompact && "px-2 py-0.5 text-[11px]")
	const inputClassName = cn(isCompact && "h-8 px-2 text-[11px] md:text-[11px]")

	return (
		<div className={stackClassName}>
			<Label className={labelClassName}>Letter spacing</Label>
			<Tabs
				value={letterSpacingMode}
				onValueChange={(next) => setLetterSpacingMode(next === "custom" ? "custom" : "scale")}
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
						value={letterSpacingScale}
						onChange={(event) => {
							const next = event.target.value
							setLetterSpacingScale(next)
							setLetterSpacingMode("scale")
							scheduleApply({ letterSpacing: next || null }, "Update typography", {
								immediate: !next,
							})
						}}
						onFocus={() => {
							focusedFieldRef.current = "letterSpacing-scale"
						}}
						onBlur={() => {
							if (focusedFieldRef.current === "letterSpacing-scale") {
								focusedFieldRef.current = null
							}
						}}
						className={baseSelectClassName}
						disabled={!canApply}
					>
						{ensureOption(LETTER_SPACING_SCALE, letterSpacingScale, "Custom").map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</TabsContent>
				<TabsContent value="custom">
					<Input
						value={letterSpacingCustom}
						onChange={(event) => {
							const next = event.target.value
							setLetterSpacingCustom(next)
							setLetterSpacingMode("custom")
							const trimmed = next.trim()
							if (!trimmed) {
								scheduleApply({ letterSpacing: null }, "Remove letter spacing", { immediate: true })
								return
							}

							if (
								/^(tighter|tight|normal|wide|wider|widest)$/.test(trimmed) ||
								(trimmed.startsWith("[") && trimmed.endsWith("]"))
							) {
								scheduleApply({ letterSpacing: trimmed }, "Update typography")
								return
							}

							scheduleApply({ letterSpacing: `[${trimmed}]` }, "Update typography")
						}}
						onFocus={() => {
							focusedFieldRef.current = "letterSpacing-custom"
						}}
						onBlur={() => {
							if (focusedFieldRef.current === "letterSpacing-custom") {
								focusedFieldRef.current = null
							}
						}}
						placeholder="-0.02em"
						disabled={!canApply}
						className={inputClassName}
					/>
				</TabsContent>
			</Tabs>
		</div>
	)
}
