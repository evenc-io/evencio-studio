import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { FONT_FAMILY_OPTIONS } from "../../constants"
import type { ScheduleApplyFn, StylesPanelDensity } from "../../types"

type FontFamilyFieldProps = {
	canApply: boolean
	baseSelectClassName: string
	density?: StylesPanelDensity
	fontFamily: string
	setFontFamily: Dispatch<SetStateAction<string>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function FontFamilyField({
	canApply,
	baseSelectClassName,
	density = "default",
	fontFamily,
	setFontFamily,
	focusedFieldRef,
	scheduleApply,
}: FontFamilyFieldProps) {
	const isCompact = density === "compact"
	const stackClassName = cn("space-y-2", isCompact && "space-y-1.5")
	const labelClassName = cn("text-xs text-neutral-600", isCompact && "text-[11px]")

	return (
		<div className={stackClassName}>
			<Label className={labelClassName}>Font family</Label>
			<select
				aria-label="Font family"
				value={fontFamily}
				onChange={(event) => {
					const next = event.target.value
					setFontFamily(next)
					scheduleApply({ fontFamily: next || null }, "Update typography", {
						immediate: !next,
					})
				}}
				onFocus={() => {
					focusedFieldRef.current = "fontFamily"
				}}
				onBlur={() => {
					if (focusedFieldRef.current === "fontFamily") {
						focusedFieldRef.current = null
					}
				}}
				className={baseSelectClassName}
				disabled={!canApply}
			>
				{FONT_FAMILY_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</div>
	)
}
