import colors from "tailwindcss/colors"

export const TAILWIND_COLOR_SHADES = [
	"50",
	"100",
	"200",
	"300",
	"400",
	"500",
	"600",
	"700",
	"800",
	"900",
	"950",
] as const

export const TAILWIND_COLOR_FAMILIES = [
	"slate",
	"gray",
	"zinc",
	"neutral",
	"stone",
	"red",
	"orange",
	"amber",
	"yellow",
	"lime",
	"green",
	"emerald",
	"teal",
	"cyan",
	"sky",
	"blue",
	"indigo",
	"violet",
	"purple",
	"fuchsia",
	"pink",
	"rose",
] as const

export type TailwindColorFamily = (typeof TAILWIND_COLOR_FAMILIES)[number]
export type TailwindColorShade = (typeof TAILWIND_COLOR_SHADES)[number]

export const TAILWIND_SPECIAL_COLOR_TOKENS = ["transparent", "current", "black", "white"] as const
export type TailwindSpecialColorToken = (typeof TAILWIND_SPECIAL_COLOR_TOKENS)[number]

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value && typeof value === "object" && !Array.isArray(value))

export const parseTailwindPaletteToken = (
	token: string,
): { family: TailwindColorFamily; shade: TailwindColorShade; opacity: number | null } | null => {
	const trimmed = token.trim()
	const match = trimmed.match(
		/^([a-z]+)-(50|100|200|300|400|500|600|700|800|900|950)(?:\/(\d{1,3}))?$/,
	)
	if (!match) return null
	const family = match[1] as TailwindColorFamily
	const shade = match[2] as TailwindColorShade
	if (!TAILWIND_COLOR_FAMILIES.includes(family)) return null
	if (!TAILWIND_COLOR_SHADES.includes(shade)) return null
	const opacityRaw = match[3]
	const opacity = opacityRaw ? Number(opacityRaw) : null
	const normalizedOpacity =
		typeof opacity === "number" && Number.isFinite(opacity)
			? Math.max(0, Math.min(1, opacity / 100))
			: null
	return { family, shade, opacity: normalizedOpacity }
}

export const getTailwindPaletteColorValue = (
	family: TailwindColorFamily,
	shade: TailwindColorShade,
): string | null => {
	const familyValue = (colors as unknown as Record<string, unknown>)[family]
	if (!isRecord(familyValue)) return null
	const value = familyValue[shade]
	return typeof value === "string" ? value : null
}

export const getTailwindSpecialColorValue = (token: TailwindSpecialColorToken): string | null => {
	const value = (colors as unknown as Record<string, unknown>)[token]
	return typeof value === "string" ? value : null
}

export const getTailwindTokenSwatch = (
	token: string | null | undefined,
): { color: string | null; opacity: number; kind: "palette" | "special" | "unknown" } => {
	if (!token) {
		return { color: null, opacity: 1, kind: "unknown" }
	}

	const trimmed = token.trim()
	if (!trimmed) {
		return { color: null, opacity: 1, kind: "unknown" }
	}

	if (TAILWIND_SPECIAL_COLOR_TOKENS.includes(trimmed as TailwindSpecialColorToken)) {
		return {
			color: getTailwindSpecialColorValue(trimmed as TailwindSpecialColorToken),
			opacity: 1,
			kind: "special",
		}
	}

	const parsed = parseTailwindPaletteToken(trimmed)
	if (!parsed) {
		return { color: null, opacity: 1, kind: "unknown" }
	}

	return {
		color: getTailwindPaletteColorValue(parsed.family, parsed.shade),
		opacity: parsed.opacity ?? 1,
		kind: "palette",
	}
}
