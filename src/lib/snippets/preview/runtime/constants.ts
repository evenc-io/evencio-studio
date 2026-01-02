import type { PreviewDimensions } from "./types"

export const UNITLESS_CSS_PROPERTIES = new Set([
	"opacity",
	"zIndex",
	"fontWeight",
	"lineHeight",
	"flex",
	"flexGrow",
	"flexShrink",
	"order",
])

/**
 * Minimal CSS reset and container styles for the preview iframe.
 */
export const PREVIEW_STYLES = `
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  overflow: hidden;
}

#root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

#snippet-container {
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.error-display {
  padding: 16px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 4px;
  color: #dc2626;
  font-size: 14px;
  max-width: 100%;
  overflow: auto;
}

.error-display pre {
  margin-top: 8px;
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  color: #7f1d1d;
}
`

/**
 * Default dimensions matching the snippet render determinism config.
 */
export const DEFAULT_PREVIEW_DIMENSIONS: PreviewDimensions = {
	width: 1200,
	height: 630,
}
