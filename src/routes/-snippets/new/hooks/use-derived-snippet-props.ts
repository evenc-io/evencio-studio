import { useEffect, useRef, useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import type { AnalyzeTsxResponse } from "@/lib/engine/protocol"
import { DEFAULT_DEFAULT_PROPS, DEFAULT_PROPS_SCHEMA } from "@/routes/-snippets/new/constants"
import type { CustomSnippetValues } from "@/routes/-snippets/new/schema"
import type { SnippetProps, SnippetPropsSchemaDefinition } from "@/types/asset-library"

interface DerivedSnippetProps {
	propsSchema: SnippetPropsSchemaDefinition
	defaultProps: SnippetProps
	duplicateKeys: string[]
}

interface UseDerivedSnippetPropsOptions {
	analysis: AnalyzeTsxResponse | null
	form: UseFormReturn<CustomSnippetValues>
}

export function useDerivedSnippetProps({ analysis, form }: UseDerivedSnippetPropsOptions) {
	const [derivedProps, setDerivedProps] = useState<DerivedSnippetProps>(() => ({
		propsSchema: DEFAULT_PROPS_SCHEMA,
		defaultProps: DEFAULT_DEFAULT_PROPS,
		duplicateKeys: [],
	}))
	const derivedPropsRef = useRef(derivedProps)

	useEffect(() => {
		if (!analysis) return
		const propsSchemaJson = analysis.propsSchemaJson
		const defaultPropsJson = analysis.defaultPropsJson
		const nextDerived: DerivedSnippetProps = {
			propsSchema: analysis.propsSchema,
			defaultProps: analysis.defaultProps,
			duplicateKeys: analysis.duplicateKeys,
		}
		const currentDerived = derivedPropsRef.current
		const shouldUpdateDerived =
			currentDerived.propsSchema !== nextDerived.propsSchema ||
			currentDerived.defaultProps !== nextDerived.defaultProps ||
			currentDerived.duplicateKeys.join("|") !== nextDerived.duplicateKeys.join("|")

		if (shouldUpdateDerived) {
			derivedPropsRef.current = nextDerived
			setDerivedProps(nextDerived)
		}

		if (form.getValues("propsSchema") !== propsSchemaJson) {
			form.setValue("propsSchema", propsSchemaJson, {
				shouldValidate: true,
				shouldDirty: false,
			})
		}
		if (form.getValues("defaultProps") !== defaultPropsJson) {
			form.setValue("defaultProps", defaultPropsJson, {
				shouldValidate: true,
				shouldDirty: false,
			})
		}
	}, [analysis, form])

	return derivedProps
}
