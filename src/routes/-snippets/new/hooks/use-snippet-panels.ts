import { useEffect, useRef, useState } from "react"
import { useIsomorphicLayoutEffect } from "@/routes/-snippets/new/editor"
import type { PanelSnapshot } from "@/routes/-snippets/new/panel-state"
import { readPanelState, writePanelState } from "@/routes/-snippets/new/panel-state"

export function useSnippetPanels() {
	const [detailsCollapsed, setDetailsCollapsed] = useState(false)
	const [explorerCollapsed, setExplorerCollapsed] = useState(false)
	const [examplesOpen, setExamplesOpen] = useState(false)
	const [importsOpen, setImportsOpen] = useState(false)
	const [historyOpen, setHistoryOpen] = useState(false)
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [panelsHydrated, setPanelsHydrated] = useState(false)
	const previousPanelsRef = useRef<PanelSnapshot | null>(null)
	const isFocusPanelOpen = examplesOpen || importsOpen

	useIsomorphicLayoutEffect(() => {
		const stored = readPanelState()
		if (stored) {
			setDetailsCollapsed(stored.detailsCollapsed)
			setExplorerCollapsed(stored.explorerCollapsed)
			setExamplesOpen(stored.examplesOpen)
			setImportsOpen(stored.importsOpen)
			setHistoryOpen(stored.historyOpen)
			setSettingsOpen(stored.settingsOpen)
		}
		setPanelsHydrated(true)
	}, [])

	useEffect(() => {
		if (!panelsHydrated) return
		writePanelState({
			detailsCollapsed,
			explorerCollapsed,
			examplesOpen,
			importsOpen,
			historyOpen,
			settingsOpen,
		})
	}, [
		detailsCollapsed,
		explorerCollapsed,
		examplesOpen,
		importsOpen,
		historyOpen,
		settingsOpen,
		panelsHydrated,
	])

	const openFocusPanel = (panel: "examples" | "imports") => {
		if (!isFocusPanelOpen) {
			previousPanelsRef.current = {
				detailsCollapsed,
				explorerCollapsed,
			}
		}
		setDetailsCollapsed(true)
		setExplorerCollapsed(true)
		if (panel === "examples") {
			setExamplesOpen(true)
			setImportsOpen(false)
		} else {
			setImportsOpen(true)
			setExamplesOpen(false)
		}
	}

	const closeFocusPanels = () => {
		setExamplesOpen(false)
		setImportsOpen(false)
		const previous = previousPanelsRef.current
		if (previous) {
			setDetailsCollapsed(previous.detailsCollapsed)
			setExplorerCollapsed(previous.explorerCollapsed)
		}
	}

	const toggleExamplesPanel = () => {
		if (examplesOpen) {
			closeFocusPanels()
		} else {
			openFocusPanel("examples")
		}
	}

	const toggleImportsPanel = () => {
		if (importsOpen) {
			closeFocusPanels()
		} else {
			openFocusPanel("imports")
		}
	}

	const toggleHistoryPanel = () => {
		setHistoryOpen((prev) => !prev)
	}

	const toggleSettingsPanel = () => {
		setSettingsOpen((prev) => !prev)
	}

	return {
		detailsCollapsed,
		setDetailsCollapsed,
		explorerCollapsed,
		setExplorerCollapsed,
		examplesOpen,
		setExamplesOpen,
		importsOpen,
		setImportsOpen,
		historyOpen,
		setHistoryOpen,
		settingsOpen,
		setSettingsOpen,
		isFocusPanelOpen,
		toggleExamplesPanel,
		toggleImportsPanel,
		toggleHistoryPanel,
		toggleSettingsPanel,
	}
}
