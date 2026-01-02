import { useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { Button } from "@/components/ui/button"
import type { PreviewLayerSnapshot, PreviewSourceLocation } from "@/lib/snippets/preview/runtime"
import { cn } from "@/lib/utils"

interface SnippetLayers3DViewProps {
	snapshot: PreviewLayerSnapshot | null
	error?: string | null
	selectedSource?: PreviewSourceLocation | null
	onSelectSource?: (source: PreviewSourceLocation) => void
	onRequestRefresh?: () => void
	onClose?: () => void
	className?: string
}

const palette = [0xe2e8f0, 0xcbd5e1, 0xd1d5db, 0xf1f5f9]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const sourceKey = (source?: PreviewSourceLocation | null) => {
	if (!source?.lineNumber) return null
	const fileName = source.fileName && source.fileName.trim().length > 0 ? source.fileName : "source"
	const column = source.columnNumber ?? 0
	return `${fileName}:${source.lineNumber}:${column}`
}

const computeDepth = (node: PreviewLayerSnapshot["nodes"][number], spacing: number) => {
	const stackDepth = Math.max(0, node.stackDepth)
	const zIndex = clamp(node.zIndex ?? 0, -12, 12)
	const score = stackDepth * 40 + zIndex * 8 + node.depth * 2.2 + node.order * 1.8
	return score * spacing
}

const disposeGroup = (group: THREE.Group) => {
	group.children.forEach((child) => {
		if (child instanceof THREE.Mesh) {
			child.geometry.dispose()
			if (Array.isArray(child.material)) {
				child.material.forEach((material) => {
					material.dispose()
				})
			} else {
				child.material.dispose()
			}
		}
	})
	group.clear()
}

const applyMeshAppearance = (mesh: THREE.Mesh, color: number, opacity: number) => {
	const material = mesh.material
	if (Array.isArray(material)) {
		material.forEach((entry) => {
			if ("color" in entry) {
				;(entry as THREE.MeshLambertMaterial).color.set(color)
				entry.opacity = opacity
				entry.transparent = opacity < 1
			}
		})
		return
	}
	if ("color" in material) {
		;(material as THREE.MeshLambertMaterial).color.set(color)
		material.opacity = opacity
		material.transparent = opacity < 1
	}
}

export function SnippetLayers3DView({
	snapshot,
	error,
	selectedSource,
	onSelectSource,
	onRequestRefresh,
	onClose,
	className,
}: SnippetLayers3DViewProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
	const controlsRef = useRef<OrbitControls | null>(null)
	const groupRef = useRef<THREE.Group | null>(null)
	const meshByKeyRef = useRef<Map<string, THREE.Mesh>>(new Map())
	const selectedMeshRef = useRef<THREE.Mesh | null>(null)
	const animationRef = useRef(0)
	const sceneRadiusRef = useRef(0)
	const sceneDistanceRef = useRef(0)
	const sceneMaxDimRef = useRef(0)
	const sceneDepthRef = useRef(0)
	const boundsBoxRef = useRef(new THREE.Box3())
	const boundsSphereRef = useRef(new THREE.Sphere())
	const needsRenderRef = useRef(false)
	const isAnimatingRef = useRef(false)
	const requestRenderRef = useRef<(() => void) | null>(null)
	const raycasterRef = useRef<THREE.Raycaster | null>(null)
	const raycastVectorRef = useRef(new THREE.Vector2())
	const homePositionRef = useRef(new THREE.Vector3())
	const homeTargetRef = useRef(new THREE.Vector3())
	const frustumRef = useRef(new THREE.Frustum())
	const projMatrixRef = useRef(new THREE.Matrix4())
	const isResettingRef = useRef(false)
	const frameCameraRef = useRef<(() => void) | null>(null)
	const clampControlsRef = useRef<(() => void) | null>(null)
	const onSelectSourceRef = useRef(onSelectSource)
	const outOfViewFramesRef = useRef(0)
	const [isWebglAvailable, setIsWebglAvailable] = useState(true)
	const [localSelection, setLocalSelection] = useState<PreviewSourceLocation | null>(null)
	const [sceneReady, setSceneReady] = useState(false)

	const activeSelection = selectedSource ?? localSelection
	const activeSelectionKey = useMemo(() => sourceKey(activeSelection), [activeSelection])

	useEffect(() => {
		onSelectSourceRef.current = onSelectSource
	}, [onSelectSource])

	useEffect(() => {
		if (selectedSource) {
			setLocalSelection(selectedSource)
		}
	}, [selectedSource])

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		let renderer: THREE.WebGLRenderer
		try {
			renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
		} catch {
			setIsWebglAvailable(false)
			return
		}

		const scene = new THREE.Scene()
		const camera = new THREE.PerspectiveCamera(40, 1, 1, 10000)
		const controls = new OrbitControls(camera, renderer.domElement)
		controls.enableDamping = true
		controls.dampingFactor = 0.08
		controls.maxPolarAngle = Math.PI / 2.05
		controls.minPolarAngle = 0.2
		controls.enablePan = true
		controls.screenSpacePanning = true

		const ambient = new THREE.AmbientLight(0xffffff, 0.85)
		const directional = new THREE.DirectionalLight(0xffffff, 0.6)
		directional.position.set(0, -1, 1)

		scene.add(ambient)
		scene.add(directional)

		const group = new THREE.Group()
		scene.add(group)

		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
		renderer.setClearColor(0xf8fafc, 1)
		container.appendChild(renderer.domElement)

		cameraRef.current = camera
		controlsRef.current = controls
		groupRef.current = group
		setSceneReady(true)

		const requestRender = () => {
			needsRenderRef.current = true
			if (!isAnimatingRef.current) {
				animationRef.current = window.requestAnimationFrame(renderFrame)
			}
		}

		const renderFrame = () => {
			isAnimatingRef.current = true
			const didUpdate = controls.update()
			clampControls()
			if (didUpdate || needsRenderRef.current) {
				renderer.render(scene, camera)
				needsRenderRef.current = false
			}
			if (didUpdate) {
				animationRef.current = window.requestAnimationFrame(renderFrame)
			} else {
				isAnimatingRef.current = false
			}
		}

		requestRenderRef.current = requestRender
		raycasterRef.current = new THREE.Raycaster()

		const resize = () => {
			const rect = container.getBoundingClientRect()
			if (!rect.width || !rect.height) return
			renderer.setSize(rect.width, rect.height, false)
			camera.aspect = rect.width / rect.height
			camera.updateProjectionMatrix()
			frameCameraRef.current?.()
			clampControlsRef.current?.()
			requestRender()
		}

		resize()
		const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null
		observer?.observe(container)

		const resetCamera = () => {
			if (!cameraRef.current || !controlsRef.current) return
			isResettingRef.current = true
			if (frameCameraRef.current) {
				frameCameraRef.current()
			} else {
				cameraRef.current.position.copy(homePositionRef.current)
				controlsRef.current.target.copy(homeTargetRef.current)
				cameraRef.current.lookAt(homeTargetRef.current)
				controlsRef.current.update()
			}
			isResettingRef.current = false
		}

		const clampControls = () => {
			if (isResettingRef.current) return
			const radius = sceneRadiusRef.current
			if (!radius || !cameraRef.current || !controlsRef.current) return
			const cameraRefCurrent = cameraRef.current
			const controlsRefCurrent = controlsRef.current
			const maxTargetRadius = radius * 1.25
			const target = controlsRefCurrent.target
			if (!Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.z)) {
				controlsRefCurrent.target.set(0, 0, 0)
				cameraRefCurrent.position.set(0, -radius * 0.4, sceneDistanceRef.current || radius * 2)
				cameraRefCurrent.lookAt(0, 0, 0)
				return
			}
			const length = target.length()
			const needsTargetClamp = length > maxTargetRadius
			const clampedTarget = needsTargetClamp ? target.clone().setLength(maxTargetRadius) : target
			const offset = cameraRefCurrent.position.clone().sub(target)
			const offsetLength = offset.length()
			const minDistance = Math.max(1, sceneDistanceRef.current * 0.25)
			const maxDistance = sceneDistanceRef.current * 5 + radius * 2
			if (!Number.isFinite(offsetLength) || offsetLength === 0) {
				resetCamera()
				return
			}
			if (offsetLength < minDistance || offsetLength > maxDistance) {
				offset.setLength(clamp(offsetLength, minDistance, maxDistance))
			}
			if (needsTargetClamp || offsetLength < minDistance || offsetLength > maxDistance) {
				controlsRefCurrent.target.copy(clampedTarget)
				cameraRefCurrent.position.copy(clampedTarget.clone().add(offset))
			}

			cameraRefCurrent.updateMatrixWorld()
			const frustum = frustumRef.current
			const projMatrix = projMatrixRef.current
			projMatrix.multiplyMatrices(
				cameraRefCurrent.projectionMatrix,
				cameraRefCurrent.matrixWorldInverse,
			)
			frustum.setFromProjectionMatrix(projMatrix)
			if (!boundsBoxRef.current.isEmpty()) {
				if (frustum.intersectsBox(boundsBoxRef.current)) {
					outOfViewFramesRef.current = 0
				} else {
					outOfViewFramesRef.current += 1
					if (outOfViewFramesRef.current > 12) {
						outOfViewFramesRef.current = 0
						resetCamera()
					}
				}
			}
		}

		clampControlsRef.current = clampControls

		requestRender()

		controls.addEventListener("change", requestRender)

		const handleClick = (event: MouseEvent) => {
			if (!groupRef.current || !cameraRef.current) return
			const rect = container.getBoundingClientRect()
			const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
			const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
			const raycaster = raycasterRef.current ?? new THREE.Raycaster()
			raycasterRef.current = raycaster
			const vector = raycastVectorRef.current
			vector.set(x, y)
			raycaster.setFromCamera(vector, cameraRef.current)
			const hits = raycaster.intersectObjects(groupRef.current.children, true)
			if (!hits.length) return
			const mesh = hits.find((hit) => hit.object instanceof THREE.Mesh)?.object
			if (!(mesh instanceof THREE.Mesh)) return
			const source = mesh.userData.source as PreviewSourceLocation | null | undefined
			if (!source) return
			setLocalSelection(source)
			onSelectSourceRef.current?.(source)
		}

		renderer.domElement.addEventListener("click", handleClick)

		return () => {
			renderer.domElement.removeEventListener("click", handleClick)
			requestRenderRef.current = null
			raycasterRef.current = null
			window.cancelAnimationFrame(animationRef.current)
			observer?.disconnect()
			controls.removeEventListener("change", requestRender)
			clampControlsRef.current = null
			controls.dispose()
			renderer.dispose()
			disposeGroup(group)
			if (renderer.domElement.parentElement === container) {
				container.removeChild(renderer.domElement)
			}
		}
	}, [])

	useEffect(() => {
		const group = groupRef.current
		const camera = cameraRef.current
		const controls = controlsRef.current
		if (!group || !camera || !controls || !sceneReady) return

		disposeGroup(group)
		group.position.set(0, 0, 0)
		meshByKeyRef.current.clear()
		selectedMeshRef.current = null
		boundsBoxRef.current.makeEmpty()

		if (!snapshot) {
			requestRenderRef.current?.()
			return
		}

		const { width, height, nodes } = snapshot
		const baseSize = Math.max(width, height)
		const spacing = clamp(baseSize / 120, 14, 50)
		const originX = -width / 2
		const originY = height / 2

		const base = new THREE.Mesh(
			new THREE.PlaneGeometry(width, height),
			new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide }),
		)
		base.position.set(0, 0, -18)
		group.add(base)

		let maxDepth = 0
		nodes.forEach((node, index) => {
			if (node.id === "root") return
			if (node.rect.width < 1 || node.rect.height < 1) return

			const depth = computeDepth(node, spacing)
			maxDepth = Math.max(maxDepth, depth)
			const color = palette[index % palette.length]
			const opacity = clamp(node.opacity, 0.25, 0.9)
			const geometry = new THREE.PlaneGeometry(node.rect.width, node.rect.height)
			const material = new THREE.MeshLambertMaterial({
				color,
				transparent: true,
				opacity,
				side: THREE.DoubleSide,
			})
			const mesh = new THREE.Mesh(geometry, material)
			mesh.position.set(
				originX + node.rect.x + node.rect.width / 2,
				originY - node.rect.y - node.rect.height / 2,
				depth,
			)
			mesh.userData = {
				source: node.source ?? null,
				baseColor: color,
				baseOpacity: opacity,
			}
			group.add(mesh)

			const key = sourceKey(node.source)
			if (key && !meshByKeyRef.current.has(key)) {
				meshByKeyRef.current.set(key, mesh)
			}
		})

		const bounds = new THREE.Box3().setFromObject(group)
		const center = bounds.getCenter(new THREE.Vector3())
		group.position.sub(center)

		const centeredBounds = boundsBoxRef.current
		centeredBounds.copy(bounds)
		centeredBounds.translate(center.clone().multiplyScalar(-1))
		const size = centeredBounds.getSize(new THREE.Vector3())
		const sphere = boundsSphereRef.current
		centeredBounds.getBoundingSphere(sphere)
		const maxDim = Math.max(size.x, size.y, size.z, Math.max(width, height), sphere.radius * 2)
		sceneMaxDimRef.current = maxDim
		sceneDepthRef.current = maxDepth

		const frameCamera = () => {
			if (!cameraRef.current || !controlsRef.current) return
			const nextSphere = boundsSphereRef.current
			if (!Number.isFinite(nextSphere.radius) || nextSphere.radius <= 0) return
			const fitDistance = nextSphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))
			const distance = fitDistance * 1.45
			const polar = THREE.MathUtils.degToRad(76)
			const azimuth = THREE.MathUtils.degToRad(-18)
			const position = new THREE.Vector3().setFromSpherical(
				new THREE.Spherical(distance, polar, azimuth),
			)
			camera.position.copy(position)
			camera.near = Math.max(0.1, distance / 200)
			camera.far = distance * 12 + sceneDepthRef.current * 6 + sceneMaxDimRef.current * 2
			camera.updateProjectionMatrix()
			controls.target.set(0, 0, 0)
			controls.minDistance = distance * 0.5
			controls.maxDistance = distance * 4.25
			camera.lookAt(controls.target)
			controls.update()
			const radius = Math.max(nextSphere.radius, 1)
			sceneRadiusRef.current = radius * 1.15
			sceneDistanceRef.current = distance
			homePositionRef.current.copy(camera.position)
			homeTargetRef.current.copy(controls.target)
		}

		frameCameraRef.current = frameCamera
		frameCamera()
		requestRenderRef.current?.()

		if (maxDepth > 0) {
			base.position.z = -maxDepth - 30
		}
	}, [sceneReady, snapshot])

	useEffect(() => {
		if (!snapshot) {
			selectedMeshRef.current = null
			return
		}
		const meshByKey = meshByKeyRef.current
		const previous = selectedMeshRef.current
		if (previous) {
			applyMeshAppearance(previous, previous.userData.baseColor, previous.userData.baseOpacity)
		}
		if (!activeSelectionKey) {
			selectedMeshRef.current = null
			return
		}
		const nextMesh = meshByKey.get(activeSelectionKey) ?? null
		if (nextMesh) {
			applyMeshAppearance(nextMesh, 0x111827, 0.95)
		}
		selectedMeshRef.current = nextMesh
		requestRenderRef.current?.()
	}, [activeSelectionKey, snapshot])

	const layerCount = snapshot ? Math.max(0, snapshot.nodes.length - 1) : 0

	return (
		<div className={cn("flex h-full w-full flex-col bg-white", className)}>
			<div className="flex h-9 items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3">
				<div className="flex items-center gap-2">
					<span className="text-xs font-medium text-neutral-600">Layers 3D</span>
					<span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
						{snapshot ? `${layerCount} layers` : "Waiting for preview"}
					</span>
				</div>
				<div className="flex items-center gap-2">
					{onRequestRefresh && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-[11px]"
							onClick={onRequestRefresh}
						>
							Refresh
						</Button>
					)}
					{onClose && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-[11px]"
							onClick={onClose}
						>
							Close
						</Button>
					)}
				</div>
			</div>
			<div className="relative flex-1 bg-neutral-100">
				<div ref={containerRef} className="absolute inset-0" />
				{(!snapshot || error || !isWebglAvailable) && (
					<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-200 bg-white/80 text-center">
						<span className="text-sm font-medium text-neutral-600">
							{error
								? "Layers preview failed"
								: !isWebglAvailable
									? "WebGL not available"
									: "Build a preview to see layers"}
						</span>
						<span className="max-w-[260px] text-xs text-neutral-500">
							{error ? error : "Run the snippet preview, then orbit and zoom the layer stack."}
						</span>
					</div>
				)}
			</div>
			<div className="flex items-center justify-between border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] text-neutral-500">
				<span>Drag to orbit. Scroll to zoom.</span>
				<span className="text-neutral-400">Stacking-context depth</span>
			</div>
		</div>
	)
}
