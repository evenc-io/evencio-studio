import { LAYOUT_SNAPPING_SOURCE } from "./demos/layout-snapping"
import { serializeSnippetFiles } from "./source/files"
import { STARTER_SNIPPET_SOURCE } from "./starter-snippet"

export type SnippetTemplateId = "single" | "multi" | "layout-policy"

export type SnippetTemplate = {
	id: SnippetTemplateId
	label: string
	description: string
	source: string
}

const MULTI_COMPONENT_FILES: Record<string, string> = {
	"__imports.assets.tsx": `type EvencioAssetProps = {
  className?: string
  style?: any
}

const mergeClassName = (base: string, extra?: string) =>
  extra ? base + " " + extra : base

const EvencioMark = ({ className, style }: EvencioAssetProps) => (
  <svg
    data-snippet-inspect="ignore"
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    width={80}
    height={80}
    aria-hidden="true"
    className={mergeClassName("shrink-0 self-center", className)}
    style={style}
  >
    <path d="M15 10H85V35H40V65H85V90H15V10Z" className="fill-neutral-950" />
    <rect x="65" y="40" width="20" height="20" fill="#0044FF" />
  </svg>
)

const EvencioLockup = ({ className, style }: EvencioAssetProps) => (
  <span
    data-snippet-inspect="ignore"
    className={mergeClassName("inline-flex items-center gap-2 leading-none", className)}
    style={style}
  >
    <EvencioMark style={{ width: 32, height: 32 }} />
    <span className="font-unbounded text-[24px] font-normal tracking-[-0.02em] uppercase leading-none whitespace-nowrap text-neutral-950">
      EVENCIO
    </span>
  </span>
)
`,
	"EventBadge.tsx": `export const EventBadge = ({ badgeLabel = "On sale" }) => (
  <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-500">
    {badgeLabel}
  </span>
)
`,
	"EventDetail.tsx": `export const EventDetail = ({
  detailLabel,
  detailValue,
}: {
  detailLabel: string
  detailValue: string
}) => (
  <div>
    <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-400">{detailLabel}</p>
    <p className="mt-2 text-sm font-medium text-neutral-900">{detailValue}</p>
  </div>
)
`,
}

const MULTI_COMPONENT_MAIN_SOURCE = `// @import __imports.assets.tsx
// @import EventBadge.tsx
// @import EventDetail.tsx

export default function EvencioMultiComponentSnippet({
  eyebrow = "Event Spotlight",
  title = "Cityline Sessions",
  subtitle = "Multiple components stitched into one layout with SVG asset components.",
  date = "Saturday, Mar 16",
  time = "20:00 - 01:30",
  venue = "Tobacco Dock",
  city = "London",
  ctaLabel = "Reserve seat",
}) {
  return (
    <div className="h-full w-full bg-white text-neutral-900">
      <div className="grid h-full w-full grid-cols-[minmax(0,1fr)_320px] border border-neutral-200">
        <div className="flex h-full flex-col px-12 py-10">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.32em] text-neutral-400">
            <span className="font-mono">{eyebrow}</span>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-neutral-500">
              <EvencioMark style={{ width: 14, height: 14 }} />
              <span>Assets file</span>
            </div>
          </div>

          <div className="mt-8">
            <h1 className="font-lexend text-[44px] leading-[1.05] tracking-[-0.02em] text-neutral-900">
              {title}
            </h1>
            <p className="mt-4 max-w-[28rem] text-base leading-relaxed text-neutral-600">
              {subtitle}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 border border-neutral-200 bg-neutral-50 p-5">
            <EventDetail detailLabel="Date" detailValue={date} />
            <EventDetail detailLabel="Time" detailValue={time} />
            <div className="col-span-2">
              <EventDetail detailLabel="Location" detailValue={\`\${venue}, \${city}\`} />
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 px-5 py-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">
                SVG asset components
              </p>
              <p className="mt-2 text-xs text-neutral-500">Defined in the assets file.</p>
            </div>
            <EvencioLockup className="origin-right scale-[0.7]" />
          </div>

          <div className="mt-auto pt-6 text-xs text-neutral-400">
            Powered by Evencio - Swiss International 2026
          </div>
        </div>

        <div className="flex h-full flex-col border-l border-neutral-200 bg-neutral-950 text-white">
          <div className="flex-1 border-b border-neutral-800 p-6">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-neutral-400">
              <span>Release</span>
              <EventBadge badgeLabel="On sale" />
            </div>
            <div className="mt-6 h-40 w-full border border-neutral-800 bg-neutral-900" />
            <p className="mt-4 text-xs text-neutral-400">Doors open 19:30. Limited capacity.</p>
          </div>

          <div className="p-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">Next step</p>
            <div className="mt-4 inline-flex items-center border border-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white">
              {ctaLabel}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
`

const MULTI_COMPONENT_SNIPPET_SOURCE = serializeSnippetFiles(
	MULTI_COMPONENT_MAIN_SOURCE,
	MULTI_COMPONENT_FILES,
)

export const SNIPPET_TEMPLATES: Record<SnippetTemplateId, SnippetTemplate> = {
	single: {
		id: "single",
		label: "Single component",
		description: "One exported component with inline layout.",
		source: STARTER_SNIPPET_SOURCE,
	},
	multi: {
		id: "multi",
		label: "Multi-component",
		description: "Main component plus helpers with SVG asset components.",
		source: MULTI_COMPONENT_SNIPPET_SOURCE,
	},
	"layout-policy": {
		id: "layout-policy",
		label: "Layout snapping demo",
		description: "Shows the alignment-only snapping policy in action.",
		source: LAYOUT_SNAPPING_SOURCE,
	},
}

export const SNIPPET_TEMPLATE_OPTIONS = Object.values(SNIPPET_TEMPLATES)
