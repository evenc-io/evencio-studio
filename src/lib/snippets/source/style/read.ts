import { parseSnippetTsxSource } from "../parse-tsx"
import {
	findJsxElementAt,
	getAttributeName,
	getObjectPropertyKey,
	hasValidRange,
	readOpeningElementName,
	readStaticClassNameValue,
} from "./ast"
import { normalizeColorValue } from "./colors"
import {
	isBackgroundClass,
	isBorderColorClass,
	isBorderWidthClass,
	isFontFamilyClass,
	isFontSizeClass,
	isFontStyleClass,
	isFontWeightClass,
	isLetterSpacingClass,
	isLineHeightClass,
	isPaddingClass,
	isRadiusClass,
	isTextAlignClass,
	isTextColorClass,
	isTextDecorationClass,
	isTextTransformClass,
} from "./predicates"
import {
	readBorderWidthValue,
	readColorSuffix,
	readFontFamilyValue,
	readFontSizeValue,
	readFontWeightValue,
	readLetterSpacingValue,
	readLineHeightValue,
	readPaddingValue,
	readRadiusValue,
	readTextAlignValue,
} from "./read-values"
import { getUtility } from "./tokens"

export type SnippetStyleReadRequest = {
	source: string
	line: number
	column: number
}

export type SnippetStyleReadResponse = {
	found: boolean
	reason?: string
	elementName?: string | null
	classNameKind: "none" | "static" | "dynamic"
	editable: boolean
	properties: {
		backgroundColor: { present: boolean; value: string | null }
		borderWidth: { present: boolean; value: number | null }
		borderColor: { present: boolean; value: string | null }
		borderRadius: { present: boolean; value: number | string | null }
		textColor: { present: boolean; value: string | null }
		fontFamily: { present: boolean; value: string | null }
		fontSize: { present: boolean; value: number | string | null }
		fontWeight: { present: boolean; value: number | string | null }
		lineHeight: { present: boolean; value: number | string | null }
		letterSpacing: { present: boolean; value: string | null }
		textAlign: { present: boolean; value: string | null }
		textTransform: { present: boolean; value: string | null }
		fontStyle: { present: boolean; value: string | null }
		textDecoration: { present: boolean; value: string | null }
		padding: { present: boolean; value: string | null }
		paddingX: { present: boolean; value: string | null }
		paddingY: { present: boolean; value: string | null }
		paddingTop: { present: boolean; value: string | null }
		paddingRight: { present: boolean; value: string | null }
		paddingBottom: { present: boolean; value: string | null }
		paddingLeft: { present: boolean; value: string | null }
	}
}

const readInlineStyleObject = (
	styleValue: Record<string, unknown> | null | undefined,
): Partial<Record<string, string | number | null>> => {
	if (!styleValue || styleValue.type !== "JSXExpressionContainer") return {}
	const expression = styleValue.expression as Record<string, unknown> | null | undefined
	if (!expression || expression.type !== "ObjectExpression") return {}
	const properties = Array.isArray(expression.properties) ? expression.properties : []
	const out: Record<string, string | number | null> = {}
	for (const entry of properties) {
		if (!entry || typeof entry !== "object") continue
		const prop = entry as Record<string, unknown>
		if (prop.type !== "ObjectProperty") continue
		const key = getObjectPropertyKey(prop)
		if (!key) continue
		const value = prop.value as Record<string, unknown> | null | undefined
		if (!value) continue
		if (value.type === "StringLiteral") {
			out[key] = typeof value.value === "string" ? value.value : null
			continue
		}
		if (value.type === "NumericLiteral") {
			out[key] = typeof value.value === "number" ? value.value : null
		}
	}
	return out
}

const readInlinePx = (raw: string | number | null | undefined): number | null => {
	if (typeof raw === "number" && Number.isFinite(raw)) return raw
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	const numeric = trimmed.match(/^(\d+(?:\.\d+)?)$/)
	if (numeric) return Number(numeric[1])
	const px = trimmed.match(/^(\d+(?:\.\d+)?)px$/)
	if (px) return Number(px[1])
	return null
}

const readInlineFontWeight = (raw: string | number | null | undefined): number | null => {
	if (typeof raw === "number" && Number.isFinite(raw)) return raw
	if (typeof raw !== "string") return null
	const trimmed = raw.trim()
	if (!trimmed) return null
	const numeric = trimmed.match(/^(\d+(?:\.\d+)?)$/)
	if (numeric) return Number(numeric[1])
	return null
}

export const readSnippetStyleState = async ({
	source,
	line,
	column,
}: SnippetStyleReadRequest): Promise<SnippetStyleReadResponse> => {
	if (!source.trim()) {
		return {
			found: false,
			reason: "Source is empty.",
			elementName: null,
			classNameKind: "none",
			editable: false,
			properties: {
				backgroundColor: { present: false, value: null },
				borderWidth: { present: false, value: null },
				borderColor: { present: false, value: null },
				borderRadius: { present: false, value: null },
				textColor: { present: false, value: null },
				fontFamily: { present: false, value: null },
				fontSize: { present: false, value: null },
				fontWeight: { present: false, value: null },
				lineHeight: { present: false, value: null },
				letterSpacing: { present: false, value: null },
				textAlign: { present: false, value: null },
				textTransform: { present: false, value: null },
				fontStyle: { present: false, value: null },
				textDecoration: { present: false, value: null },
				padding: { present: false, value: null },
				paddingX: { present: false, value: null },
				paddingY: { present: false, value: null },
				paddingTop: { present: false, value: null },
				paddingRight: { present: false, value: null },
				paddingBottom: { present: false, value: null },
				paddingLeft: { present: false, value: null },
			},
		}
	}

	const ast = await parseSnippetTsxSource(source)
	const targetLine = Math.max(1, Math.floor(line))
	const targetColumn = Math.max(0, Math.floor(column) - 1)
	const target = findJsxElementAt(ast, targetLine, targetColumn)
	if (!target) {
		return {
			found: false,
			reason: "Unable to locate JSX element.",
			elementName: null,
			classNameKind: "none",
			editable: false,
			properties: {
				backgroundColor: { present: false, value: null },
				borderWidth: { present: false, value: null },
				borderColor: { present: false, value: null },
				borderRadius: { present: false, value: null },
				textColor: { present: false, value: null },
				fontFamily: { present: false, value: null },
				fontSize: { present: false, value: null },
				fontWeight: { present: false, value: null },
				lineHeight: { present: false, value: null },
				letterSpacing: { present: false, value: null },
				textAlign: { present: false, value: null },
				textTransform: { present: false, value: null },
				fontStyle: { present: false, value: null },
				textDecoration: { present: false, value: null },
				padding: { present: false, value: null },
				paddingX: { present: false, value: null },
				paddingY: { present: false, value: null },
				paddingTop: { present: false, value: null },
				paddingRight: { present: false, value: null },
				paddingBottom: { present: false, value: null },
				paddingLeft: { present: false, value: null },
			},
		}
	}

	const openingElement = target.node.openingElement as Record<string, unknown> | undefined
	if (!openingElement || !hasValidRange(openingElement)) {
		return {
			found: false,
			reason: "Selected element is missing a JSX opening tag.",
			elementName: null,
			classNameKind: "none",
			editable: false,
			properties: {
				backgroundColor: { present: false, value: null },
				borderWidth: { present: false, value: null },
				borderColor: { present: false, value: null },
				borderRadius: { present: false, value: null },
				textColor: { present: false, value: null },
				fontFamily: { present: false, value: null },
				fontSize: { present: false, value: null },
				fontWeight: { present: false, value: null },
				lineHeight: { present: false, value: null },
				letterSpacing: { present: false, value: null },
				textAlign: { present: false, value: null },
				textTransform: { present: false, value: null },
				fontStyle: { present: false, value: null },
				textDecoration: { present: false, value: null },
				padding: { present: false, value: null },
				paddingX: { present: false, value: null },
				paddingY: { present: false, value: null },
				paddingTop: { present: false, value: null },
				paddingRight: { present: false, value: null },
				paddingBottom: { present: false, value: null },
				paddingLeft: { present: false, value: null },
			},
		}
	}

	const elementName = readOpeningElementName(openingElement)
	const attributes = Array.isArray(openingElement.attributes)
		? (openingElement.attributes as Record<string, unknown>[])
		: []

	const classAttribute = attributes.find((attr) => {
		const name = getAttributeName(attr)
		return name === "className" || name === "class"
	})
	const rawClassValue = classAttribute
		? readStaticClassNameValue(classAttribute.value as Record<string, unknown> | null | undefined)
		: ""
	const classNameKind: SnippetStyleReadResponse["classNameKind"] = !classAttribute
		? "none"
		: rawClassValue === null
			? "dynamic"
			: "static"

	const editable = classNameKind !== "dynamic"

	const classTokens =
		classNameKind === "static" && typeof rawClassValue === "string"
			? rawClassValue.split(/\s+/).filter(Boolean)
			: []

	const findLastToken = (predicate: (token: string) => boolean) => {
		for (let index = classTokens.length - 1; index >= 0; index -= 1) {
			const token = classTokens[index]
			if (token && predicate(token)) return token
		}
		return null
	}

	const bgToken = findLastToken(isBackgroundClass)
	const borderWidthToken = findLastToken(isBorderWidthClass)
	const borderColorToken = findLastToken(isBorderColorClass)
	const radiusToken = findLastToken(isRadiusClass)
	const textColorToken = findLastToken(isTextColorClass)
	const fontFamilyToken = findLastToken(isFontFamilyClass)
	const fontSizeToken = findLastToken(isFontSizeClass)
	const fontWeightToken = findLastToken(isFontWeightClass)
	const lineHeightToken = findLastToken(isLineHeightClass)
	const letterSpacingToken = findLastToken(isLetterSpacingClass)
	const textAlignToken = findLastToken(isTextAlignClass)
	const textTransformToken = findLastToken(isTextTransformClass)
	const fontStyleToken = findLastToken(isFontStyleClass)
	const textDecorationToken = findLastToken(isTextDecorationClass)
	const paddingToken = findLastToken(isPaddingClass("p-"))
	const paddingXToken = findLastToken(isPaddingClass("px-"))
	const paddingYToken = findLastToken(isPaddingClass("py-"))
	const paddingTopToken = findLastToken(isPaddingClass("pt-"))
	const paddingRightToken = findLastToken(isPaddingClass("pr-"))
	const paddingBottomToken = findLastToken(isPaddingClass("pb-"))
	const paddingLeftToken = findLastToken(isPaddingClass("pl-"))

	const bgValueFromClass =
		bgToken && getUtility(bgToken).startsWith("bg-")
			? readColorSuffix(getUtility(bgToken).slice("bg-".length))
			: null
	const borderColorFromClass =
		borderColorToken && getUtility(borderColorToken).startsWith("border-")
			? readColorSuffix(getUtility(borderColorToken).slice("border-".length))
			: null
	const textColorFromClass =
		textColorToken && getUtility(textColorToken).startsWith("text-")
			? readColorSuffix(getUtility(textColorToken).slice("text-".length))
			: null

	const borderWidthFromClass = borderWidthToken
		? readBorderWidthValue(getUtility(borderWidthToken))
		: null
	const radiusFromClass = radiusToken ? readRadiusValue(getUtility(radiusToken)) : null
	const fontFamilyFromClass = fontFamilyToken
		? readFontFamilyValue(getUtility(fontFamilyToken))
		: null
	const fontSizeFromClass = fontSizeToken ? readFontSizeValue(getUtility(fontSizeToken)) : null
	const fontWeightFromClass = fontWeightToken
		? readFontWeightValue(getUtility(fontWeightToken))
		: null
	const lineHeightFromClass = lineHeightToken
		? readLineHeightValue(getUtility(lineHeightToken))
		: null
	const letterSpacingFromClass = letterSpacingToken
		? readLetterSpacingValue(getUtility(letterSpacingToken))
		: null
	const textAlignFromClass = textAlignToken ? readTextAlignValue(getUtility(textAlignToken)) : null
	const textTransformFromClass = textTransformToken ? getUtility(textTransformToken) : null
	const fontStyleFromClass = fontStyleToken ? getUtility(fontStyleToken) : null
	const textDecorationFromClass = textDecorationToken ? getUtility(textDecorationToken) : null
	const paddingFromClass = paddingToken ? readPaddingValue(getUtility(paddingToken), "p-") : null
	const paddingXFromClass = paddingXToken
		? readPaddingValue(getUtility(paddingXToken), "px-")
		: null
	const paddingYFromClass = paddingYToken
		? readPaddingValue(getUtility(paddingYToken), "py-")
		: null
	const paddingTopFromClass = paddingTopToken
		? readPaddingValue(getUtility(paddingTopToken), "pt-")
		: null
	const paddingRightFromClass = paddingRightToken
		? readPaddingValue(getUtility(paddingRightToken), "pr-")
		: null
	const paddingBottomFromClass = paddingBottomToken
		? readPaddingValue(getUtility(paddingBottomToken), "pb-")
		: null
	const paddingLeftFromClass = paddingLeftToken
		? readPaddingValue(getUtility(paddingLeftToken), "pl-")
		: null

	const styleAttribute = attributes.find((attr) => getAttributeName(attr) === "style")
	const inlineStyle = readInlineStyleObject(
		styleAttribute?.value as Record<string, unknown> | null | undefined,
	)

	const inlineBackground = normalizeColorValue(String(inlineStyle.backgroundColor ?? ""))
	const inlineBorderColor = normalizeColorValue(String(inlineStyle.borderColor ?? ""))
	const inlineTextColor = normalizeColorValue(String(inlineStyle.color ?? ""))
	const inlineBorderWidth = readInlinePx(inlineStyle.borderWidth ?? null)
	const inlineRadius = readInlinePx(inlineStyle.borderRadius ?? null)
	const inlineFontSize = readInlinePx(inlineStyle.fontSize ?? null)
	const inlineFontWeight = readInlineFontWeight(inlineStyle.fontWeight ?? null)

	const backgroundValue = inlineBackground ?? bgValueFromClass
	const borderColorValue = inlineBorderColor ?? borderColorFromClass
	const textColorValue = inlineTextColor ?? textColorFromClass
	const borderWidthValue = inlineBorderWidth ?? borderWidthFromClass
	const radiusValue = inlineRadius ?? radiusFromClass
	const fontSizeValue = inlineFontSize ?? fontSizeFromClass
	const fontWeightValue = inlineFontWeight ?? fontWeightFromClass
	const fontFamilyValue = fontFamilyFromClass
	const lineHeightValue = lineHeightFromClass
	const letterSpacingValue = letterSpacingFromClass
	const textAlignValue = textAlignFromClass
	const textTransformValue = textTransformFromClass
	const fontStyleValue = fontStyleFromClass
	const textDecorationValue = textDecorationFromClass
	const paddingValue = paddingFromClass
	const paddingXValue = paddingXFromClass
	const paddingYValue = paddingYFromClass
	const paddingTopValue = paddingTopFromClass
	const paddingRightValue = paddingRightFromClass
	const paddingBottomValue = paddingBottomFromClass
	const paddingLeftValue = paddingLeftFromClass

	const backgroundPresent = Boolean(inlineStyle.backgroundColor !== undefined || bgToken)
	const borderColorPresent = Boolean(inlineStyle.borderColor !== undefined || borderColorToken)
	const textColorPresent = Boolean(inlineStyle.color !== undefined || textColorToken)
	const borderWidthPresent = Boolean(inlineStyle.borderWidth !== undefined || borderWidthToken)
	const radiusPresent = Boolean(inlineStyle.borderRadius !== undefined || radiusToken)
	const fontSizePresent = Boolean(inlineStyle.fontSize !== undefined || fontSizeToken)
	const fontWeightPresent = Boolean(inlineStyle.fontWeight !== undefined || fontWeightToken)
	const fontFamilyPresent = Boolean(fontFamilyToken)
	const lineHeightPresent = Boolean(lineHeightToken)
	const letterSpacingPresent = Boolean(letterSpacingToken)
	const textAlignPresent = Boolean(textAlignToken)
	const textTransformPresent = Boolean(textTransformToken)
	const fontStylePresent = Boolean(fontStyleToken)
	const textDecorationPresent = Boolean(textDecorationToken)
	const paddingPresent = Boolean(paddingToken)
	const paddingXPresent = Boolean(paddingXToken)
	const paddingYPresent = Boolean(paddingYToken)
	const paddingTopPresent = Boolean(paddingTopToken)
	const paddingRightPresent = Boolean(paddingRightToken)
	const paddingBottomPresent = Boolean(paddingBottomToken)
	const paddingLeftPresent = Boolean(paddingLeftToken)

	return {
		found: true,
		elementName,
		classNameKind,
		editable,
		reason: editable ? undefined : "This element uses a dynamic className. Edit styles in code.",
		properties: {
			backgroundColor: { present: backgroundPresent, value: backgroundValue ?? null },
			borderWidth: { present: borderWidthPresent, value: borderWidthValue ?? null },
			borderColor: { present: borderColorPresent, value: borderColorValue ?? null },
			borderRadius: { present: radiusPresent, value: radiusValue ?? null },
			textColor: { present: textColorPresent, value: textColorValue ?? null },
			fontFamily: { present: fontFamilyPresent, value: fontFamilyValue ?? null },
			fontSize: { present: fontSizePresent, value: fontSizeValue ?? null },
			fontWeight: { present: fontWeightPresent, value: fontWeightValue ?? null },
			lineHeight: { present: lineHeightPresent, value: lineHeightValue ?? null },
			letterSpacing: { present: letterSpacingPresent, value: letterSpacingValue ?? null },
			textAlign: { present: textAlignPresent, value: textAlignValue ?? null },
			textTransform: { present: textTransformPresent, value: textTransformValue ?? null },
			fontStyle: { present: fontStylePresent, value: fontStyleValue ?? null },
			textDecoration: { present: textDecorationPresent, value: textDecorationValue ?? null },
			padding: { present: paddingPresent, value: paddingValue ?? null },
			paddingX: { present: paddingXPresent, value: paddingXValue ?? null },
			paddingY: { present: paddingYPresent, value: paddingYValue ?? null },
			paddingTop: { present: paddingTopPresent, value: paddingTopValue ?? null },
			paddingRight: { present: paddingRightPresent, value: paddingRightValue ?? null },
			paddingBottom: { present: paddingBottomPresent, value: paddingBottomValue ?? null },
			paddingLeft: { present: paddingLeftPresent, value: paddingLeftValue ?? null },
		},
	}
}
