import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router"
import { ClientOnly } from "@/components/ui/client-only"
import { Toaster } from "@/components/ui/sonner"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Evencio Studio",
			},
			{
				name: "description",
				content:
					"Evencio Studio lets you create social media images, posters, and promotional materials for events",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lexend+Exa:wght@700&family=Unbounded:wght@400&display=swap",
			},
		],
	}),

	component: RootComponent,
})

function RootComponent() {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body className="min-h-screen bg-background antialiased">
				<Outlet />
				<ClientOnly>
					<Toaster closeButton position="bottom-right" />
				</ClientOnly>
				<Scripts />
			</body>
		</html>
	)
}
