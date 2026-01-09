import { Plus, Trash2 } from "lucide-react"
import type { Dispatch, MutableRefObject, SetStateAction } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { TailwindColorPicker } from "../../tailwind-color-picker"
import type {
	ColorDraft,
	ScheduleApplyFn,
	StylesPanelDensity,
	StylesPanelExpandedState,
} from "../../types"
import { normalizeHexColor } from "../../utils"

type TextColorFieldProps = {
	show: boolean
	canApply: boolean
	baseSelectClassName: string
	density?: StylesPanelDensity
	textColorDraft: ColorDraft
	setTextColorDraft: Dispatch<SetStateAction<ColorDraft>>
	setExpanded: Dispatch<SetStateAction<StylesPanelExpandedState>>
	focusedFieldRef: MutableRefObject<string | null>
	scheduleApply: ScheduleApplyFn
}

export function TextColorField({
	show,
	canApply,
	baseSelectClassName,
	density = "default",
	textColorDraft,
	setTextColorDraft,
	setExpanded,
	focusedFieldRef,
	scheduleApply,
}: TextColorFieldProps) {
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
	const swatchInputClassName = cn(
		"h-9 w-9 rounded-md border border-neutral-200 bg-white p-1",
		isCompact && "h-8 w-8",
	)
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
				onClick={() => setExpanded((prev) => ({ ...prev, textColor: true }))}
				disabled={!canApply}
			>
				<Plus className={cn("mr-2 h-4 w-4", isCompact && "h-3.5 w-3.5")} />
				Add text color
			</Button>
		)
	}

	return (
		<div className={stackClassName}>
			<div className="flex items-center justify-between gap-2">
				<Label className={labelClassName}>Text color</Label>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className={iconButtonClassName}
					onClick={() => {
						setExpanded((prev) => ({ ...prev, textColor: false }))
						scheduleApply({ textColor: null }, "Remove text color", { immediate: true })
					}}
					disabled={!canApply}
					aria-label="Remove text color"
					title="Remove"
				>
					<Trash2 className={iconClassName} />
				</Button>
			</div>
			<Tabs
				value={textColorDraft.mode}
				onValueChange={(next) =>
					setTextColorDraft((prev) => ({
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
						value={textColorDraft.token}
						onValueChange={(next) => {
							setTextColorDraft((prev) => ({ ...prev, token: next, mode: "token" }))
							scheduleApply({ textColor: next || null }, "Update typography")
						}}
						disabled={!canApply}
						buttonClassName={baseSelectClassName}
						title="Text color"
						description="Select a Tailwind v4 text token like emerald-500."
						onOpenChange={(nextOpen) => {
							if (nextOpen) {
								focusedFieldRef.current = "textColor-token"
								return
							}
							if (focusedFieldRef.current === "textColor-token") {
								focusedFieldRef.current = null
							}
						}}
					/>
				</TabsContent>
				<TabsContent value="custom">
					<div className="flex items-center gap-2">
						<input
							type="color"
							value={normalizeHexColor(textColorDraft.hex) ?? "#000000"}
							onChange={(event) => {
								const next = event.target.value
								setTextColorDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
								const normalized = normalizeHexColor(next)
								if (normalized) {
									scheduleApply({ textColor: normalized }, "Update typography")
								}
							}}
							onFocus={() => {
								focusedFieldRef.current = "textColor-hex"
							}}
							onBlur={() => {
								if (focusedFieldRef.current === "textColor-hex") {
									focusedFieldRef.current = null
								}
							}}
							className={swatchInputClassName}
							disabled={!canApply}
							aria-label="Pick text color"
						/>
						<Input
							value={textColorDraft.hex}
							onChange={(event) => {
								const next = event.target.value
								setTextColorDraft((prev) => ({ ...prev, hex: next, mode: "custom" }))
								if (!next.trim()) {
									scheduleApply({ textColor: null }, "Remove text color", { immediate: true })
									return
								}
								const normalized = normalizeHexColor(next)
								if (normalized) {
									scheduleApply({ textColor: normalized }, "Update typography")
								}
							}}
							onFocus={() => {
								focusedFieldRef.current = "textColor-hex-input"
							}}
							onBlur={() => {
								if (focusedFieldRef.current === "textColor-hex-input") {
									focusedFieldRef.current = null
								}
								if (!textColorDraft.hex.trim()) {
									setExpanded((prev) => ({ ...prev, textColor: false }))
								}
							}}
							placeholder="#111111"
							disabled={!canApply}
							className={inputClassName}
							aria-invalid={
								textColorDraft.hex.trim().length > 0 &&
								normalizeHexColor(textColorDraft.hex) === null
									? true
									: undefined
							}
						/>
					</div>
				</TabsContent>
			</Tabs>
		</div>
	)
}
