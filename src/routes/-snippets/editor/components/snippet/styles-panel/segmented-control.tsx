import { cn } from "@/lib/utils"

type SegmentedControlOption<TValue extends string> = {
	value: TValue
	label: string
}

type SegmentedControlProps<TValue extends string> = {
	"aria-label": string
	value: TValue
	onValueChange: (value: TValue) => void
	options: Array<SegmentedControlOption<TValue>>
	disabled?: boolean
	className?: string
	size?: "default" | "compact"
}

export function SegmentedControl<TValue extends string>({
	"aria-label": ariaLabel,
	value,
	onValueChange,
	options,
	disabled = false,
	className,
	size = "default",
}: SegmentedControlProps<TValue>) {
	const isCompact = size === "compact"

	return (
		<fieldset
			aria-label={ariaLabel}
			className={cn(
				"inline-flex items-stretch rounded-md border border-neutral-200 bg-neutral-50 p-0.5",
				disabled && "opacity-60",
				className,
			)}
		>
			<legend className="sr-only">{ariaLabel}</legend>
			{options.map((option) => {
				const isActive = option.value === value
				return (
					<button
						key={option.value}
						type="button"
						aria-pressed={isActive}
						onClick={() => onValueChange(option.value)}
						disabled={disabled}
						className={cn(
							"rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
							isCompact && "px-2 py-0.5 text-[10px]",
							isActive ? "bg-white text-neutral-900" : "text-neutral-500 hover:text-neutral-900",
							"disabled:pointer-events-none",
						)}
					>
						{option.label}
					</button>
				)
			})}
		</fieldset>
	)
}
