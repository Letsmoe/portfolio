import { climb, distanceKm, type Position } from "#lib/route.ts";
import { TRANSPORTS, type Leg, type Transport } from "#lib/routeCleanup.ts";
import type { RouteStats } from "#lib/routeStats.ts";
import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification, GeoJSONSource, MapMouseEvent } from "maplibre-gl";

interface Status {
	snapped: number;
	total: number;
	requests: number;
	lastError: string | null;
	issues: { index: number; reason: string }[];
}

type SelectedLeg = Leg & { index: number; roadKm: number | null; geometry: Position[] };

/** Below this zoom the editor only shows a light overview; legs and fixes load for the viewport above it. */
const EDIT_ZOOM = 7;

/** The routing worker is a separate file the bundler does not follow; the server hands it out. */
maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const map = new maplibregl.Map({
	container: "map",
	center: [30, 40],
	zoom: 3,
	style: {
		version: 8,
		// The same fonts as the site's map, for the date labels on the fixes.
		glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
		sources: {
			osm: {
				type: "raster",
				tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
				tileSize: 256,
				maxzoom: 19,
				attribution: "© OpenStreetMap contributors",
			},
			satellite: {
				type: "raster",
				tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
				tileSize: 256,
				maxzoom: 19,
				attribution: "Imagery © Esri",
			},
		},
		layers: [
			{ id: "osm", type: "raster", source: "osm" },
			{ id: "satellite", type: "raster", source: "satellite", layout: { visibility: "none" } },
		],
	},
});

/** A leg as the viewport's line features describe it. */
type LegRef = Pick<Leg, "key" | "transport" | "mode" | "router" | "edited"> & { index: number };

/** Every selected leg in route order; `selected` holds the details when there is exactly one. */
let selection: LegRef[] = [];
let selected: SelectedLeg | null = null;
/** The legs last loaded for the viewport; the map's own copy lags behind `setData`. */
let viewportLegs: LegRef[] = [];
let status: Status | null = null;
let issueCursor = -1;
let snappedAtLastRefresh = 0;
let viewportRequest: AbortController | undefined;
let viaMarkers: maplibregl.Marker[] = [];

/** How legs are coloured: by transport, or earliest to latest of what is on screen. */
let colourBy: "transport" | "time" = "transport";
let timeRange: [number, number] = [0, 1];
/** Zoomed out, the time colours span the whole trip. */
let overviewRange: [number, number] = [0, 1];

const TRANSPORT_LABELS: Record<Transport, string> = { bike: "Bicycle", foot: "Foot", bus: "Bus", car: "Car", boat: "Boat", flight: "Plane" };
/** Saturated and on a white casing; picked to stay apart from each other and from forest, water and roads. */
const TRANSPORT_COLOURS: Record<Transport, string> = { bike: "#d6336c", foot: "#e8590c", bus: "#1971c2", car: "#7048e8", boat: "#15aabf", flight: "#343a40" };
const ROUTER_LABELS: Record<Leg["router"], string> = { car: "Car", bike: "Bike", foot: "Foot" };
const MODE_LABELS: Record<Leg["mode"], string> = { ride: "Ride", straight: "Straight", hop: "Hop" };

const empty: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const legLayers = ["legs-snapped", "legs-failed", "legs-pending", "legs-straight", "legs-hop"];
const NO_LEGS: ExpressionSpecification = ["==", ["get", "index"], -1];

map.on("load", async () => {
	map.addSource("overview", { type: "geojson", data: empty });
	map.addSource("legs", { type: "geojson", data: empty });
	map.addSource("fixes", { type: "geojson", data: empty });

	map.addLayer({ id: "overview-casing", type: "line", source: "overview", maxzoom: EDIT_ZOOM, filter: ["!", ["get", "hop"]], paint: { "line-color": "#ffffff", "line-width": 5 } });
	map.addLayer({ id: "overview", type: "line", source: "overview", maxzoom: EDIT_ZOOM, filter: ["!", ["get", "hop"]], paint: { "line-color": legColour(overviewRange), "line-width": 2.5 } });
	map.addLayer({
		id: "overview-hops",
		type: "line",
		source: "overview",
		maxzoom: EDIT_ZOOM,
		filter: ["get", "hop"],
		paint: { "line-color": legColour(overviewRange), "line-width": 1.5, "line-dasharray": [3, 3], "line-opacity": 0.8 },
	});
	// Every line sits a little to the right of its direction of travel, so riding a road there and back draws
	// two lines side by side instead of one on top of the other.
	const lineOffset: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], EDIT_ZOOM, 0, 11, 3.5, 15, 5];
	// Wider than the map's main roads, on a white casing so the colours hold up on forest, water and satellite.
	const lineWidth: ExpressionSpecification = ["interpolate", ["linear"], ["zoom"], EDIT_ZOOM, 3, 14, 6];
	map.addLayer({
		id: "legs-casing",
		type: "line",
		source: "legs",
		minzoom: EDIT_ZOOM,
		layout: { "line-cap": "round", "line-join": "round" },
		paint: {
			// Where no road was found the casing turns red, whatever the colour of the line inside.
			"line-color": ["case", ["==", ["get", "state"], "failed"], "#e03131", "#ffffff"],
			"line-width": ["interpolate", ["linear"], ["zoom"], EDIT_ZOOM, 5.5, 14, 9.5],
			"line-offset": lineOffset,
		},
	});
	// The colour says how the leg was travelled, the line style how it is drawn.
	const legPaint = (dash?: number[]) => ({ "line-color": legColour(), "line-width": lineWidth, "line-offset": lineOffset, ...(dash ? { "line-dasharray": dash } : {}) });
	map.addLayer({ id: "legs-snapped", type: "line", source: "legs", minzoom: EDIT_ZOOM, filter: ["==", ["get", "state"], "snapped"], paint: legPaint() });
	map.addLayer({ id: "legs-failed", type: "line", source: "legs", minzoom: EDIT_ZOOM, filter: ["==", ["get", "state"], "failed"], paint: legPaint() });
	map.addLayer({ id: "legs-pending", type: "line", source: "legs", minzoom: EDIT_ZOOM, filter: ["==", ["get", "state"], "pending"], paint: { ...legPaint([2, 2]), "line-color": "#8a8a8a" } });
	map.addLayer({ id: "legs-straight", type: "line", source: "legs", minzoom: EDIT_ZOOM, filter: ["==", ["get", "state"], "straight"], paint: legPaint([1, 1.5]) });
	map.addLayer({ id: "legs-hop", type: "line", source: "legs", minzoom: EDIT_ZOOM, filter: ["==", ["get", "state"], "hop"], paint: legPaint([3, 3]) });
	// Selected legs are lifted above the rest: a soft shadow below them, an ink-edged yellow band, and the leg's
	// own colour on top, so it stays clear what was selected.
	const wider = (extra: number): ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], EDIT_ZOOM, 3 + extra, 14, 6 + extra * 1.5];
	const round = { "line-cap": "round", "line-join": "round" } as const;
	map.addLayer({
		id: "selection-shadow",
		type: "line",
		source: "legs",
		filter: NO_LEGS,
		layout: round,
		paint: { "line-color": "#000000", "line-opacity": 0.35, "line-blur": 6, "line-width": wider(12), "line-offset": lineOffset, "line-translate": [0, 3] },
	});
	map.addLayer({ id: "selection-edge", type: "line", source: "legs", filter: NO_LEGS, layout: round, paint: { "line-color": "#1c1a1b", "line-width": wider(8), "line-offset": lineOffset } });
	map.addLayer({ id: "selection-line", type: "line", source: "legs", filter: NO_LEGS, layout: round, paint: { "line-color": "#ffd400", "line-width": wider(5), "line-offset": lineOffset } });
	map.addLayer({ id: "selection-core", type: "line", source: "legs", filter: NO_LEGS, layout: round, paint: { "line-color": legColour(), "line-width": lineWidth, "line-offset": lineOffset } });
	map.addImage("arrow", arrowImage(), { pixelRatio: 2 });
	map.addLayer({
		id: "legs-direction",
		type: "symbol",
		source: "legs",
		minzoom: 9,
		layout: { "symbol-placement": "line", "symbol-spacing": 90, "icon-image": "arrow", "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true },
	});
	map.addLayer({
		id: "fixes-dropped",
		type: "circle",
		source: "fixes",
		minzoom: 10,
		filter: ["!=", ["get", "status"], "kept"],
		paint: {
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3.5, 15, 5],
			"circle-color": ["match", ["get", "status"], "removed", "#e5484d", "#ffffff"],
			"circle-stroke-width": 2,
			"circle-stroke-color": ["match", ["get", "status"], "spike", "#e08a00", "excursion", "#8e44ad", "stay", "#3f7f78", "removed", "#ffffff", "#9a9a9a"],
		},
	});
	// Solid and ringed in white so the fixes the route runs through stand out on the lines and on the map.
	map.addLayer({
		id: "fixes-kept",
		type: "circle",
		source: "fixes",
		minzoom: 10,
		filter: ["==", ["get", "status"], "kept"],
		paint: {
			"circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 4, 15, 6.5],
			"circle-color": "#1c1a1b",
			"circle-stroke-width": 2.5,
			// Fixes added in the editor ring yellow: those can be dragged.
			"circle-stroke-color": ["case", ["get", "added"], "#ffd400", "#ffffff"],
		},
	});
	// The first fix of every day carries its date; closer in, every kept fix its time. Labels that would
	// collide are left out, so busy stretches thin out on their own.
	const labelPaint = { "text-color": "#1c1a1b", "text-halo-color": "#ffffff", "text-halo-width": 2 };
	map.addLayer({
		id: "fix-days",
		type: "symbol",
		source: "fixes",
		minzoom: 10,
		filter: ["all", ["==", ["get", "status"], "kept"], ["get", "dayStart"]],
		layout: { "text-field": ["concat", ["get", "date"], " · ", ["get", "time"]], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-anchor": "bottom", "text-offset": [0, -0.9] },
		paint: labelPaint,
	});
	map.addLayer({
		id: "fix-times",
		type: "symbol",
		source: "fixes",
		minzoom: 13,
		filter: ["all", ["==", ["get", "status"], "kept"], ["!", ["get", "dayStart"]], ["!=", ["get", "time"], ""]],
		layout: { "text-field": ["get", "time"], "text-font": ["Noto Sans Regular"], "text-size": 10.5, "text-anchor": "bottom", "text-offset": [0, -0.8] },
		paint: { ...labelPaint, "text-color": "#6f6863" },
	});

	const fixPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "fix-popup" });
	for (const layer of ["fixes-dropped", "fixes-kept"]) {
		map.on("mousemove", layer, (event) => {
			const full = event.features?.[0]?.properties.full as string | undefined;
			if (full) fixPopup.setLngLat(event.lngLat).setText(full).addTo(map);
		});
		map.on("mouseleave", layer, () => fixPopup.remove());
	}
	for (const layer of ["fixes-dropped", "fixes-kept", ...legLayers]) {
		map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
		map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
	}
	map.on("mouseenter", "selection-line", () => (map.getCanvas().style.cursor = "grab"));
	map.on("mouseleave", "selection-line", () => (map.getCanvas().style.cursor = ""));
	map.on("mousedown", "selection-line", startRouteDrag);
	map.on("moveend", loadViewport);

	await Promise.all([loadOverview(), loadViewport(), pollStatus()]);
	setInterval(pollStatus, 5000);
});

/**
 * By transport, or by time: earliest leg on screen violet, latest pink, with no blues or greens, which vanish
 * into water and forest. The time scale stretches over what is in view rather than the whole trip, so two
 * passes through the same town weeks apart still come out in clearly different colours.
 */
function legColour(range = timeRange): ExpressionSpecification {
	if (colourBy === "transport") {
		const { bike, foot, bus, car, boat, flight } = TRANSPORT_COLOURS;
		return ["match", ["get", "transport"], "bike", bike, "foot", foot, "bus", bus, "car", car, "boat", boat, "flight", flight, "#1c1a1b"];
	}
	const [firstIndex, lastIndex] = range;
	const span = Math.max(lastIndex - firstIndex, 1);
	const at = (fraction: number) => firstIndex + span * fraction;
	return ["interpolate", ["linear"], ["get", "index"], at(0), "#3a0ca3", at(0.5), "#b5179e", at(1), "#ff2a6d"];
}

function paintLegs() {
	for (const layer of ["legs-snapped", "legs-failed", "legs-straight", "legs-hop", "selection-core"]) map.setPaintProperty(layer, "line-color", legColour());
	for (const layer of ["overview", "overview-hops"]) map.setPaintProperty(layer, "line-color", legColour(overviewRange));
}

/** A chevron pointing along the line (+x), dark on a white halo so it reads on any colour and on satellite. */
function arrowImage(): ImageData {
	const size = 28;
	const context = document.createElement("canvas").getContext("2d")!;
	context.canvas.width = context.canvas.height = size;
	context.lineCap = context.lineJoin = "round";
	const chevron = () => {
		context.beginPath();
		context.moveTo(10, 7);
		context.lineTo(18, 14);
		context.lineTo(10, 21);
		context.stroke();
	};
	context.strokeStyle = "#ffffff";
	context.lineWidth = 7;
	chevron();
	context.strokeStyle = "#1c1a1b";
	context.lineWidth = 3;
	chevron();
	return context.getImageData(0, 0, size, size);
}

async function loadOverview() {
	const overview = (await fetch("/api/overview").then((response) => response.json())) as GeoJSON.FeatureCollection<GeoJSON.LineString, { index: number }>;
	(map.getSource("overview") as GeoJSONSource).setData(overview);
	overviewRange = [0, overview.features.at(-1)?.properties.index ?? 1];
	if (colourBy === "time") paintLegs();
}

/** Legs and fixes for what is on screen; editing only happens zoomed in, so this stays small. */
async function loadViewport() {
	viewportRequest?.abort();
	if (map.getZoom() < EDIT_ZOOM) {
		(map.getSource("legs") as GeoJSONSource).setData(empty);
		(map.getSource("fixes") as GeoJSONSource).setData(empty);
		return;
	}
	viewportRequest = new AbortController();
	const bounds = map.getBounds();
	const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].map((value) => value.toFixed(4)).join(",");
	try {
		const [legs, fixes] = await Promise.all([
			fetch(`/api/legs?bbox=${bbox}`, { signal: viewportRequest.signal }).then((response) => response.json()),
			map.getZoom() >= 10 ? fetch(`/api/fixes?bbox=${bbox}`, { signal: viewportRequest.signal }).then((response) => response.json()) : empty,
		]);
		(map.getSource("legs") as GeoJSONSource).setData(legs);
		(map.getSource("fixes") as GeoJSONSource).setData(fixes);
		viewportLegs = legs.features.map((feature: { properties: LegRef }) => feature.properties);
		// Flights and other hops crossing the view would stretch the scale over half the trip; only roads count.
		const indices: number[] = legs.features
			.filter((feature: { properties: { state: string } }) => feature.properties.state === "snapped")
			.map((feature: { properties: { index: number } }) => feature.properties.index);
		if (indices.length > 0) timeRange = [Math.min(...indices), Math.max(...indices)];
		if (colourBy === "time") paintLegs();
	} catch (error) {
		if ((error as Error).name !== "AbortError") throw error;
	}
}

/** Picks the selection up again after an edit, by key, since dropping or restoring fixes renumbers the legs. */
async function refresh() {
	await Promise.all([loadViewport(), pollStatus()]);
	const keys = new Set(selection.map((leg) => leg.key));
	if (keys.size > 0) await selectMany(viewportLegs.filter((leg) => keys.has(leg.key)));
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function createElement(tag: string, className: string, text = ""): HTMLElement {
	const created = document.createElement(tag);
	created.className = className;
	created.textContent = text;
	return created;
}

/**
 * The stats are rebuilt a few seconds after each edit, so they are re-read with every status poll. The
 * transport rows double as the legend for the line colours.
 */
async function loadTotals() {
	const stats = (await fetch("/api/stats").then((response) => response.json())) as RouteStats | null;
	if (!stats) return;
	const km = (value: number) => `${Math.round(value).toLocaleString()} km`;
	const metrics: [string, string][] = [
		[km(stats.totalKm), "Total"],
		[km(stats.withoutFlightsKm), "Without Flights"],
		[`${stats.ascent.toLocaleString()} m`, `Climbed${stats.highest === null ? "" : ` · Top ${stats.highest.toLocaleString()} m`}`],
	];
	element("metrics").replaceChildren(
		...metrics.map(([value, label]) => {
			const metric = createElement("div", "metric");
			metric.append(createElement("strong", "", value), createElement("span", "", label));
			return metric;
		}),
	);
	const longest = Math.max(...TRANSPORTS.map((transport) => stats.km[transport]), 1);
	element("transport-totals").replaceChildren(
		...TRANSPORTS.map((transport) => {
			const row = createElement("li", "");
			const chip = createElement("span", "chip");
			chip.style.background = TRANSPORT_COLOURS[transport];
			const bar = createElement("span", "bar");
			const fill = createElement("span", "");
			Object.assign(fill.style, { width: `${(stats.km[transport] / longest) * 100}%`, background: TRANSPORT_COLOURS[transport] });
			bar.append(fill);
			row.append(chip, createElement("span", "", TRANSPORT_LABELS[transport]), bar, createElement("span", "value", km(stats.km[transport])));
			return row;
		}),
	);
}

async function pollStatus() {
	loadTotals();
	status = (await fetch("/api/status").then((response) => response.json())) as Status;
	const percent = status.total ? Math.floor((status.snapped / status.total) * 100) : 100;
	element("status").textContent = `${status.snapped.toLocaleString()} / ${status.total.toLocaleString()} legs snapped (${percent}%) · ${status.requests} requests${status.lastError ? ` · retrying: ${status.lastError}` : ""}`;
	const current = issueCursor >= 0 ? status.issues[issueCursor] : undefined;
	let issueText = "Nothing to review.";
	if (current) issueText = `${issueCursor + 1} of ${status.issues.length}: ${capitalize(current.reason)}`;
	else if (status.issues.length > 0) issueText = `${status.issues.length.toLocaleString()} legs to look at`;
	element("issue").textContent = issueText;
	if (status.snapped - snappedAtLastRefresh >= 500) {
		snappedAtLastRefresh = status.snapped;
		await Promise.all([loadOverview(), loadViewport()]);
	}
}

async function select(index: number, fly = false) {
	const response = await fetch(`/api/leg/${index}`);
	if (!response.ok) return deselect();
	const leg: SelectedLeg = { ...(await response.json()), index };
	selected = leg;
	selection = [leg];
	highlight();
	showViaMarkers(leg);
	element("leg").hidden = false;
	element("leg-title").textContent = "Selected Leg";
	element("clear-via").hidden = false;
	element("join-legs").hidden = true;
	element("delete-legs").textContent = "Delete Leg";
	element<HTMLButtonElement>("clear-via").disabled = leg.via.length === 0;
	const facts = [TRANSPORT_LABELS[leg.transport], leg.mode === "ride" ? `${MODE_LABELS.ride} · ${ROUTER_LABELS[leg.router]} Router` : MODE_LABELS[leg.mode], `${leg.straightKm.toFixed(1)} km Straight`];
	if (leg.roadKm !== null) facts.push(`${leg.roadKm.toFixed(1)} km Routed`);
	if (leg.via.length > 0) facts.push(`${leg.via.length} Via Point${leg.via.length === 1 ? "" : "s"}`);
	showFacts(facts, leg.edited);
	markChoices();
	loadSelectionDetails();
	if (fly) {
		const bounds = leg.geometry.reduce((box, point) => box.extend(point), new maplibregl.LngLatBounds(leg.from, leg.from));
		map.fitBounds(bounds, { padding: { top: 80, bottom: 80, left: 380, right: 80 }, maxZoom: 15 });
	}
}

/** Several legs at once; a single one gets the full single-leg panel. */
async function selectMany(legs: LegRef[]) {
	const byIndex = new Map(legs.map((leg) => [leg.index, leg]));
	if (byIndex.size === 0) return deselect();
	if (byIndex.size === 1) return select([...byIndex.keys()][0]);
	selection = [...byIndex.values()].sort((a, b) => a.index - b.index);
	selected = null;
	const [first, last] = [selection[0].index, selection.at(-1)!.index];
	highlight();
	showViaMarkers(null);
	element("leg").hidden = false;
	element("leg-title").textContent = `${selection.length} Legs Selected`;
	element("clear-via").hidden = true;
	element("join-legs").hidden = false;
	element("delete-legs").textContent = `Delete ${selection.length} Legs`;
	const transports = [...new Set(selection.map((leg) => TRANSPORT_LABELS[leg.transport]))];
	showFacts([...transports, `Join Drops ${last - first} Fixes`], false);
	markChoices();
	loadSelectionDetails();
}

function showFacts(facts: string[], yours: boolean) {
	const chips = facts.map((fact) => createElement("span", "", fact));
	if (yours) chips.push(createElement("span", "yours", "Set by You"));
	element("leg-facts").replaceChildren(...chips);
}

let selectionRequest = 0;

/**
 * When the selection was travelled and its elevation, drawn as an area; later selections win over slower
 * earlier answers. The dates line is cleared at once so it never shows the previous selection's.
 */
async function loadSelectionDetails() {
	const request = ++selectionRequest;
	element("leg-when").hidden = true;
	const keys = selection.map((leg) => leg.key);
	const response = await fetch("/api/selection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keys }) });
	if (request !== selectionRequest || !response.ok) return;
	const profile = (await response.json()) as { dates: { when: string; duration: string } | null; km: number[]; elevations: number[] };
	element("leg-when").hidden = !profile.dates;
	element("leg-when-range").textContent = profile.dates?.when ?? "";
	element("leg-when-duration").textContent = profile.dates?.duration ?? "";
	element("profile").hidden = profile.km.length < 2;
	if (profile.km.length < 2) return;
	const [width, height] = [280, 72];
	const totalKm = profile.km.at(-1)!;
	const low = Math.min(...profile.elevations);
	const high = Math.max(...profile.elevations);
	const span = Math.max(high - low, 50);
	const points = profile.km.map((km, index) => `${((km / totalKm) * width).toFixed(1)},${(height - 4 - ((profile.elevations[index] - low) / span) * (height - 10)).toFixed(1)}`);
	element("profile-chart").innerHTML =
		`<polygon points="0,${height} ${points.join(" ")} ${width},${height}" fill="rgb(28 26 27 / 0.12)"/>` +
		`<polyline points="${points.join(" ")}" fill="none" stroke="#1c1a1b" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`;
	const { ascent, descent } = climb(profile.elevations);
	element("profile-caption").textContent = `${totalKm.toFixed(1)} km · ↑ ${ascent.toLocaleString()} m ↓ ${descent.toLocaleString()} m · ${low.toLocaleString()}–${high.toLocaleString()} m`;
}

/**
 * Highlights the transport and drawing the selected legs share: Auto when none was set by hand, nothing when
 * they differ.
 */
function markChoices() {
	const shared = (value: (leg: LegRef) => string) => {
		const values = new Set(selection.map((leg) => (leg.edited ? value(leg) : "")));
		return values.size === 1 ? [...values][0] : null;
	};
	const mode = shared((leg) => leg.mode);
	const transport = shared((leg) => leg.transport);
	const router = shared((leg) => leg.router);
	for (const button of element("modes").querySelectorAll("button")) button.classList.toggle("active", button.dataset.mode === mode);
	for (const button of element("transports").querySelectorAll("button")) button.classList.toggle("active", button.dataset.transport === transport);
	for (const button of element("routers").querySelectorAll("button")) button.classList.toggle("active", button.dataset.router === router);
}

function deselect() {
	selected = null;
	selection = [];
	highlight();
	showViaMarkers(null);
	element("leg").hidden = true;
	selectionRequest++;
}

/** Points the selection layers at the selected legs; they read the viewport's legs, so they follow every reload. */
function highlight() {
	const filter: ExpressionSpecification = selection.length === 0 ? NO_LEGS : ["in", ["get", "index"], ["literal", selection.map((leg) => leg.index)]];
	for (const layer of ["selection-shadow", "selection-edge", "selection-line", "selection-core"]) map.setFilter(layer, filter);
}

async function setVia(via: Position[]) {
	if (!selected) return;
	await post("/api/edit/leg", { key: selected.key, via });
}

/** Via points are draggable; right-click removes one. */
function showViaMarkers(leg: SelectedLeg | null) {
	for (const marker of viaMarkers) marker.remove();
	viaMarkers = (leg?.via ?? []).map((position, index) => {
		const dot = document.createElement("div");
		dot.className = "via";
		dot.title = "Drag to move · right-click to remove";
		dot.addEventListener("contextmenu", (event) => {
			event.preventDefault();
			setVia(leg!.via.filter((_, other) => other !== index));
		});
		const marker = new maplibregl.Marker({ element: dot, draggable: true }).setLngLat(position).addTo(map);
		marker.on("dragend", () => {
			const { lng, lat } = marker.getLngLat();
			setVia(leg!.via.map((existing, other) => (other === index ? [lng, lat] : existing)));
		});
		return marker;
	});
}

function nearestVertex(line: Position[], point: Position): number {
	let nearest = 0;
	for (let index = 1; index < line.length; index++) if (distanceKm(line[index], point) < distanceKm(line[nearest], point)) nearest = index;
	return nearest;
}

/**
 * Grabbing the selected leg and dropping it on the road actually ridden adds a via point there. It slots in
 * between the existing via points by where it was grabbed along the leg, so the route keeps its riding order.
 */
function startRouteDrag(event: MapMouseEvent) {
	const { button, ctrlKey, shiftKey } = event.originalEvent;
	if (!selected || button !== 0 || ctrlKey || shiftKey) return;
	event.preventDefault();
	const leg = selected;
	const grabbed = nearestVertex(leg.geometry, [event.lngLat.lng, event.lngLat.lat]);
	const insertAt = leg.via.filter((via) => nearestVertex(leg.geometry, via) <= grabbed).length;
	const ghost = document.createElement("div");
	ghost.className = "via ghost";
	const marker = new maplibregl.Marker({ element: ghost }).setLngLat(event.lngLat).addTo(map);
	map.getCanvas().style.cursor = "grabbing";
	const move = (moveEvent: MapMouseEvent) => marker.setLngLat(moveEvent.lngLat);
	map.on("mousemove", move);
	map.once("mouseup", (upEvent) => {
		map.off("mousemove", move);
		marker.remove();
		map.getCanvas().style.cursor = "";
		if (upEvent.point.dist(event.point) < 4) return;
		const via = [...leg.via];
		via.splice(insertAt, 0, [upEvent.lngLat.lng, upEvent.lngLat.lat]);
		setVia(via);
	});
}

async function post<T = unknown>(path: string, body: unknown): Promise<T> {
	const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
	if (!response.ok) {
		element("status").textContent = `${path} failed: ${response.status} ${await response.text()}`;
		throw new Error(`${path} answered ${response.status}`);
	}
	await refresh();
	// Re-routing an edited leg takes a moment, and the server rewrites the overview a second after the last
	// edit; pick both up once that has happened.
	setTimeout(() => Promise.all([refresh(), loadOverview()]), 2500);
	return response.json();
}

map.on("click", async (event) => {
	const box: [maplibregl.PointLike, maplibregl.PointLike] = [
		[event.point.x - 5, event.point.y - 5],
		[event.point.x + 5, event.point.y + 5],
	];
	const [leg] = map.queryRenderedFeatures(box, { layers: legLayers });
	// Every leg ends on a kept fix, so a shift-click meant for a leg must not drop the fix it lands next to.
	if (leg && event.originalEvent.shiftKey && selection.length > 0) {
		const indices = [...selection.map((selectedLeg) => selectedLeg.index), leg.properties.index as number];
		const [first, last] = [Math.min(...indices), Math.max(...indices)];
		await selectMany(viewportLegs.filter((viewportLeg) => viewportLeg.index >= first && viewportLeg.index <= last));
		return;
	}
	const [fix] = map.queryRenderedFeatures(box, { layers: ["fixes-dropped", "fixes-kept"] });
	if (fix) {
		const { key, status, group } = fix.properties as { key: string; status: string; group: number };
		await post("/api/edit/fix", { key, group: event.originalEvent.shiftKey && status !== "kept" && group ? group : undefined });
		return;
	}
	// A click on the single selected leg is the start of a reroute drag; one leg out of several narrows to it.
	if (selected && map.queryRenderedFeatures(box, { layers: ["selection-line"] }).length > 0) return;
	if (leg) await select(leg.properties.index);
	// Held back a moment: this may be the first click of a double-click that adds a fix to the selected leg.
	else deselectTimer = setTimeout(deselect, 300);
});

let deselectTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Double-click splits a leg with a new fix: on a line, that line's leg; off the lines, the selected leg, so
 * the fix can sit on the trail actually walked rather than on the road the leg was drawn along.
 */
map.doubleClickZoom.disable();
map.on("dblclick", async (event) => {
	clearTimeout(deselectTimer);
	if (map.getZoom() < EDIT_ZOOM) return;
	const box: [maplibregl.PointLike, maplibregl.PointLike] = [
		[event.point.x - 5, event.point.y - 5],
		[event.point.x + 5, event.point.y + 5],
	];
	if (map.queryRenderedFeatures(box, { layers: ["fixes-dropped", "fixes-kept"] }).length > 0) return;
	const [line] = map.queryRenderedFeatures(box, { layers: legLayers });
	const key = (line?.properties.key as string | undefined) ?? (selection.length === 1 ? selection[0].key : undefined);
	if (!key) {
		element("status").textContent = "Double-click a line, or select a leg first, to add a fix to it.";
		return;
	}
	const { index } = await post<{ index: number }>("/api/edit/add", { leg: key, position: [event.lngLat.lng, event.lngLat.lat] });
	if (index >= 0) await select(index);
});

/**
 * Mouse gestures, replacing MapLibre's own drag pan, rotate and box zoom:
 * - drag: a box selecting every leg it touches (dragging the selected leg's yellow line reroutes it instead);
 * - Ctrl-drag or middle-drag: pans the map;
 * - Shift-drag: a box dropping every kept fix inside it (days spent in one place); Ctrl+Shift-drag or
 *   Shift+Alt-drag brings back every dropped one. The server picks the fixes by area, so this works before
 *   the fixes are drawn.
 * Mousedown still reaches MapLibre, whose click event depends on it.
 */
map.dragPan.disable();
map.dragRotate.disable();
map.boxZoom.disable();
map.getCanvasContainer().addEventListener(
	"mousedown",
	(event) => {
		// Via markers live in the same container and handle their own drags.
		if (event.target !== map.getCanvas() || (event.button !== 0 && event.button !== 1)) return;
		// Zoomed out there is nothing to select, so a plain drag moves the map there too.
		const pans = event.button === 1 || (event.ctrlKey && !event.shiftKey) || (!event.shiftKey && map.getZoom() < EDIT_ZOOM);
		if (pans) {
			event.preventDefault();
			panWithMouse(event);
			return;
		}
		if (map.getZoom() < EDIT_ZOOM) return;
		const canvas = map.getCanvasContainer().getBoundingClientRect();
		const start = { x: event.clientX - canvas.left, y: event.clientY - canvas.top };
		const forFixes = event.shiftKey;
		const near: [maplibregl.PointLike, maplibregl.PointLike] = [
			[start.x - 5, start.y - 5],
			[start.x + 5, start.y + 5],
		];
		const [addedFix] = forFixes ? [] : map.queryRenderedFeatures(near, { layers: ["fixes-kept"], filter: ["get", "added"] });
		if (addedFix) {
			event.preventDefault();
			dragAddedFix(event, addedFix.properties.key as string, (addedFix.geometry as GeoJSON.Point).coordinates as Position);
			return;
		}
		if (!forFixes && selected && map.queryRenderedFeatures([start.x, start.y], { layers: ["selection-line"] }).length > 0) return;
		event.preventDefault();
		const restore = forFixes && (event.altKey || event.ctrlKey);
		const box = document.createElement("div");
		box.className = "selection-box";
		box.classList.toggle("legs", !forFixes);
		box.classList.toggle("restore", restore);
		map.getCanvasContainer().append(box);
		let end = start;
		const move = (moveEvent: MouseEvent) => {
			end = { x: moveEvent.clientX - canvas.left, y: moveEvent.clientY - canvas.top };
			Object.assign(box.style, {
				left: `${Math.min(start.x, end.x)}px`,
				top: `${Math.min(start.y, end.y)}px`,
				width: `${Math.abs(end.x - start.x)}px`,
				height: `${Math.abs(end.y - start.y)}px`,
			});
		};
		const up = async () => {
			window.removeEventListener("mousemove", move);
			window.removeEventListener("mouseup", up);
			box.remove();
			// A click without a drag is meant for the leg or dot under it.
			if (Math.abs(end.x - start.x) < 4 && Math.abs(end.y - start.y) < 4) return;
			const corners: [maplibregl.PointLike, maplibregl.PointLike] = [
				[Math.min(start.x, end.x), Math.min(start.y, end.y)],
				[Math.max(start.x, end.x), Math.max(start.y, end.y)],
			];
			if (!forFixes) {
				await selectMany(map.queryRenderedFeatures(corners, { layers: legLayers }).map((feature) => feature.properties as LegRef));
				return;
			}
			const [northWest, southEast] = corners.map((corner) => map.unproject(corner));
			await post("/api/edit/fixes", { box: [northWest.lng, southEast.lat, southEast.lng, northWest.lat], restore });
		};
		window.addEventListener("mousemove", move);
		window.addEventListener("mouseup", up);
	},
	true,
);

/** A ghost dot follows the mouse; letting go moves the fix there. Without a drag, the click drops it as usual. */
function dragAddedFix(event: MouseEvent, key: string, position: Position) {
	const startPoint = { x: event.clientX, y: event.clientY };
	const ghost = document.createElement("div");
	ghost.className = "via ghost";
	const marker = new maplibregl.Marker({ element: ghost }).setLngLat(position as [number, number]);
	const canvas = map.getCanvasContainer().getBoundingClientRect();
	const lngLatAt = (moveEvent: MouseEvent) => map.unproject([moveEvent.clientX - canvas.left, moveEvent.clientY - canvas.top]);
	const moved = (moveEvent: MouseEvent) => Math.abs(moveEvent.clientX - startPoint.x) >= 4 || Math.abs(moveEvent.clientY - startPoint.y) >= 4;
	const move = (moveEvent: MouseEvent) => {
		if (!moved(moveEvent)) return;
		marker.setLngLat(lngLatAt(moveEvent)).addTo(map);
		map.getCanvas().style.cursor = "grabbing";
	};
	const up = async (upEvent: MouseEvent) => {
		window.removeEventListener("mousemove", move);
		window.removeEventListener("mouseup", up);
		marker.remove();
		map.getCanvas().style.cursor = "";
		if (!moved(upEvent)) return;
		const { lng, lat } = lngLatAt(upEvent);
		await post("/api/edit/move", { key, position: [lng, lat] });
	};
	window.addEventListener("mousemove", move);
	window.addEventListener("mouseup", up);
}

function panWithMouse(event: MouseEvent) {
	let last = { x: event.clientX, y: event.clientY };
	map.getCanvas().style.cursor = "grabbing";
	const move = (moveEvent: MouseEvent) => {
		map.panBy([last.x - moveEvent.clientX, last.y - moveEvent.clientY], { duration: 0 });
		last = { x: moveEvent.clientX, y: moveEvent.clientY };
	};
	const up = () => {
		window.removeEventListener("mousemove", move);
		window.removeEventListener("mouseup", up);
		map.getCanvas().style.cursor = "";
	};
	window.addEventListener("mousemove", move);
	window.addEventListener("mouseup", up);
}

const selectedKeys = () => selection.map((leg) => leg.key);

for (const button of element("modes").querySelectorAll("button")) {
	button.addEventListener("click", () => selection.length > 0 && post("/api/edit/leg", { keys: selectedKeys(), mode: button.dataset.mode || null }));
}
for (const button of element("transports").querySelectorAll("button")) {
	button.addEventListener("click", () => selection.length > 0 && post("/api/edit/leg", { keys: selectedKeys(), transport: button.dataset.transport || null }));
}
for (const button of element("routers").querySelectorAll("button")) {
	button.addEventListener("click", () => selection.length > 0 && post("/api/edit/leg", { keys: selectedKeys(), router: button.dataset.router || null }));
}
element("clear-via").addEventListener("click", () => setVia([]));

/** A leg runs between two kept fixes; dropping both joins the fixes on either side with a new leg. */
async function deleteLegs() {
	if (selection.length > 0) await post("/api/edit/fixes", { legs: selectedKeys(), restore: false });
}

/** One leg from the first selected leg's start to the last one's end; every fix in between is dropped. */
async function joinLegs() {
	if (selection.length < 2) return;
	const { index } = await post<{ index: number }>("/api/edit/join", { from: selection[0].key, to: selection.at(-1)!.key });
	if (index >= 0) await select(index);
}
element("delete-legs").addEventListener("click", deleteLegs);
element("join-legs").addEventListener("click", joinLegs);

function stepIssue(direction: 1 | -1) {
	if (!status || status.issues.length === 0) return;
	issueCursor = (issueCursor + direction + status.issues.length) % status.issues.length;
	select(status.issues[issueCursor].index, true);
	pollStatus();
}
element("previous-issue").addEventListener("click", () => stepIssue(-1));
element("next-issue").addEventListener("click", () => stepIssue(1));

for (const button of element("colour-by").querySelectorAll<HTMLButtonElement>("button")) {
	button.addEventListener("click", () => {
		colourBy = button.dataset.colour as typeof colourBy;
		for (const other of element("colour-by").querySelectorAll("button")) other.classList.toggle("active", other === button);
		paintLegs();
	});
}

element<HTMLInputElement>("satellite").addEventListener("change", (event: Event) => {
	map.setLayoutProperty("satellite", "visibility", (event.target as HTMLInputElement).checked ? "visible" : "none");
});

window.addEventListener("keydown", (event) => {
	if (event.key === "n") stepIssue(1);
	if (event.key === "p") stepIssue(-1);
	if (event.key === "Escape") deselect();
	if (event.key === "Delete" || event.key === "Backspace") deleteLegs();
	if (event.key === "j") joinLegs();
});

/**
 * → and ← grow the selection by the next or previous leg, so a connected stretch can be picked leg by leg and
 * deleted at once; with Shift they take a leg back off that end. The neighbour may lie off screen, so it is
 * fetched rather than looked up among the loaded legs.
 */
async function growSelection(direction: 1 | -1, shrink: boolean) {
	if (shrink) {
		if (selection.length > 1) await selectMany(direction === 1 ? selection.slice(0, -1) : selection.slice(1));
		return;
	}
	const edge = direction === 1 ? selection.at(-1)!.index + 1 : selection[0].index - 1;
	const response = await fetch(`/api/leg/${edge}`);
	if (!response.ok) return;
	const leg = (await response.json()) as SelectedLeg;
	await selectMany([...selection, { index: edge, key: leg.key, transport: leg.transport, mode: leg.mode, router: leg.router, edited: leg.edited }]);
	const end = direction === 1 ? leg.to : leg.from;
	if (!map.getBounds().contains(end)) map.panTo(end);
}

// Captured before MapLibre's own keyboard handler, which pans the map with the arrow keys.
window.addEventListener(
	"keydown",
	(event) => {
		if (selection.length === 0 || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) return;
		event.preventDefault();
		event.stopPropagation();
		// A held key repeats faster than a leg loads; each step has to see the selection the last one left.
		if (growing) return;
		growing = true;
		growSelection(event.key === "ArrowRight" ? 1 : -1, event.shiftKey).finally(() => (growing = false));
	},
	true,
);

let growing = false;
