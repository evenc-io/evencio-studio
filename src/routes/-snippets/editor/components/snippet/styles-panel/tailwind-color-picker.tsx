import { ChevronDown, Search } from "lucide-react"
import type { CSSProperties } from "react"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
	getTailwindPaletteColorValue,
	getTailwindSpecialColorValue,
	getTailwindTokenSwatch,
	parseTailwindPaletteToken,
	TAILWIND_COLOR_FAMILIES,
	TAILWIND_COLOR_SHADES,
	TAILWIND_SPECIAL_COLOR_TOKENS,
	type TailwindColorFamily,
	type TailwindColorShade,
	type TailwindSpecialColorToken,
} from "./tailwind-colors"

type TailwindColorPickerProps = {
	value: string
	onValueChange: (next: string) => void
	disabled?: boolean
	buttonClassName?: string
	placeholder?: string
	title?: string
	description?: string
	onOpenChange?: (open: boolean) => void
}

const CHECKERBOARD_BACKGROUND = `linear-gradient(45deg, rgb(212 212 212) 25%, transparent 25%, transparent 75%, rgb(212 212 212) 75%, rgb(212 212 212)),
linear-gradient(45deg, rgb(212 212 212) 25%, transparent 25%, transparent 75%, rgb(212 212 212) 75%, rgb(212 212 212))`
const CHECKERBOARD_BACKGROUND_STYLE: CSSProperties = {
	backgroundImage: CHECKERBOARD_BACKGROUND,
	backgroundPosition: "0 0, 4px 4px",
	backgroundSize: "8px 8px",
}

const formatFamilyLabel = (family: string) => family.charAt(0).toUpperCase() + family.slice(1)

const getSelectedBaseToken = (token: string) => {
	const trimmed = token.trim()
	if (!trimmed) return ""
	const slashIndex = trimmed.indexOf("/")
	return slashIndex >= 0 ? trimmed.slice(0, slashIndex) : trimmed
}

export function TailwindColorPicker({
	value,
	onValueChange,
	disabled = false,
	buttonClassName,
	placeholder = "Select…",
	title = "Tailwind color",
	description = "Pick a Tailwind v4 palette token like emerald-500.",
	onOpenChange,
}: TailwindColorPickerProps) {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState("")

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			setOpen(nextOpen)
			onOpenChange?.(nextOpen)
			if (!nextOpen) setQuery("")
		},
		[onOpenChange],
	)

	const selectedBase = useMemo(() => getSelectedBaseToken(value), [value])
	const selectedSwatch = useMemo(() => getTailwindTokenSwatch(value), [value])

	const filteredFamilies = useMemo(() => {
		const trimmed = query.trim().toLowerCase()
		if (!trimmed) return TAILWIND_COLOR_FAMILIES
		if (/^\d+$/.test(trimmed)) return TAILWIND_COLOR_FAMILIES
		return TAILWIND_COLOR_FAMILIES.filter((family) => family.includes(trimmed))
	}, [query])

	const gridTemplateColumns = useMemo(
		() => `2.5rem repeat(${filteredFamilies.length}, minmax(1.5rem, 1fr))`,
		[filteredFamilies.length],
	)

	const selectToken = useCallback(
		(next: string) => {
			onValueChange(next)
			handleOpenChange(false)
		},
		[handleOpenChange, onValueChange],
	)

	const clearToken = useCallback(() => selectToken(""), [selectToken])

	const renderSwatch = (
		token: string,
		options?: {
			label?: string
			color?: string | null
			opacity?: number
			className?: string
		},
	) => {
		const isSelected = token === value || token === selectedBase
		const swatchOpacity = options?.opacity ?? 1
		const swatchColor = options?.color ?? null

		const style: CSSProperties = swatchColor
			? { backgroundColor: swatchColor, opacity: swatchOpacity }
			: token === "transparent"
				? {
						...CHECKERBOARD_BACKGROUND_STYLE,
						opacity: swatchOpacity,
					}
				: { opacity: swatchOpacity }

		return (
			<button
				type="button"
				key={token}
				onClick={() => selectToken(token)}
				disabled={disabled}
				className={cn(
					"relative rounded-md border border-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
					options?.className ?? "h-6 w-6",
					disabled ? "cursor-not-allowed opacity-50" : "hover:border-neutral-400",
					isSelected ? "border-neutral-900" : null,
				)}
				style={style}
				aria-label={options?.label ?? token}
				title={options?.label ?? token}
			>
				{!swatchColor && token !== "transparent" ? (
					<span className="absolute inset-0 flex items-center justify-center text-[8px] font-semibold text-neutral-600">
						{(options?.label ?? token).slice(0, 1).toUpperCase()}
					</span>
				) : null}
			</button>
		)
	}

	const tokenButtonLabel = value.trim() ? value.trim() : placeholder
	const tokenButtonSwatch = selectedSwatch.color
		? {
				backgroundColor: selectedSwatch.color,
				opacity: selectedSwatch.opacity,
			}
		: value.trim() === "transparent"
			? {
					...CHECKERBOARD_BACKGROUND_STYLE,
					opacity: 1,
				}
			: null

	const derivedInfo = useMemo(() => {
		const parsed = parseTailwindPaletteToken(value)
		if (!parsed) return null
		if (parsed.opacity === null) return null
		return { opacityLabel: `${Math.round(parsed.opacity * 100)}% opacity` }
	}, [value])

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<button
				type="button"
				onClick={() => handleOpenChange(true)}
				disabled={disabled}
				aria-haspopup="dialog"
				className={cn(
					buttonClassName,
					"flex items-center justify-between gap-2 text-left",
					disabled ? "cursor-not-allowed opacity-50" : "hover:border-neutral-400",
				)}
			>
				<span className="flex min-w-0 items-center gap-2">
					<span
						className={cn(
							"inline-flex h-4 w-4 shrink-0 rounded border border-neutral-200",
							tokenButtonSwatch ? null : "bg-neutral-100",
						)}
						style={tokenButtonSwatch ?? undefined}
					/>
					<span className="truncate">{tokenButtonLabel}</span>
				</span>
				<ChevronDown className="h-4 w-4 text-neutral-500" />
			</button>

			<DialogContent className="sm:max-w-4xl p-4 shadow-none">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
							<Input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search color families…"
								className="pl-8"
								disabled={disabled}
							/>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="shadow-none"
							onClick={clearToken}
							disabled={disabled || !value.trim()}
						>
							Clear
						</Button>
					</div>

					{value.trim() && derivedInfo ? (
						<p className="text-xs text-neutral-500">{derivedInfo.opacityLabel}</p>
					) : null}

					<div className="rounded-md border border-neutral-200 bg-white">
						<div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2">
							<p className="text-xs font-medium text-neutral-700">Special</p>
						</div>
						<div className="flex flex-wrap items-center gap-2 px-3 py-3">
							{TAILWIND_SPECIAL_COLOR_TOKENS.map((token) => {
								const cssValue = getTailwindSpecialColorValue(token as TailwindSpecialColorToken)
								return renderSwatch(token, { label: token, color: cssValue, className: "h-7 w-7" })
							})}
						</div>
					</div>

					<div className="rounded-md border border-neutral-200 bg-white">
						<div className="border-b border-neutral-200 bg-neutral-50 px-3 py-2">
							<p className="text-xs font-medium text-neutral-700">Palette</p>
						</div>
						<div className="px-3 py-3">
							{filteredFamilies.length === 0 ? (
								<div className="py-6 text-sm text-neutral-500">No color families match.</div>
							) : (
								<div className="space-y-1">
									<div
										className="grid items-end gap-1 justify-items-center"
										style={{ gridTemplateColumns }}
									>
										<div className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
											&nbsp;
										</div>
										{filteredFamilies.map((family) => (
											<div
												key={family}
												className="flex justify-center"
												title={formatFamilyLabel(family)}
											>
												<span
													className="text-[10px] font-semibold leading-none text-neutral-400"
													style={{
														writingMode: "vertical-rl",
														transform: "rotate(180deg)",
													}}
												>
													{formatFamilyLabel(family)}
												</span>
											</div>
										))}
									</div>

									{TAILWIND_COLOR_SHADES.map((shade) => (
										<div
											key={shade}
											className="grid items-center gap-1 justify-items-center"
											style={{ gridTemplateColumns }}
										>
											<div className="pr-1 text-right text-[10px] font-semibold text-neutral-400">
												{shade}
											</div>
											{filteredFamilies.map((family) => {
												const cssValue = getTailwindPaletteColorValue(
													family as TailwindColorFamily,
													shade as TailwindColorShade,
												)
												const token = `${family}-${shade}`
												return renderSwatch(token, {
													label: token,
													color: cssValue,
													className: "w-full max-w-8 aspect-square",
												})
											})}
										</div>
									))}
								</div>
							)}
						</div>
					</div>

					{value.trim() && selectedSwatch.kind === "unknown" ? (
						<div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2">
							<p className="text-xs text-neutral-600">
								Current value <span className="font-mono">{value.trim()}</span> isn’t in the
								Tailwind palette picker. You can keep it, clear it, or choose a new color.
							</p>
						</div>
					) : null}
				</div>
			</DialogContent>
		</Dialog>
	)
}
