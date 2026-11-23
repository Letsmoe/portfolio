<script lang="ts">
	import { flagEmoji, formatStepDate } from "#lib/journey.ts";
	import { createMapStyle, patternImage, type MapTheme } from "#lib/mapStyle.ts";
	import { cumulativeKm, positionAt, type SectionRoute } from "#lib/route.ts";
	import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";
	import DownloadSimple from "phosphor-svelte/lib/DownloadSimple";
	import { onMount } from "svelte";

	interface Props {
		/** Slug of a section written by `scripts/section-route.ts`. */
		section: string;
		title?: string;
	}

	let { section, title = "Route" }: Props = $props();

	/** Chart margins in px: room for the elevation labels on the left and distance labels below. */
	const CHART = { height: 150, left: 46, right: 12, top: 14, bottom: 34 };

	let container: HTMLDivElement = $state();
	let data: SectionRoute | null = $state(null);
	let active: number | null = $state(null);
	let failure: string | null = $state(null);
	let chartWidth = $state(0);
	/** Kilometre under the pointer on the elevation chart. */
	let hoverKm: number | null = $state(null);
	let map: MapLibreMap | undefined;
	const markers: Marker[] = [];
	let routeKm: number[] = [];

	/** A round tick interval that gives at most `maxTicks` ticks over `range`. */
	function tickStep(range: number, maxTicks: number) {
		const raw = range / Math.max(maxTicks, 1);
		const magnitude = 10 ** Math.floor(Math.log10(raw));
		return [1, 2, 2.5, 5, 10].map((multiple) => multiple * magnitude).find((step) => step >= raw) ?? raw;
	}

	let chart = $derived.by(() => {
		if (!data || chartWidth === 0) return null;
		const total = data.profile[data.profile.length - 1][0];
		const spacing = data.profile[1][0] - data.profile[0][0];
		const highest = Math.max(...data.profile.map(([, metres]) => metres));
		const yStep = tickStep(highest, 4);
		const top = Math.ceil(highest / yStep) * yStep;
		const plotWidth = chartWidth - CHART.left - CHART.right;
		const plotHeight = CHART.height - CHART.top - CHART.bottom;
		const x = (km: number) => CHART.left + (km / total) * plotWidth;
		const y = (metres: number) => CHART.top + plotHeight - (Math.max(metres, 0) / top) * plotHeight;
		const elevationAt = (km: number) => data!.profile[Math.min(data!.profile.length - 1, Math.max(0, Math.round(km / spacing)))][1];
		const line = data.profile.map(([km, metres]) => `${x(km).toFixed(1)},${y(metres).toFixed(1)}`).join(" L");
		const xStep = tickStep(total, Math.floor(plotWidth / 70));
		return {
			total,
			x,
			y,
			elevationAt,
			baseline: y(0),
			line: `M${line}`,
			area: `M${x(0)},${y(0)} L${line} L${x(total)},${y(0)} Z`,
			yTicks: Array.from({ length: Math.round(top / yStep) + 1 }, (_, index) => index * yStep),
			xTicks: Array.from({ length: Math.floor(total / xStep) + 1 }, (_, index) => index * xStep),
		};
	});

	let hoverPoint = $derived(chart && hoverKm !== null ? { km: hoverKm, metres: chart.elevationAt(hoverKm), x: chart.x(hoverKm) } : null);

	function onChartPointer(event: PointerEvent) {
		if (!chart) return;
		const bounds = (event.currentTarget as SVGElement).getBoundingClientRect();
		const fraction = (event.clientX - bounds.left - CHART.left) / (bounds.width - CHART.left - CHART.right);
		hoverKm = Math.min(Math.max(fraction, 0), 1) * chart.total;
	}

	$effect(() => {
		const source = map?.getSource("cursor") as GeoJSONSource | undefined;
		if (!data || !source) return;
		const features =
			hoverKm === null ? [] : [{ type: "Feature" as const, properties: {}, geometry: { type: "Point" as const, coordinates: positionAt(data.route, routeKm, hoverKm) } }];
		source.setData({ type: "FeatureCollection", features });
	});

	$effect(() => {
		markers.forEach((marker, index) => marker.getElement().classList.toggle("active", index === active));
	});

	function currentTheme(): MapTheme {
		return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
	}

	function addRouteLayers(map: MapLibreMap, route: SectionRoute) {
		const styles = getComputedStyle(document.documentElement);
		map.addSource("section", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.route } } });
		map.addLayer({
			id: "section-halo",
			type: "line",
			source: "section",
			layout: { "line-cap": "round", "line-join": "round" },
			paint: { "line-color": styles.getPropertyValue("--color-card").trim(), "line-width": 7 },
		});
		map.addLayer({
			id: "section",
			type: "line",
			source: "section",
			layout: { "line-cap": "round", "line-join": "round" },
			paint: { "line-color": styles.getPropertyValue("--color-accent").trim(), "line-width": 3.5 },
		});
		map.addSource("cursor", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
		map.addLayer({
			id: "cursor",
			type: "circle",
			source: "cursor",
			paint: {
				"circle-radius": 6,
				"circle-color": styles.getPropertyValue("--color-ink").trim(),
				"circle-stroke-color": styles.getPropertyValue("--color-card").trim(),
				"circle-stroke-width": 2,
			},
		});
	}

	function focus(index: number) {
		active = index;
		const stop = data?.stops[index];
		if (stop) map?.flyTo({ center: [stop.lon, stop.lat], zoom: Math.max(map.getZoom(), 9), essential: true });
	}

	onMount(() => {
		let disposed = false;
		let themeObserver: MutationObserver | undefined;

		const start = async () => {
			const [response, maplibre, { default: workerUrl }] = await Promise.all([
				fetch(`/journey/sections/${section}.json`),
				import("maplibre-gl"),
				import("maplibre-gl/dist/maplibre-gl-worker.mjs?url"),
				import("maplibre-gl/dist/maplibre-gl.css"),
			]);
			if (!response.ok) throw new Error(`No route for section "${section}" (HTTP ${response.status})`);
			const route: SectionRoute = await response.json();
			if (disposed) return;
			routeKm = cumulativeKm(route.route);
			data = route;
			// See JourneyMap: Vite neither follows nor copies MapLibre's worker, so it gets the bundled URL.
			maplibre.setWorkerUrl(workerUrl);

			const bounds = route.route.reduce((box, position) => box.extend(position), new maplibre.LngLatBounds(route.route[0], route.route[0]));
			map = new maplibre.Map({
				container,
				style: createMapStyle(currentTheme()),
				bounds,
				fitBoundsOptions: { padding: 40 },
				attributionControl: { compact: true },
				// Inside an article the page has to keep scrolling, so zooming needs ctrl/⌘ + scroll.
				cooperativeGestures: true,
				dragRotate: false,
				pitchWithRotate: false,
			});
			map.touchZoomRotate.disableRotation();
			map.setMissingStyleImageResolver((id) => {
				const image = patternImage(id, currentTheme());
				if (image && map && !map.hasImage(id)) map.addImage(id, image);
			});
			map.on("style.load", () => map && addRouteLayers(map, route));
			map.on("error", ({ error }) => (failure = error?.message ?? String(error)));

			route.stops.forEach((stop, index) => {
				const element = document.createElement("button");
				element.className = "section-stop";
				const face = document.createElement("span");
				face.className = "section-stop-face";
				face.textContent = String(index + 1);
				element.append(face);
				element.setAttribute("aria-label", `${index + 1}. ${stop.name}`);
				element.addEventListener("click", () => focus(index));
				markers.push(new maplibre.Marker({ element }).setLngLat([stop.lon, stop.lat]).addTo(map!));
			});

			themeObserver = new MutationObserver(() => map?.setStyle(createMapStyle(currentTheme())));
			themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
		};
		start().catch((error) => (failure = error instanceof Error ? error.message : String(error)));

		return () => {
			disposed = true;
			themeObserver?.disconnect();
			map?.remove();
		};
	});
</script>

<div class="section-route not-prose">
	<figure class="route-card m-0">
		<header class="route-header">
			<p class="route-title">{title}</p>
			{#if data}
				<p class="route-stats">
					<a href="/journey/sections/{section}.gpx" download class="route-download"><DownloadSimple size={14} weight="bold" /> Download GPX</a>
					<span>{data.kilometres.toLocaleString("en-US")} km</span>
					<span>+{data.ascent.toLocaleString("en-US")} m / −{data.descent.toLocaleString("en-US")} m</span>
					<span>{data.stops.length} stops</span>
				</p>
			{/if}
		</header>

		<div class="map-frame">
			<div class="map-canvas" bind:this={container}></div>
			{#if failure}
				<p class="map-error">Map error: {failure}</p>
			{/if}
		</div>

		<div class="chart" bind:clientWidth={chartWidth}>
			{#if data && chart}
				<svg
					width={chartWidth}
					height={CHART.height}
					role="img"
					aria-label="Elevation profile over {data.kilometres} km with {data.ascent} m of climbing"
					onpointermove={onChartPointer}
					onpointerdown={onChartPointer}
					onpointerleave={() => (hoverKm = null)}
				>
					<defs>
						<!-- Vertical hatching, like the elevation charts on bikepacking.com. -->
						<pattern id="stripes-{section}" width="4" height="4" patternUnits="userSpaceOnUse">
							<rect width="2.2" height="4" class="chart-stripe" />
						</pattern>
					</defs>

					{#each chart.yTicks as metres}
						<line x1={CHART.left} x2={chartWidth - CHART.right} y1={chart.y(metres)} y2={chart.y(metres)} class="chart-grid" />
						<text x={CHART.left - 6} y={chart.y(metres)} class="chart-label" text-anchor="end" dominant-baseline="middle">
							{metres >= 1000 ? `${metres / 1000}k` : metres}
						</text>
					{/each}
					{#each chart.xTicks as km}
						<line x1={chart.x(km)} x2={chart.x(km)} y1={chart.baseline} y2={chart.baseline + 4} class="chart-axis" />
						<text x={chart.x(km)} y={chart.baseline + 15} class="chart-label" text-anchor="middle">{km}</text>
					{/each}
					<text x={4} y={CHART.height - 4} class="chart-label">ele (m)</text>
					<text x={CHART.left + (chartWidth - CHART.left - CHART.right) / 2} y={CHART.height - 4} class="chart-label" text-anchor="middle">distance in km</text>

					<path d={chart.area} fill="url(#stripes-{section})" class="chart-area" />
					<path d={chart.line} class="chart-line" />
					<line x1={CHART.left} x2={CHART.left} y1={CHART.top} y2={chart.baseline} class="chart-axis" />
					<line x1={CHART.left} x2={chartWidth - CHART.right} y1={chart.baseline} y2={chart.baseline} class="chart-axis" />

					{#each data.stops as stop, index (stop.slug)}
						<g class="chart-stop" class:active={active === index} transform="translate({chart.x(stop.kilometres)} {chart.y(chart.elevationAt(stop.kilometres))})">
							<circle r="7" />
							<text text-anchor="middle" dominant-baseline="central">{index + 1}</text>
						</g>
					{/each}

					{#if hoverPoint}
						<line x1={hoverPoint.x} x2={hoverPoint.x} y1={CHART.top} y2={chart.baseline} class="chart-cursor" />
						<text
							x={hoverPoint.x}
							y={CHART.top - 3}
							class="chart-readout"
							text-anchor={hoverPoint.x > chartWidth - 90 ? "end" : hoverPoint.x < CHART.left + 90 ? "start" : "middle"}
						>
							{Math.round(hoverPoint.km)} km · {hoverPoint.metres.toLocaleString("en-US")} m
						</text>
					{/if}
				</svg>
			{/if}
		</div>
	</figure>

	{#if data}
		<ol class="stop-list">
			{#each data.stops as stop, index (stop.slug)}
				<li>
					<div
						class="stop-row"
						class:active={active === index}
						role="button"
						tabindex="0"
						onmouseenter={() => (active = index)}
						onclick={() => focus(index)}
						onkeydown={(event) => (event.key === "Enter" || event.key === " ") && focus(index)}
					>
						<span class="stop-number">{index + 1}</span>
						{#if stop.micro}
							<img src={stop.micro} alt="" width="40" height="40" loading="lazy" class="stop-photo" />
						{/if}
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">{flagEmoji(stop.countryCode)} {stop.name}</span>
							<span class="block font-mono text-[11px] uppercase tracking-wider text-muted">
								{formatStepDate(stop)} · {index === 0 ? "start" : `+${stop.kilometres - data.stops[index - 1].kilometres} km`}
							</span>
						</span>
						<a href="/journey/{stop.slug}" class="shrink-0 p-1 text-muted no-underline hover:text-accent" aria-label="Open {stop.name} on the journey map">
							<ArrowRight size={16} />
						</a>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<!-- Layout lives in plain CSS: posts style every <img> more strongly than Tailwind's utilities, and a dev
     server may not have generated the arbitrary sizes yet. -->
<style>
	.section-route {
		margin: 3rem 0;
	}

	.route-card {
		overflow: hidden;
		border: 1px solid var(--color-line);
		border-radius: 0.75rem;
		background: var(--color-card);
	}

	.route-header {
		padding: 0.75rem 1.25rem;
	}

	.route-title {
		margin: 0;
		font-size: 1.35rem;
		line-height: 1.3;
	}

	.route-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem 1.5rem;
		margin: 0.25rem 0 0;
		font-size: 0.95rem;
		color: var(--color-muted);
	}

	.route-download {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-weight: 600;
		color: var(--color-ink);
		text-decoration: none;
	}

	.route-download:hover {
		color: var(--color-accent);
	}

	.map-frame {
		position: relative;
		height: 26rem;
		border-block: 1px solid var(--color-line);
		background: var(--color-sunken);
	}

	@media (min-width: 640px) {
		.map-frame {
			height: 34rem;
		}
	}

	.map-canvas {
		width: 100%;
		height: 100%;
	}

	.map-error {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		margin: 0;
		padding: 0.5rem 0.75rem;
		border-radius: 0.75rem;
		background: var(--color-card);
		color: var(--color-accent);
		font: 0.75rem var(--font-mono, monospace);
	}

	.chart {
		height: 150px;
		padding-bottom: 0.25rem;
		touch-action: none;
		user-select: none;
	}

	.chart svg {
		display: block;
		cursor: crosshair;
	}

	.chart-stripe {
		fill: var(--color-accent);
		opacity: 0.55;
	}

	.chart-area {
		stroke: none;
	}

	.chart-line {
		fill: none;
		stroke: var(--color-accent);
		stroke-width: 1.75;
		stroke-linejoin: round;
	}

	.chart-grid {
		stroke: var(--color-line);
		stroke-dasharray: 2 3;
	}

	.chart-axis {
		stroke: var(--color-ink);
	}

	.chart-label {
		fill: var(--color-muted);
		font: 10px var(--font-mono, monospace);
	}

	.chart-stop circle {
		fill: var(--color-ink);
		stroke: var(--color-card);
		stroke-width: 1.5;
	}

	.chart-stop text {
		fill: var(--color-paper);
		font: 600 8px var(--font-mono, monospace);
	}

	.chart-stop.active circle {
		fill: var(--color-accent);
	}

	.chart-cursor {
		stroke: var(--color-ink);
	}

	.chart-readout {
		fill: var(--color-ink);
		font: 600 11px var(--font-mono, monospace);
	}

	.stop-list {
		display: grid;
		gap: 0 1.5rem;
		margin: 1rem 0 0;
		padding: 0;
		list-style: none;
	}

	@media (min-width: 640px) {
		.stop-list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.stop-list li {
		margin: 0;
		border-top: 1px solid var(--color-line);
	}

	.stop-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0;
		cursor: pointer;
	}

	.stop-row.active {
		color: var(--color-accent);
	}

	.stop-number {
		display: flex;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		align-items: center;
		justify-content: center;
		border: 1px solid currentColor;
		border-radius: 9999px;
		font: 0.75rem var(--font-mono, monospace);
	}

	.section-route .stop-photo {
		flex-shrink: 0;
		width: 2.5rem;
		height: 2.5rem;
		max-height: none;
		margin: 0;
		border-radius: 0.5rem;
		object-fit: cover;
		cursor: pointer;
	}

	/* MapLibre positions the marker element itself through `transform`, so only its inner face is
	   styled and animated; touching the outer element's transform or scale would move the marker. */
	.section-route :global(.section-stop) {
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.section-route :global(.section-stop-face) {
		display: flex;
		width: 1.75rem;
		height: 1.75rem;
		align-items: center;
		justify-content: center;
		border: 2px solid var(--color-card);
		border-radius: 9999px;
		background: var(--color-ink);
		color: var(--color-paper);
		font: 600 0.75rem/1 var(--font-mono, monospace);
		box-shadow: var(--shadow-soft);
		transition:
			scale 0.15s ease,
			background-color 0.15s ease;
	}

	.section-route :global(.section-stop:hover .section-stop-face),
	.section-route :global(.section-stop.active .section-stop-face) {
		background: var(--color-accent);
		scale: 1.15;
	}
</style>
