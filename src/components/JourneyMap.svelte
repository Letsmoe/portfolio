<script lang="ts">

	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import DayStory from "#components/DayStory.svelte";
	import { flagEmoji, formatStepDate, weatherEmoji, type StepDetail } from "#lib/journey.ts";
	import { nearestPhotoIndex, placeDropdown, routeHops, truncateRoute, type MapData } from "#lib/map.ts";
	import { createMapStyle, WATER_PATTERN, WOOD_PATTERN, type MapTheme } from "#lib/mapStyle.ts";
	import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
	import ArrowLeft from "phosphor-svelte/lib/ArrowLeft";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";
	import Minus from "phosphor-svelte/lib/Minus";
	import Plus from "phosphor-svelte/lib/Plus";
	import X from "phosphor-svelte/lib/X";
	import ArrowSquareOut from "phosphor-svelte/lib/ArrowSquareOut";
	import { onMount, untrack } from "svelte";
	import { fade, fly } from "svelte/transition";



	interface Props {
		data: MapData;
		/** Embedded maps only zoom with ctrl/⌘ + scroll so the page keeps scrolling. */
		embedded?: boolean;
		/** Distance of the map controls from the top edge; full-bleed maps sit under the floating header. */
		chromeTop?: string;
		children?: import('svelte').Snippet;
	}

	let {
		data,
		embedded = false,
		chromeTop = "0.75rem",
		children
	}: Props = $props();

	/** Stops merge into clusters up to this zoom; opening a day zooms in past it. */
	const CLUSTER_MAX_ZOOM = 8;
	const MAX_NODES = 120;
	const DRAW_DURATION_MS = 3500;
	const DROPDOWN_WIDTH = 320;
	/** Sorts after every real index, so a cluster only falls back to it when none of its stops has a photo. */
	const NO_PHOTO = 1_000_000;

	type Opened = { lngLat: [number, number]; slug: string };

	let container: HTMLDivElement = $state();
	let map: MapLibreMap | undefined = $state();
	let mapWidth = $state(0);
	let mapHeight = $state(0);
	let opened: Opened | null = $state(null);
	/** Every GPS fix; swapped in for the simplified route once the draw-in is done. */
	let fullRoute: MapData["route"] | null = null;
	let anchor: { x: number; y: number } | null = $state(null);
	let selected: StepDetail | null = $state(null);
	let activePhoto = $state(0);
	let loading = $state(false);
	let routeProgress = 1;
	let failure: string | null = $state(null);
	let loaded = $state(false);


	function dayNumber(time: string) {
		return Math.round((Date.parse(time) - Date.parse(data.stops[0].time)) / 86_400_000) + 1;
	}

	function openSheet() {
		if (!selected) return;
		goto(`/journey/${selected.step.slug}`, { shallow: true, state: { daySheet: selected.step.slug } });
	}

	function closeSheet() {
		history.back();
	}

	const stopIndex = new Map(data.stops.map((stop, index) => [stop.slug, index]));
	/** Stops without photos show the nearest one along the route, so every node has a picture. */
	const photoSource = nearestPhotoIndex(data.stops);

	function currentTheme(): MapTheme {
		return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
	}

	function featureCollection<T extends GeoJSON.Geometry>(geometries: T[], properties: Record<string, unknown>[] = []) {
		return {
			type: "FeatureCollection" as const,
			features: geometries.map((geometry, index) => ({ type: "Feature" as const, geometry, properties: properties[index] ?? {} })),
		};
	}

	function routeGeoJSON(fraction: number) {
		const coordinates = fraction >= 1 && fullRoute ? fullRoute : truncateRoute(data.route, fraction);
		return featureCollection([{ type: "MultiLineString", coordinates }]);
	}

	async function loadFullRoute() {
		const response = await fetch("/journey/route.json");
		if (!response.ok) return;
		fullRoute = await response.json();
		(map?.getSource("route") as GeoJSONSource | undefined)?.setData(routeGeoJSON(1));
	}

	/** Patterns are drawn here rather than shipped as a sprite; MapLibre asks for them on demand. */
	function patternImage(id: string, theme: MapTheme): ImageData | null {
		const size = id === WATER_PATTERN ? 8 : 12;
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size;
		const context = canvas.getContext("2d");
		if (!context) return null;
		const ink = theme === "dark" ? "rgba(200, 220, 225, 0.35)" : "rgba(60, 90, 100, 0.35)";
		if (id === WATER_PATTERN) {
			context.fillStyle = ink;
			context.fillRect(3, 3, 1.2, 1.2);
		} else if (id === WOOD_PATTERN) {
			context.strokeStyle = theme === "dark" ? "rgba(160, 200, 150, 0.35)" : "rgba(60, 90, 50, 0.4)";
			context.lineWidth = 1;
			context.beginPath();
			context.moveTo(3, 8);
			context.lineTo(5, 4);
			context.lineTo(7, 8);
			context.stroke();
		} else {
			return null;
		}
		return context.getImageData(0, 0, size, size);
	}

	function addJourneyLayers(map: MapLibreMap) {
		const accent = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim();
		const paper = getComputedStyle(document.documentElement).getPropertyValue("--color-card").trim();
		const ink = getComputedStyle(document.documentElement).getPropertyValue("--color-ink").trim();
		const flagBlue = getComputedStyle(document.documentElement).getPropertyValue("--color-flag-blue").trim();

		map.addSource("route", { type: "geojson", data: routeGeoJSON(routeProgress) });
		map.addSource("hops", {
			type: "geojson",
			data: featureCollection(routeHops(data.route).map((coordinates) => ({ type: "LineString" as const, coordinates }))),
		});
		map.addSource("stops", {
			type: "geojson",
			cluster: true,
			clusterRadius: 48,
			clusterMaxZoom: CLUSTER_MAX_ZOOM,
			// The earliest stop with a photo lends the cluster its picture; without one, a neighbour's.
			clusterProperties: { photoIndex: ["min", ["get", "photoIndex"]], borrowedIndex: ["min", ["get", "borrowedIndex"]] },
			data: featureCollection(
				data.stops.map((stop) => ({ type: "Point" as const, coordinates: [stop.lon, stop.lat] })),
				data.stops.map((stop, index) => ({ slug: stop.slug, index, photoIndex: stop.micro ? index : NO_PHOTO, borrowedIndex: photoSource[index] })),
			),
		});

		map.addLayer({
			id: "hops",
			type: "line",
			source: "hops",
			paint: { "line-color": flagBlue, "line-width": 1.4, "line-dasharray": [2, 3], "line-opacity": 0.8 },
		});
		map.addLayer({
			id: "route-halo",
			type: "line",
			source: "route",
			layout: { "line-cap": "round", "line-join": "round" },
			paint: { "line-color": paper, "line-width": ["interpolate", ["linear"], ["zoom"], 2, 4, 10, 8] },
		});
		map.addLayer({
			id: "route",
			type: "line",
			source: "route",
			layout: { "line-cap": "round", "line-join": "round" },
			paint: { "line-color": accent, "line-width": ["interpolate", ["linear"], ["zoom"], 2, 2, 10, 4] },
		});
		map.addLayer({
			id: "clusters",
			type: "circle",
			source: "stops",
			filter: ["has", "point_count"],
			paint: {
				"circle-color": paper,
				"circle-stroke-color": ink,
				"circle-stroke-width": 1,
				"circle-radius": ["step", ["get", "point_count"], 11, 10, 14, 40, 18],
			},
		});
		map.addLayer({
			id: "cluster-count",
			type: "symbol",
			source: "stops",
			filter: ["has", "point_count"],
			layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 11 },
			paint: { "text-color": ink },
		});
		map.addLayer({
			id: "stop-dots",
			type: "circle",
			source: "stops",
			filter: ["!", ["has", "point_count"]],
			paint: { "circle-color": accent, "circle-radius": 5, "circle-stroke-color": paper, "circle-stroke-width": 2 },
		});
	}

	const nodes = new Map<string, Marker>();

	/**
	 * Every cluster and stop on screen gets a photo node; images are ~1 KB and load lazily.
	 * Reads the clustered source rather than hit-testing the rendered circles, which comes back
	 * empty at some zoom levels on the globe. Markers hide themselves behind the globe.
	 */
	async function syncNodes() {
		if (!map) return;
		const { Marker } = await import("maplibre-gl");
		const margin = 40;
		const visible = new Map<string, { index: number; stop?: number; count: number; clusterId?: number; lngLat: [number, number] }>();
		for (const feature of map.querySourceFeatures("stops")) {
			if (visible.size >= MAX_NODES) break;
			if (feature.geometry.type !== "Point") continue;
			const properties = feature.properties ?? {};
			const key = properties.cluster ? `cluster:${properties.cluster_id}` : properties.slug;
			if (visible.has(key)) continue;
			const stop = properties.cluster ? undefined : data.stops[properties.index];
			// Source features come quantised to the tile grid; single stops use their exact position.
			const lngLat = (stop ? [stop.lon, stop.lat] : feature.geometry.coordinates) as [number, number];
			const point = map.project(lngLat);
			if (point.x < -margin || point.y < -margin || point.x > mapWidth + margin || point.y > mapHeight + margin) continue;
			if (properties.cluster) {
				const index = properties.photoIndex < NO_PHOTO ? properties.photoIndex : properties.borrowedIndex;
				visible.set(key, { index, count: properties.point_count, clusterId: properties.cluster_id, lngLat });
			} else {
				visible.set(key, { index: photoSource[properties.index], stop: properties.index, count: 1, lngLat });
			}
		}

		for (const [key, marker] of nodes) {
			if (visible.has(key)) continue;
			marker.remove();
			nodes.delete(key);
		}

		for (const [key, node] of visible) {
			if (nodes.has(key)) continue;
			const stop = node.stop === undefined ? undefined : data.stops[node.stop];
			const micro = data.stops[node.index]?.micro;
			const element = document.createElement("button");
			element.className = ["journey-node", node.clusterId === undefined ? "" : "cluster", micro ? "" : "no-photo"].join(" ");
			element.title = node.clusterId === undefined ? (stop?.name ?? "") : `${node.count} stops`;
			element.setAttribute("aria-label", node.clusterId === undefined ? `Open ${stop?.name}` : `Zoom into ${node.count} stops`);
			const face = micro ? `<img src="${micro}" alt="" loading="lazy" decoding="async" width="44" height="44">` : "";
			element.innerHTML = `<span class="journey-node-face">${face}</span>${
				node.clusterId === undefined ? "" : `<span class="journey-node-count">${node.count}</span>`
			}`;
			element.addEventListener("click", (event) => {
				event.stopPropagation();
				if (node.clusterId === undefined) stop && openDay(stop.slug);
				else zoomIntoCluster(node.clusterId, node.lngLat);
			});
			nodes.set(key, new Marker({ element, opacityWhenCovered: "0" }).setLngLat(node.lngLat).addTo(map));
		}

		for (const [key, marker] of nodes) {
			marker.getElement().classList.toggle("active", key === selectedSlug);
		}
	}

	function updateAnchor() {
		if (!map || !opened) {
			anchor = null;
			return;
		}
		const point = map.project(opened.lngLat);
		anchor = { x: point.x, y: point.y };
	}

	async function zoomIntoCluster(clusterId: number, lngLat: [number, number]) {
		if (!map) return;
		const zoom = await (map.getSource("stops") as GeoJSONSource).getClusterExpansionZoom(clusterId);
		close();
		map.easeTo({ center: lngLat, zoom });
	}

	let requestController: AbortController | undefined;

	async function openDay(slug: string) {
		const stop = data.stops[stopIndex.get(slug) ?? -1];
		if (!stop) return;
		opened = { lngLat: [stop.lon, stop.lat], slug };
		if (sheetSlug && sheetSlug !== slug) goto(`/journey/${slug}`, { shallow: true, replace: true, state: { daySheet: slug } });
		activePhoto = 0;
		loading = true;
		requestController?.abort();
		requestController = new AbortController();

		if (map) {
			const below = map.project([stop.lon, stop.lat]).y < mapHeight * 0.55;
			map.flyTo({
				center: [stop.lon, stop.lat],
				zoom: Math.max(map.getZoom(), CLUSTER_MAX_ZOOM + 1),
				// Leave room for the dropdown on the side it opens towards.
				offset: [0, below ? -mapHeight * 0.22 : mapHeight * 0.22],
				essential: true,
			});
		}
		updateAnchor();

		try {
			const response = await fetch(`/api/steps/${slug}.json`, { signal: requestController.signal });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			selected = await response.json();
		} catch (error) {
			if ((error as Error).name !== "AbortError") selected = null;
		} finally {
			loading = false;
		}
		syncNodes();
	}

	function close() {
		requestController?.abort();
		selected = null;
		opened = null;
		anchor = null;
		syncNodes();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === "Escape" && sheetSlug) {
			closeSheet();
			return;
		}
		if (!opened) return;
		if (event.key === "Escape") close();
		if (event.key === "ArrowLeft" && selected?.previous) openDay(selected.previous);
		if (event.key === "ArrowRight" && selected?.next) openDay(selected.next);
	}

	onMount(() => {
		let disposed = false;
		let themeObserver: MutationObserver | undefined;

		const start = async () => {
			const [maplibre, { default: workerUrl }] = await Promise.all([
				import("maplibre-gl"),
				import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
				import("maplibre-gl/dist/maplibre-gl.css"),
			]);
			if (disposed) return;
			// MapLibre resolves its worker relative to its own module at runtime, which
			// Vite neither follows nor copies; hand it the bundled asset URL instead.
			maplibre.setWorkerUrl(workerUrl);

			const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			routeProgress = reducedMotion ? 1 : 0;

			map = new maplibre.Map({
				container,
				style: createMapStyle(currentTheme()),
				// Centred between Europe and Asia, where most of the route is, with the globe
				// ~1.4x as tall as the map so it fills the frame. Globe diameter is 512·2^zoom/π px.
				center: [60, 30],
				zoom: Math.log2((1.4 * container.clientHeight * Math.PI) / 512),
				attributionControl: { compact: true },
				cooperativeGestures: embedded,
				dragRotate: false,
				pitchWithRotate: false,
			});
			map.touchZoomRotate.disableRotation();
			map.on("error", ({ error }) => {
				console.error("[JourneyMap]", error);
				failure = error?.message ?? String(error);
			});

			map.setMissingStyleImageResolver((id) => {
				const image = patternImage(id, currentTheme());
				if (image && map && !map.hasImage(id)) map.addImage(id, image);
			});
			map.on("style.load", () => map && addJourneyLayers(map));
			map.once("load", () => (loaded = true));
			map.on("idle", syncNodes);
			map.on("moveend", syncNodes);
			map.on("move", updateAnchor);

			map.on("click", (event) => {
				if (!map) return;
				const [feature] = map.queryRenderedFeatures(event.point, { layers: ["clusters", "stop-dots"] });
				if (!feature || feature.geometry.type !== "Point") {
					close();
					return;
				}
				const properties = feature.properties ?? {};
				if (properties.cluster) zoomIntoCluster(properties.cluster_id, feature.geometry.coordinates as [number, number]);
				else openDay(properties.slug);
			});
			for (const layer of ["stop-dots", "clusters"]) {
				map.on("mouseenter", layer, () => map && (map.getCanvas().style.cursor = "pointer"));
				map.on("mouseleave", layer, () => map && (map.getCanvas().style.cursor = ""));
			}

			map.once("load", () => {
				if (reducedMotion) {
					loadFullRoute();
					return;
				}
				const start = performance.now();
				const frame = (now: number) => {
					if (!map || disposed) return;
					routeProgress = Math.min((now - start) / DRAW_DURATION_MS, 1);
					(map.getSource("route") as GeoJSONSource | undefined)?.setData(routeGeoJSON(routeProgress));
					if (routeProgress < 1) requestAnimationFrame(frame);
					else loadFullRoute();
				};
				requestAnimationFrame(frame);
			});

			themeObserver = new MutationObserver(() => {
				for (const marker of nodes.values()) marker.remove();
				nodes.clear();
				map?.setStyle(createMapStyle(currentTheme()));
			});
			themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
		};
		start().catch((error) => {
			console.error("[JourneyMap]", error);
			failure = error instanceof Error ? error.message : String(error);
		});

		return () => {
			disposed = true;
			themeObserver?.disconnect();
			requestController?.abort();
			map?.remove();
		};
	});
	let photo = $derived(selected?.step.photos[activePhoto]);
	let placement = $derived(anchor ? placeDropdown(anchor, Math.min(DROPDOWN_WIDTH, mapWidth - 16), { width: mapWidth, height: mapHeight }) : null);
	let selectedSlug = $derived(opened?.slug ?? null);
	/** The side sheet lives in history state, so the back button closes it and the URL is shareable. */
	let sheetSlug = $derived(page.state.daySheet ?? null);
	$effect(() => {
		const slug = sheetSlug;
		if (slug && opened?.slug !== slug) untrack(() => openDay(slug));
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div class="journey-map space relative h-full w-full overflow-hidden" bind:clientWidth={mapWidth} bind:clientHeight={mapHeight}>
	<!-- MapLibre's own (unlayered) CSS makes this `position: relative`, which beats Tailwind's `absolute`, so size it explicitly. -->
	<div class="h-full w-full" bind:this={container}></div>

	<div class="absolute right-3 flex overflow-hidden rounded-xl border border-line bg-card/90 shadow-soft backdrop-blur" style="top: {chromeTop}">
		<button class="p-2 hover:bg-sunken" onclick={() => map?.zoomOut()} aria-label="Zoom out"><Minus size={16} /></button>
		<button class="border-l border-line p-2 hover:bg-sunken" onclick={() => map?.zoomIn()} aria-label="Zoom in"><Plus size={16} /></button>
	</div>

	{@render children?.()}

	{#if !loaded && !failure}
		<div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted">
			<p class="m-0 font-mono text-xs uppercase tracking-widest">Unfolding the map…</p>
		</div>
	{/if}

	{#if failure}
		<p class="absolute bottom-3 right-3 z-20 m-0 max-w-sm rounded-xl border border-accent/40 bg-card px-3 py-2 font-mono text-xs text-accent shadow-soft">
			Map error: {failure}
		</p>
	{/if}

	{#if opened && placement}
		<div
			class="dropdown absolute z-10 flex max-h-[min(30rem,calc(100%-5rem))] flex-col rounded-2xl border border-line bg-card shadow-lift"
			class:below={placement.below}
			style="left: {placement.left}px; width: {Math.min(DROPDOWN_WIDTH, mapWidth - 16)}px; {placement.below ? 'top' : 'bottom'}: {placement.offset}px; --caret: {placement.caret}px"
			aria-live="polite"
			onwheel={(event) => event.stopPropagation()}
		>
			<span class="caret" aria-hidden="true"></span>

			<div class="relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-2xl bg-sunken">
				{#if photo}
					{#key photo.src}
						<img src={photo.src} alt={selected?.step.name} class="m-0 h-full w-full object-cover" />
					{/key}
				{:else if !loading}
					<p class="m-0 flex h-full items-center justify-center font-hand text-2xl text-muted">No photos that day</p>
				{/if}
				<button class="btn btn-square absolute right-2 top-2 bg-card/90" onclick={close} aria-label="Close"><X size={14} /></button>
				{#if selected && selected.step.photos.length > 1}
					<div class="absolute bottom-2 left-2 right-2 flex gap-1 overflow-x-auto">
						{#each selected.step.photos as candidate, index}
							<button
								class="h-8 w-8 shrink-0 overflow-hidden rounded-md ring-2 {index === activePhoto ? 'ring-accent' : 'ring-card/70'}"
								onclick={() => (activePhoto = index)}
								aria-label="Photo {index + 1}"
							>
								<img src={candidate.micro} alt="" class="m-0 h-full w-full object-cover" loading="lazy" />
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex min-h-0 flex-col gap-2.5 overflow-y-auto overscroll-contain p-4">
				{#if selected}
					<div>
						<p class="label m-0">Day {dayNumber(selected.step.time)}</p>
						<h3 class="m-0 text-lg font-semibold leading-tight tracking-tight">{selected.step.name}</h3>
					</div>
					<div class="flex flex-wrap gap-1.5">
						<span class="tag">{flagEmoji(selected.step.countryCode)} {selected.step.country}</span>
						<span class="tag bg-sunken font-mono text-ink">{formatStepDate(selected.step)}</span>
						{#if selected.step.weather}
							<span class="tag bg-accent/12 text-accent">
								{weatherEmoji(selected.step.weather.condition)}
								{#if selected.step.weather.temperature !== null}{selected.step.weather.temperature}°C{/if}
							</span>
						{/if}
					</div>
					{#if selected.step.description}
						<p class="m-0 whitespace-pre-line font-mono text-xs leading-relaxed text-muted">{selected.step.description}</p>
					{/if}
					<div class="flex items-center justify-between gap-2 pt-1">
						<div class="flex gap-1">
							<button class="btn btn-square" disabled={!selected.previous} onclick={() => selected?.previous && openDay(selected.previous)} aria-label="Previous stop">
								<ArrowLeft size={14} />
							</button>
							<button class="btn btn-square" disabled={!selected.next} onclick={() => selected?.next && openDay(selected.next)} aria-label="Next stop">
								<ArrowRight size={14} />
							</button>
						</div>
						<a href="/journey/{selected.step.slug}" class="btn btn-ink" onclick={(event) => {
								event.preventDefault();
								openSheet();
							}}>Read more <ArrowRight size={14} /></a>
					</div>
				{:else}
					<div class="h-3 w-16 animate-pulse rounded bg-sunken"></div>
					<div class="h-5 w-40 animate-pulse rounded bg-sunken"></div>
					<div class="h-16 w-full animate-pulse rounded bg-sunken"></div>
				{/if}
			</div>
		</div>
	{/if}

	{#if sheetSlug}
		<div class="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px]" transition:fade={{ duration: 200 }} onclick={closeSheet} aria-hidden="true"></div>
		<aside
			class="day-sheet fixed inset-y-0 right-0 z-50 w-full max-w-2xl overflow-y-auto overscroll-contain bg-paper shadow-lift"
			transition:fly={{ x: 640, duration: 350, opacity: 1 }}
			aria-label="Day details"
		>
			<div class="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur">
				<div class="flex gap-1">
					<button class="btn btn-square" disabled={!selected?.previous} onclick={() => selected?.previous && openDay(selected.previous)} aria-label="Previous day">
						<ArrowLeft size={14} />
					</button>
					<button class="btn btn-square" disabled={!selected?.next} onclick={() => selected?.next && openDay(selected.next)} aria-label="Next day">
						<ArrowRight size={14} />
					</button>
				</div>
				<div class="flex gap-1">
					<a href="/journey/{sheetSlug}" class="btn btn-ghost" data-sveltekit-reload>Open as page <ArrowSquareOut size={14} /></a>
					<button class="btn btn-square" onclick={closeSheet} aria-label="Close"><X size={14} /></button>
				</div>
			</div>
			<div class="px-5 py-8 sm:px-8">
				{#if selected && selected.step.slug === sheetSlug}
					<DayStory step={selected.step} day={dayNumber(selected.step.time)} compact />
				{:else}
					<div class="space-y-4">
						<div class="h-3 w-16 animate-pulse rounded bg-sunken"></div>
						<div class="h-12 w-3/4 animate-pulse rounded bg-sunken"></div>
						<div class="h-64 w-full animate-pulse rounded-2xl bg-sunken"></div>
					</div>
				{/if}
			</div>
		</aside>
	{/if}
</div>

<style>
	@reference "../style/main.css";

	/* Behind the globe; MapLibre leaves everything outside the sphere transparent. */
	.space {
		background:
			radial-gradient(ellipse 60% 45% at 50% 108%, rgb(255 255 255 / 0.9), transparent 70%),
			linear-gradient(180deg, #2c66ad 0%, #6f9ccf 35%, #c9d6e4 70%, #eceeee 100%);
	}

	/* Faint contour lines in the sky, masked so they take the theme colour. */
	.space::before {
		content: "";
		position: absolute;
		inset: 0;
		background-color: #fff;
		opacity: 0.18;
		mask: url("/images/topo.svg") center / cover no-repeat;
	}

	:global([data-theme="dark"]) .space {
		background:
			radial-gradient(1px 1px at 12% 18%, #fff8 50%, transparent 51%),
			radial-gradient(1px 1px at 27% 72%, #fff6 50%, transparent 51%),
			radial-gradient(1.5px 1.5px at 41% 9%, #fff9 50%, transparent 51%),
			radial-gradient(1px 1px at 63% 84%, #fff5 50%, transparent 51%),
			radial-gradient(1px 1px at 78% 27%, #fff8 50%, transparent 51%),
			radial-gradient(1.5px 1.5px at 89% 61%, #fff7 50%, transparent 51%),
			radial-gradient(1px 1px at 6% 52%, #fff6 50%, transparent 51%),
			radial-gradient(1px 1px at 53% 38%, #fff4 50%, transparent 51%),
			radial-gradient(ellipse 70% 50% at 50% 110%, rgb(40 70 120 / 0.45), transparent 70%),
			linear-gradient(180deg, #06070a 0%, #0d1016 60%, #151a24 100%);
	}

	:global([data-theme="dark"]) .space::before {
		opacity: 0.06;
	}

	/* MapLibre positions markers with `transform`, so only the inner face scales. */
	.journey-map :global(.journey-node) {
		@apply block cursor-pointer border-0 bg-transparent p-0;
	}

	/* Nodes on the far side of the globe: MapLibre fades them to `opacityWhenCovered` and tags them. */
	.journey-map :global(.journey-node.maplibregl-marker-covered) {
		pointer-events: none;
	}

	.journey-map :global(.journey-node:hover),
	.journey-map :global(.journey-node.active) {
		@apply z-10;
	}

	.journey-map :global(.journey-node-face) {
		@apply block h-10 w-10 overflow-hidden rounded-full border-2 border-card bg-sunken shadow-soft transition-transform;
	}

	.journey-map :global(.journey-node.cluster .journey-node-face) {
		@apply h-11 w-11 rounded-2xl;
	}

	.journey-map :global(.journey-node-count) {
		@apply absolute -right-2 -top-2 min-w-5 rounded-full bg-ink px-1.5 py-0.5 text-center font-mono text-[10px] leading-none text-paper shadow-soft;
	}

	.journey-map :global(.journey-node:hover .journey-node-face) {
		@apply scale-125;
	}

	.journey-map :global(.journey-node.active .journey-node-face) {
		@apply scale-150 border-accent;
	}

	.journey-map :global(.journey-node.no-photo .journey-node-face) {
		@apply bg-sunken;
	}

	.journey-map :global(.journey-node img) {
		@apply m-0 h-full w-full object-cover;
	}

	.dropdown .caret {
		position: absolute;
		left: calc(var(--caret) - 7px);
		bottom: -7px;
		width: 14px;
		height: 14px;
		rotate: 45deg;
		background: var(--color-card);
		border-right: 1px solid var(--color-line);
		border-bottom: 1px solid var(--color-line);
	}

	.dropdown.below .caret {
		top: -7px;
		bottom: auto;
		rotate: 225deg;
	}

	:global(body:has(.day-sheet)) {
		overflow: hidden;
	}

	.journey-map :global(.maplibregl-ctrl-attrib) {
		@apply bg-card/80 font-mono text-[10px];
	}
</style>
