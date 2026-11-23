/**
 * Cleans the GPS track and snaps it to roads, leg by leg, while serving an editor to correct the result.
 *
 *   bun scripts/route/snap.ts            # then open http://localhost:5180
 *
 * Reads static/journey/route.json (raw fixes from scripts/import-polarsteps.ts) and scripts/route/edits.json
 * (corrections made in the editor). Writes static/journey/route-snapped.json, which the journey map prefers
 * over the raw track, and the simplified first-paint `route` in src/lib/server/journey.json. Both are
 * rewritten as snapping progresses, so reloading the site shows how far it got.
 * Routed legs are cached in .cache/route-legs.json; a restart only requests what is missing.
 * Routing uses the public FOSSGIS OSRM servers, which ask for at most one request per second.
 */
import { groupIntoChapters, type JourneyStep } from "#lib/journey.ts";
import { lengthKm, resample, simplify, type Position } from "#lib/route.ts";
import { alignSteps, buildRouteStats, SELF_POWERED, type LegSample } from "#lib/routeStats.ts";
import { elevations } from "./terrain.ts";
import {
	assembleRoute,
	buildLegs,
	cleanFixes,
	fixKey,
	isLongDetour,
	legKey,
	NO_EDITS,
	snapKey,
	type CleanFix,
	type Leg,
	type LegMode,
	type RouteEdits,
	type Router,
	type SnappedLeg,
	type Transport,
} from "#lib/routeCleanup.ts";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import editor from "./editor.html";

/**
 * Legs are routed by car unless the editor picks another router: touring mostly follows the main road, which
 * the car profile picks, while the bike profile wanders off onto quiet side roads and refuses trunk roads and
 * airport access roads altogether. Where no sensible way is found, the leg is drawn straight and listed for
 * review in the editor. The FOSSGIS servers keep "driving" in the path for every profile.
 */
const CAR = "https://routing.openstreetmap.de/routed-car/route/v1/driving";
const BIKE = "https://routing.openstreetmap.de/routed-bike/route/v1/driving";
/**
 * Hikes go to BRouter: OSRM will not snap a waypoint onto a patch of trails that is not joined up with the rest
 * of its network, and puts it on the nearest connected way instead, often hundreds of metres off.
 */
const HIKING = "https://brouter.de/brouter";
/** The public server accepts 100 waypoints per request. */
const MAX_LEGS_PER_REQUEST = 99;
const REQUEST_GAP_MS = 1100;
const PORT = 5180;
/** ~3 m; the router returns a vertex every few metres. */
const LEG_TOLERANCE = 0.00003;
/** ~10 m for the full-resolution map route. */
const ROUTE_TOLERANCE = 0.0001;
/** The same tolerance the import uses for the route that is drawn before the full one loads. */
const FIRST_PAINT_TOLERANCE = 0.02;
/** ~200 m for the editor's zoomed-out view. */
const OVERVIEW_TOLERANCE = 0.002;
const WRITE_EVERY_REQUESTS = 20;
/** Ridden legs longer than this are worth a look in the editor: often a bus or train. */
const REVIEW_KM = 25;
/** Shorter detours are drawn straight between nearby fixes, which barely shows on the map. */
const REVIEW_DETOUR_KM = 3;

const RAW = "static/journey/route.json";
const EDITS = "scripts/route/edits.json";
const CACHE = ".cache/route-legs.json";
const SNAPPED = "static/journey/route-snapped.json";
const JOURNEY = "src/lib/server/journey.json";
const STATS = "src/lib/server/route-stats.json";
/** fixKey -> unix seconds, written by scripts/import-polarsteps.ts; optional, the editor just shows no dates. */
const TIMES = "scripts/route/fix-times.json";
/** Elevation sample spacing along legs covered under own power. */
const SAMPLE_KM = 0.25;

const raw: Position[][] = JSON.parse(readFileSync(RAW, "utf8"));
const steps: JourneyStep[] = JSON.parse(readFileSync(JOURNEY, "utf8")).steps;
let edits: RouteEdits = existsSync(EDITS) ? { ...NO_EDITS, ...JSON.parse(readFileSync(EDITS, "utf8")) } : structuredClone(NO_EDITS);
/**
 * snapKey -> [router distance in km, coordinates]; an empty line means the router found no way. Bus rides and
 * lifts are stored under `road:<leg key>` with their distance only.
 */
const cache = new Map<string, [number, Position[]]>(existsSync(CACHE) ? Object.entries(JSON.parse(readFileSync(CACHE, "utf8"))) : []);

let fixes: CleanFix[] = [];
let legs: Leg[] = [];
/** Legs touched in the editor jump the queue. */
const priority = new Set<string>();
let requests = 0;
/** Requests the router answered with an error code, e.g. a waypoint with no road anywhere near it. */
let rejected = 0;
let lastError: string | null = null;
let wake: () => void = () => {};

interface FixDate {
	/** Local calendar day, to find where a new day starts. */
	day: string;
	/** "12 Mar" */
	date: string;
	/** "14:05" */
	time: string;
	/** "Sun, 12 Mar 2023, 14:05" */
	full: string;
	/** "Sun, 12 Mar" */
	weekdayDate: string;
	seconds: number;
}

/**
 * Local time of every fix, in the timezone of the Polarsteps step posted before it, so a day on the map is the
 * day as it was lived there rather than in UTC.
 */
const fixDates = new Map<string, FixDate>();
{
	const times: Record<string, number> = existsSync(TIMES) ? JSON.parse(readFileSync(TIMES, "utf8")) : {};
	const stepStarts = steps.map((step) => ({ at: Date.parse(step.time) / 1000, timezone: step.timezone }));
	const formatters = new Map<string, Intl.DateTimeFormat>();
	const formatterFor = (timeZone: string) => {
		const cached = formatters.get(timeZone);
		if (cached) return cached;
		const created = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
		formatters.set(timeZone, created);
		return created;
	};
	let step = 0;
	for (const [key, seconds] of Object.entries(times).sort(([, a], [, b]) => a - b)) {
		while (step + 1 < stepStarts.length && stepStarts[step + 1].at <= seconds) step++;
		const parts = Object.fromEntries(formatterFor(stepStarts[step]?.timezone ?? "UTC").formatToParts(new Date(seconds * 1000)).map(({ type, value }) => [type, value]));
		const time = `${parts.hour}:${parts.minute}`;
		fixDates.set(key, {
			day: `${parts.year}-${parts.month}-${parts.day}`,
			date: `${parts.day} ${parts.month}`,
			time,
			full: `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}, ${time}`,
			weekdayDate: `${parts.weekday}, ${parts.day} ${parts.month}`,
			seconds,
		});
	}
}

/** Kept fixes that are the first of their local day; they carry a date label on the map. */
let dayStarts = new Set<string>();

function recompute() {
	fixes = cleanFixes(raw, edits);
	legs = buildLegs(fixes, edits);
	dayStarts = new Set();
	let lastDay = "";
	for (const fix of fixes) {
		const day = fix.status === "kept" ? fixDates.get(fix.key)?.day : undefined;
		if (!day || day === lastDay) continue;
		dayStarts.add(fix.key);
		lastDay = day;
	}
}

/**
 * When a stretch from `from` to `to` was travelled: "Wed, 25 Oct 2023, 07:40 → 11:15", with the end's date
 * too when it runs past midnight, and how long it took.
 */
function stretchDates(from: Position, to: Position): { when: string; duration: string } | null {
	const [start, end] = [fixDates.get(fixKey(from)), fixDates.get(fixKey(to))];
	if (!start || !end) return null;
	const minutes = Math.max(0, Math.round((end.seconds - start.seconds) / 60));
	const [days, hours] = [Math.floor(minutes / 1440), Math.floor((minutes % 1440) / 60)];
	let duration = `${minutes} min`;
	if (days > 0) duration = `${days} day${days === 1 ? "" : "s"}${hours > 0 ? `, ${hours} h` : ""}`;
	else if (hours > 0) duration = `${hours} h ${minutes % 60} min`;
	return { when: `${start.full} → ${start.day === end.day ? "" : `${end.weekdayDate}, `}${end.time}`, duration };
}

function snapped(leg: Leg): SnappedLeg | undefined {
	const entry = cache.get(snapKey(leg));
	return entry && { distanceKm: entry[0], coordinates: entry[1] };
}

const pending = (leg: Leg) => leg.mode === "ride" && !cache.has(snapKey(leg));

function writeAtomically(path: string, contents: string) {
	writeFileSync(`${path}.tmp`, contents);
	renameSync(`${path}.tmp`, path);
}

function saveCache() {
	mkdirSync(".cache", { recursive: true });
	writeAtomically(CACHE, JSON.stringify(Object.fromEntries(cache)));
}

function writeOutputs() {
	const round = (digits: number) => (line: Position[]) => line.map(([lon, lat]): Position => [Number(lon.toFixed(digits)), Number(lat.toFixed(digits))]);
	const lines = assembleRoute(legs, snapped, ROUTE_TOLERANCE);
	writeAtomically(SNAPPED, JSON.stringify(lines.map(round(5))));
	// Runs of consecutive legs travelled the same way, so the zoomed-out view can colour by transport too.
	const runs: OverviewRun[] = [];
	for (const [index, leg] of legs.entries()) {
		const hop = leg.mode === "hop";
		const line = legLine(leg);
		const run = runs.at(-1);
		if (run && !hop && !run.hop && run.transport === leg.transport) run.line.push(...line.slice(1));
		else runs.push({ index, transport: leg.transport, hop, line: [...line] });
	}
	overview = runs.map((run) => ({ ...run, line: round(4)(simplify(run.line, OVERVIEW_TOLERANCE)) })).filter((run) => run.line.length > 1);
	const journey = JSON.parse(readFileSync(JOURNEY, "utf8"));
	journey.route = lines.map((line) => round(3)(simplify(line, FIRST_PAINT_TOLERANCE))).filter((line) => line.length > 1);
	writeAtomically(JOURNEY, JSON.stringify(journey));
	refreshStats();
}

/** The next legs to route: edited ones first, otherwise the earliest unsnapped run of consecutive legs. */
function nextBatch(): Leg[] {
	const urgent = legs.find((leg) => priority.has(snapKey(leg)) && pending(leg));
	const first = urgent ?? legs.find(pending);
	// BRouter answers one track for all waypoints, which does not split back into legs; hikes go one at a time.
	if (!first || first.via.length > 0 || first.router === "foot") return first ? [first] : [];
	const batch = [first];
	for (let index = legs.indexOf(first) + 1; index < legs.length && batch.length < MAX_LEGS_PER_REQUEST; index++) {
		const leg = legs[index];
		if (!pending(leg) || leg.via.length > 0 || leg.router !== first.router) break;
		batch.push(leg);
	}
	return batch;
}

/** Bus rides and lifts follow roads, so their distance comes from the car router; only the number is kept. */
const roadKey = (leg: Leg) => `road:${leg.key}`;

/**
 * The hops need not be consecutive: the request runs from..to of each hop in turn and keeps every other leg
 * of the answer, dropping the connections in between.
 */
function nextRoadHopBatch(): Leg[] {
	return legs.filter((leg) => (leg.transport === "bus" || leg.transport === "car") && !cache.has(roadKey(leg))).slice(0, MAX_LEGS_PER_REQUEST >> 1);
}

async function measureRoadHops(batch: Leg[]): Promise<void> {
	const roads = await route(batch.flatMap((leg) => [leg.from, leg.to]), CAR);
	if (!roads && batch.length > 1) {
		const middle = Math.ceil(batch.length / 2);
		await Bun.sleep(REQUEST_GAP_MS);
		await measureRoadHops(batch.slice(0, middle));
		await Bun.sleep(REQUEST_GAP_MS);
		await measureRoadHops(batch.slice(middle));
		return;
	}
	batch.forEach((leg, index) => cache.set(roadKey(leg), [Number((roads?.[index * 2]?.distanceKm ?? 0).toFixed(3)), []]));
}

/** How far a leg went: by road where it was snapped or measured, otherwise as the crow flies. */
function legKm(leg: Leg): number {
	if (leg.transport === "flight" || leg.transport === "boat") return leg.straightKm;
	if (leg.transport === "bus" || leg.transport === "car") return cache.get(roadKey(leg))?.[0] || leg.straightKm;
	return lengthKm(legLine(leg));
}

function legLine(leg: Leg): Position[] {
	const road = leg.mode === "ride" ? snapped(leg) : undefined;
	return road && road.coordinates.length > 1 && !isLongDetour(leg, road) ? road.coordinates : [leg.from, ...leg.via, leg.to];
}

/**
 * Kilometres per transport, climb and elevation profiles per country chapter, for the journey page. Each leg
 * belongs to the chapter of the last step posted before it.
 */
async function writeStats() {
	const kept = fixes.filter((fix) => fix.status === "kept").map((fix) => fix.position);
	const matches = alignSteps(steps.map((step): Position => [step.lon, step.lat]), kept);
	const chapters = groupIntoChapters(steps);
	const chapterOfStep = chapters.flatMap((chapter, index) => chapter.steps.map(() => index));
	let step = 0;
	const samples: LegSample[] = [];
	for (const [index, leg] of legs.entries()) {
		while (step + 1 < steps.length && matches[step + 1] <= index) step++;
		const climbs = SELF_POWERED.includes(leg.transport) && leg.mode !== "hop";
		const heights = climbs ? await elevations(resample(legLine(leg), SAMPLE_KM).map(({ position }) => position)) : [];
		samples.push({ transport: leg.transport, km: legKm(leg), section: chapterOfStep[step] ?? 0, elevations: heights });
	}
	const stats = buildRouteStats(
		samples,
		chapters.map((chapter) => chapter.steps[0].slug),
	);
	writeAtomically(STATS, JSON.stringify(stats));
	console.log(`Stats: ${Math.round(stats.totalKm).toLocaleString()} km in total, ${Math.round(stats.withoutFlightsKm).toLocaleString()} km without flights, ↑ ${stats.ascent.toLocaleString()} m`);
}

let statsRunning = false;
let statsAgain = false;

/** Stats take a while on the first run (terrain tiles download); requests meanwhile coalesce into one rerun. */
async function refreshStats() {
	if (statsRunning) {
		statsAgain = true;
		return;
	}
	statsRunning = true;
	try {
		await writeStats();
	} catch (error) {
		console.error("Stats failed:", error);
	} finally {
		statsRunning = false;
		if (statsAgain) {
			statsAgain = false;
			refreshStats();
		}
	}
}

async function route(waypoints: Position[], profile = CAR): Promise<SnappedLeg[] | null> {
	const coordinates = waypoints.map(([lon, lat]) => `${lon},${lat}`).join(";");
	for (let attempt = 0; ; attempt++) {
		const response = await fetch(`${profile}/${coordinates}?overview=false&steps=true&geometries=geojson&continue_straight=false`, {
			headers: { "User-Agent": "letsmoe.com route snapping" },
		}).catch((error: Error) => error);
		requests++;
		if (response instanceof Error || response.status === 429 || response.status >= 500) {
			lastError = response instanceof Error ? response.message : `HTTP ${response.status}`;
			await Bun.sleep(Math.min(60_000, 5_000 * 2 ** attempt));
			continue;
		}
		const body = await response.json();
		if (body.code !== "Ok") {
			rejected++;
			if (rejected % 25 === 1) console.log(`Router rejected ${waypoints.length} waypoints near ${waypoints[0]}: ${body.code} ${body.message ?? ""}`);
			return null;
		}
		lastError = null;
		return body.routes[0].legs.map((leg: { distance: number; steps: { geometry: { coordinates: Position[] } }[] }) => ({
			distanceKm: leg.distance / 1000,
			coordinates: leg.steps.flatMap((step) => step.geometry.coordinates),
		}));
	}
}

/**
 * BRouter's hiking profile for one leg, through any via points. It answers a waypoint it cannot place with
 * an error text rather than JSON, sometimes as a server error, so those are only retried a few times.
 */
async function hike(waypoints: Position[]): Promise<SnappedLeg | null> {
	const lonlats = waypoints.map(([lon, lat]) => `${lon},${lat}`).join("|");
	for (let attempt = 0; ; attempt++) {
		const response = await fetch(`${HIKING}?lonlats=${lonlats}&profile=hiking-mountain&alternativeidx=0&format=geojson`, {
			headers: { "User-Agent": "letsmoe.com route snapping" },
		}).catch((error: Error) => error);
		requests++;
		const retryable = response instanceof Error || response.status === 429 || response.status >= 500;
		if (retryable && attempt < 3) {
			lastError = response instanceof Error ? response.message : `HTTP ${response.status}`;
			await Bun.sleep(5_000 * 2 ** attempt);
			continue;
		}
		const text = response instanceof Error ? response.message : await response.text();
		if (response instanceof Error || !response.ok || !text.startsWith("{")) {
			rejected++;
			console.log(`BRouter found no hike from ${waypoints[0]}: ${text.slice(0, 120)}`);
			return null;
		}
		lastError = null;
		const [track] = JSON.parse(text).features as { properties: { "track-length": string }; geometry: { coordinates: number[][] } }[];
		return { distanceKm: Number(track.properties["track-length"]) / 1000, coordinates: track.geometry.coordinates.map(([lon, lat]): Position => [lon, lat]) };
	}
}

function store(leg: Leg, road: SnappedLeg | null) {
	const line = road ? simplify(road.coordinates, LEG_TOLERANCE).map(([lon, lat]): Position => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]) : [];
	cache.set(snapKey(leg), [road ? Number(road.distanceKm.toFixed(3)) : 0, line]);
	priority.delete(snapKey(leg));
}

/** Routes a batch in one request; if the router rejects it, halves it until the leg that has no way is found. */
async function snapBatch(batch: Leg[]): Promise<void> {
	const [first] = batch;
	if (first.router === "foot") {
		store(first, await hike([first.from, ...first.via, first.to]));
		return;
	}
	const profile = first.router === "bike" ? BIKE : CAR;
	if (batch.length === 1 && first.via.length > 0) {
		const parts = await route([first.from, ...first.via, first.to], profile);
		store(first, parts && { distanceKm: parts.reduce((sum, part) => sum + part.distanceKm, 0), coordinates: parts.flatMap((part, index) => (index === 0 ? part.coordinates : part.coordinates.slice(1))) });
		return;
	}
	const roads = await route([first.from, ...batch.map((leg) => leg.to)], profile);
	if (roads) {
		batch.forEach((leg, index) => store(leg, roads[index]));
		return;
	}
	if (batch.length === 1) {
		store(first, null);
		return;
	}
	const middle = Math.ceil(batch.length / 2);
	await Bun.sleep(REQUEST_GAP_MS);
	await snapBatch(batch.slice(0, middle));
	await Bun.sleep(REQUEST_GAP_MS);
	await snapBatch(batch.slice(middle));
}

async function snapForever() {
	let sinceWrite = 0;
	while (true) {
		const batch = nextBatch();
		const roadHops = batch.length === 0 ? nextRoadHopBatch() : [];
		if (roadHops.length > 0) {
			await measureRoadHops(roadHops);
			sinceWrite++;
			if (sinceWrite >= WRITE_EVERY_REQUESTS) {
				saveCache();
				writeOutputs();
				sinceWrite = 0;
				console.log(`Measuring bus rides and lifts by road, ${requests} requests`);
			}
			await Bun.sleep(REQUEST_GAP_MS);
			continue;
		}
		if (batch.length === 0) {
			if (sinceWrite > 0) {
				saveCache();
				writeOutputs();
				sinceWrite = 0;
				console.log(`All ${legs.filter((leg) => leg.mode === "ride").length} ridden legs snapped after ${requests} requests.`);
			}
			await new Promise<void>((resolve) => (wake = resolve));
			continue;
		}
		const urgent = batch.some((leg) => priority.has(snapKey(leg)));
		await snapBatch(batch);
		sinceWrite++;
		// Edits show up in the editor and on the site as soon as their legs are routed.
		if (sinceWrite >= WRITE_EVERY_REQUESTS || (urgent && priority.size === 0)) {
			saveCache();
			writeOutputs();
			sinceWrite = 0;
			const ridden = legs.filter((leg) => leg.mode === "ride");
			console.log(`${ridden.length - ridden.filter(pending).length}/${ridden.length} legs snapped, ${requests} requests`);
		}
		await Bun.sleep(REQUEST_GAP_MS);
	}
}

let outputsTimer: ReturnType<typeof setTimeout> | undefined;

function saveEdits() {
	writeAtomically(EDITS, `${JSON.stringify(edits, null, "\t")}\n`);
	const pendingBefore = new Set(legs.filter(pending).map(snapKey));
	recompute();
	for (const leg of legs) if (pending(leg) && !pendingBefore.has(snapKey(leg))) priority.add(snapKey(leg));
	// Rewriting the route files takes half a second; the editor gets its answer first, and a burst of edits
	// shares one write.
	clearTimeout(outputsTimer);
	outputsTimer = setTimeout(writeOutputs, 1000);
	wake();
}

/** Legs worth a second look, in route order. */
function issues() {
	return legs.flatMap((leg, index) => {
		const road = snapped(leg);
		const reasons: string[] = [];
		if (leg.mode === "hop" && !leg.edited) reasons.push(`${leg.transport}? ${Math.round(leg.straightKm)} km`);
		if (leg.mode === "ride" && leg.straightKm > REVIEW_KM && !leg.edited) reasons.push(`long leg ${Math.round(leg.straightKm)} km`);
		if (leg.mode === "ride" && road && road.coordinates.length === 0) reasons.push("no road found");
		if (leg.mode === "ride" && road && road.coordinates.length > 0 && isLongDetour(leg, road, 2.5, REVIEW_DETOUR_KM)) reasons.push(`detour ${road.distanceKm.toFixed(1)} km by road`);
		return reasons.length > 0 ? [{ index, reason: reasons.join(", ") }] : [];
	});
}

type Box = [west: number, south: number, east: number, north: number];

/** `?bbox=west,south,east,north` from the editor's viewport; without one, everything. */
function boxFrom(request: Request): Box | null {
	const parts = new URL(request.url).searchParams.get("bbox")?.split(",").map(Number);
	return parts?.length === 4 && parts.every(Number.isFinite) ? (parts as Box) : null;
}

function touches(line: Position[], [west, south, east, north]: Box): boolean {
	let [minLon, minLat, maxLon, maxLat] = [Infinity, Infinity, -Infinity, -Infinity];
	for (const [lon, lat] of line) {
		minLon = Math.min(minLon, lon);
		minLat = Math.min(minLat, lat);
		maxLon = Math.max(maxLon, lon);
		maxLat = Math.max(maxLat, lat);
	}
	return minLon <= east && maxLon >= west && minLat <= north && maxLat >= south;
}

function legGeometry(leg: Leg) {
	const road = leg.mode === "ride" ? snapped(leg) : undefined;
	const usable = road && road.coordinates.length > 1 && !isLongDetour(leg, road);
	const state = leg.mode !== "ride" ? leg.mode : usable ? "snapped" : road ? "failed" : "pending";
	// The router starts and ends on the road nearest each fix; joining the fixes on shows which leg is whose.
	return { state, coordinates: usable ? [leg.from, ...road.coordinates, leg.to] : legLine(leg) };
}

function legsGeoJSON(box: Box | null) {
	return {
		type: "FeatureCollection",
		features: legs.flatMap((leg, index) => {
			const { state, coordinates } = legGeometry(leg);
			if (box && !touches(coordinates, box)) return [];
			return [{ type: "Feature", properties: { index, key: leg.key, state, transport: leg.transport, mode: leg.mode, router: leg.router, edited: leg.edited }, geometry: { type: "LineString", coordinates } }];
		}),
	};
}

function fixesGeoJSON(box: Box | null) {
	const added = new Set((edits.add ?? []).map((fix) => fixKey(fix.position)));
	return {
		type: "FeatureCollection",
		features: fixes.flatMap((fix) =>
			box && !touches([fix.position], box)
				? []
				: [
						{
							type: "Feature",
							properties: {
								key: fix.key,
								status: fix.status,
								group: fix.group ?? 0,
								added: added.has(fix.key),
								dayStart: dayStarts.has(fix.key),
								date: fixDates.get(fix.key)?.date ?? "",
								time: fixDates.get(fix.key)?.time ?? "",
								full: fixDates.get(fix.key)?.full ?? "",
							},
							geometry: { type: "Point", coordinates: fix.position },
						},
					],
		),
	};
}

/** A stretch of the zoomed-out view; `index` is its first leg, for colouring by time. */
interface OverviewRun {
	index: number;
	transport: Transport;
	hop: boolean;
	line: Position[];
}

/** The whole route at ~200 m, for looking around while zoomed out; rebuilt whenever the outputs are. */
let overview: OverviewRun[] = [];

recompute();

Bun.serve({
	port: PORT,
	routes: {
		"/": editor,
		"/maplibre-gl-worker.mjs": () => new Response(Bun.file("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"), { headers: { "Content-Type": "text/javascript" } }),
		"/api/legs": (request) => Response.json(legsGeoJSON(boxFrom(request))),
		"/api/fixes": (request) => Response.json(fixesGeoJSON(boxFrom(request))),
		"/api/stats": () => (existsSync(STATS) ? new Response(Bun.file(STATS), { headers: { "Content-Type": "application/json" } }) : Response.json(null)),
		"/api/overview": () =>
			Response.json({
				type: "FeatureCollection",
				features: overview.map(({ index, transport, hop, line }) => ({ type: "Feature", properties: { index, transport, hop }, geometry: { type: "LineString", coordinates: line } })),
			}),
		"/api/status": () => {
			const ridden = legs.filter((leg) => leg.mode === "ride");
			return Response.json({ snapped: ridden.length - ridden.filter(pending).length, total: ridden.length, requests, rejected, lastError, issues: issues() });
		},
		"/api/leg/:index": (request) => {
			const leg = legs[Number(request.params.index)];
			if (!leg) return new Response("No such leg", { status: 404 });
			const road = snapped(leg);
			return Response.json({ ...leg, roadKm: road && road.coordinates.length > 0 ? road.distanceKm : null, geometry: legGeometry(leg).coordinates });
		},
		/**
		 * What the editor shows about the selected legs: when they were travelled, from the first one's start to
		 * the last one's end, and the height along them in route order for the elevation profile, hops left out.
		 */
		"/api/selection": {
			POST: async (request) => {
				const { keys } = (await request.json()) as { keys: string[] };
				const wanted = new Set(keys);
				const chosen = legs.filter((leg) => wanted.has(leg.key));
				const dates = chosen.length > 0 ? stretchDates(chosen[0].from, chosen.at(-1)!.to) : null;
				const line = chosen.filter((leg) => leg.mode !== "hop").flatMap(legLine);
				if (line.length < 2) return Response.json({ dates, km: [], elevations: [] });
				const samples = resample(line, Math.max(lengthKm(line) / 200, 0.03));
				const heights = await elevations(samples.map(({ position }) => position));
				return Response.json({ dates, km: samples.map(({ km }) => Number(km.toFixed(3))), elevations: heights.map(Math.round) });
			},
		},
		"/api/edit/leg": {
			POST: async (request) => {
				const { key, keys, mode, transport, router, via } = (await request.json()) as {
					key?: string;
					keys?: string[];
					mode?: LegMode | null;
					transport?: Transport | null;
					router?: Router | null;
					via?: Position[];
				};
				for (const legKey of keys ?? (key ? [key] : [])) {
					const edit = { ...edits.legs[legKey] };
					if (mode === null) delete edit.mode;
					else if (mode) edit.mode = mode;
					if (router === null) delete edit.router;
					else if (router) edit.router = router;
					if (transport === null) delete edit.transport;
					else if (transport) {
						// The transport brings its own drawing mode; an earlier mode override would fight it.
						edit.transport = transport;
						delete edit.mode;
					}
					if (via) edit.via = via;
					if (edit.via?.length === 0) delete edit.via;
					if (Object.keys(edit).length === 0) delete edits.legs[legKey];
					else edits.legs[legKey] = edit;
				}
				saveEdits();
				return Response.json({ ok: true });
			},
		},
		/**
		 * Drops every kept fix given by key, inside `box`, or at either end of the given `legs`; with `restore`
		 * brings back every dropped one instead.
		 */
		"/api/edit/fixes": {
			POST: async (request) => {
				const { keys, box, legs: legKeys, restore } = (await request.json()) as { keys?: string[]; box?: Box; legs?: string[]; restore: boolean };
				let selected = keys ?? [];
				if (box) selected = fixes.filter((fix) => touches([fix.position], box)).map((fix) => fix.key);
				if (legKeys) {
					const wanted = new Set(legKeys);
					selected = legs.filter((leg) => wanted.has(leg.key)).flatMap((leg) => [fixKey(leg.from), fixKey(leg.to)]);
				}
				const statusOf = new Map(fixes.map((fix) => [fix.key, fix.status]));
				for (const key of new Set(selected)) {
					const status = statusOf.get(key);
					if (!restore && status === "kept") {
						edits.remove.push(key);
						edits.keep = edits.keep.filter((kept) => kept !== key);
					} else if (restore && status === "removed") {
						edits.remove = edits.remove.filter((removed) => removed !== key);
					} else if (restore && status !== "kept" && !edits.keep.includes(key)) {
						edits.keep.push(key);
					}
				}
				saveEdits();
				return Response.json({ ok: true });
			},
		},
		/**
		 * Splits a leg with a new fix at `position`. Both halves keep the leg's transport and drawing, so only the
		 * part that differs (a short hike inside a ride) needs changing. Answers with the first half's index.
		 */
		"/api/edit/add": {
			POST: async (request) => {
				const { leg: key, position } = (await request.json()) as { leg: string; position: Position };
				const leg = legs.find((candidate) => candidate.key === key);
				if (!leg) return new Response("No such leg", { status: 404 });
				const added: Position = [Number(position[0].toFixed(5)), Number(position[1].toFixed(5))];
				edits.add = [...(edits.add ?? []), { after: fixKey(leg.from), position: added }];
				// Via points belonged to the whole leg and would pull either half off course.
				const halves = { ...edits.legs[key] };
				delete halves.via;
				if (Object.keys(halves).length > 0) {
					edits.legs[legKey(leg.from, added)] = { ...halves };
					edits.legs[legKey(added, leg.to)] = { ...halves };
				}
				saveEdits();
				return Response.json({ index: legs.findIndex((candidate) => candidate.key === legKey(leg.from, added)) });
			},
		},
		/**
		 * Moves a fix added in the editor. Everything that names it by its coordinates follows along: fixes added
		 * after it, and the edits of the two legs it joins.
		 */
		"/api/edit/move": {
			POST: async (request) => {
				const { key, position } = (await request.json()) as { key: string; position: Position };
				const moved: Position = [Number(position[0].toFixed(5)), Number(position[1].toFixed(5))];
				const movedKey = fixKey(moved);
				if (!edits.add?.some((fix) => fixKey(fix.position) === key)) return new Response("Only added fixes move", { status: 400 });
				edits.add = edits.add.map((fix) => ({ after: fix.after === key ? movedKey : fix.after, position: fixKey(fix.position) === key ? moved : fix.position }));
				for (const leg of legs) {
					const edit = edits.legs[leg.key];
					if (!edit || (fixKey(leg.from) !== key && fixKey(leg.to) !== key)) continue;
					delete edits.legs[leg.key];
					edits.legs[legKey(fixKey(leg.from) === key ? moved : leg.from, fixKey(leg.to) === key ? moved : leg.to)] = edit;
				}
				saveEdits();
				return Response.json({ ok: true });
			},
		},
		/** Joins a run of legs into one by dropping every fix inside it; answers with the joined leg's index. */
		"/api/edit/join": {
			POST: async (request) => {
				const { from, to } = (await request.json()) as { from: string; to: string };
				const [first, last] = [from, to].map((key) => legs.findIndex((leg) => leg.key === key)).sort((a, b) => a - b);
				if (first === -1) return new Response("No such leg", { status: 404 });
				const joined = legKey(legs[first].from, legs[last].to);
				for (const leg of legs.slice(first, last)) {
					const key = fixKey(leg.to);
					edits.remove.push(key);
					edits.keep = edits.keep.filter((kept) => kept !== key);
				}
				saveEdits();
				return Response.json({ index: legs.findIndex((leg) => leg.key === joined) });
			},
		},
		"/api/edit/fix": {
			POST: async (request) => {
				const { key, group } = (await request.json()) as { key: string; group?: number };
				const keys = group ? fixes.filter((fix) => fix.group === group).map((fix) => fix.key) : [key];
				const status = fixes.find((fix) => fix.key === key)?.status;
				for (const fixKey of keys) {
					if (status === "kept") {
						edits.remove.push(fixKey);
						edits.keep = edits.keep.filter((kept) => kept !== fixKey);
					} else if (status === "removed") {
						edits.remove = edits.remove.filter((removed) => removed !== fixKey);
					} else if (!edits.keep.includes(fixKey)) {
						edits.keep.push(fixKey);
					}
				}
				saveEdits();
				return Response.json({ ok: true });
			},
		},
	},
});

console.log(`Route editor on http://localhost:${PORT}`);
writeOutputs();
snapForever();
