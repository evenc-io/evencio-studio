export type SelectOption = { value: string; label: string }

export const BORDER_WIDTH_SCALE: Array<{ value: number; label: string }> = [
	{ value: 1, label: "1px (border)" },
	{ value: 2, label: "2px (border-2)" },
	{ value: 4, label: "4px (border-4)" },
	{ value: 8, label: "8px (border-8)" },
]

export const RADIUS_SCALE: SelectOption[] = [
	{ value: "none", label: "none (rounded-none)" },
	{ value: "sm", label: "sm (rounded-sm)" },
	{ value: "DEFAULT", label: "base (rounded)" },
	{ value: "md", label: "md (rounded-md)" },
	{ value: "lg", label: "lg (rounded-lg)" },
	{ value: "xl", label: "xl (rounded-xl)" },
	{ value: "2xl", label: "2xl (rounded-2xl)" },
	{ value: "3xl", label: "3xl (rounded-3xl)" },
	{ value: "full", label: "full (rounded-full)" },
]

export const FONT_SIZE_SCALE: SelectOption[] = [
	{ value: "xs", label: "xs (text-xs)" },
	{ value: "sm", label: "sm (text-sm)" },
	{ value: "base", label: "base (text-base)" },
	{ value: "lg", label: "lg (text-lg)" },
	{ value: "xl", label: "xl (text-xl)" },
	{ value: "2xl", label: "2xl (text-2xl)" },
	{ value: "3xl", label: "3xl (text-3xl)" },
	{ value: "4xl", label: "4xl (text-4xl)" },
	{ value: "5xl", label: "5xl (text-5xl)" },
	{ value: "6xl", label: "6xl (text-6xl)" },
	{ value: "7xl", label: "7xl (text-7xl)" },
	{ value: "8xl", label: "8xl (text-8xl)" },
	{ value: "9xl", label: "9xl (text-9xl)" },
]

export const FONT_WEIGHT_SCALE: SelectOption[] = [
	{ value: "thin", label: "100 (thin)" },
	{ value: "extralight", label: "200 (extra light)" },
	{ value: "light", label: "300 (light)" },
	{ value: "normal", label: "400 (normal)" },
	{ value: "medium", label: "500 (medium)" },
	{ value: "semibold", label: "600 (semibold)" },
	{ value: "bold", label: "700 (bold)" },
	{ value: "extrabold", label: "800 (extra bold)" },
	{ value: "black", label: "900 (black)" },
]
