import { cumulativeKm, distanceKm, simplify, type Position } from "#lib/route.ts";

/** Fixes are stored with 5 decimals (~1 m), so the rounded coordinates identify a fix across re-imports. */
export function fixKey([lon, lat]: Position): string {
	return `${lon.toFixed(5)},${lat.toFixed(5)}`;
}

/** How a leg is drawn: snapped to roads, as recorded, or as a dashed hop. */
export type LegMode = "ride" | "hop" | "straight";

export const TRANSPORTS = ["bike", "foot", "bus", "car", "boat", "flight"] as const;
export type Transport = (typeof TRANSPORTS)[number];

/** Picking a way of travel in the editor also picks how the leg is drawn, unless the mode is set too. */
const MODE_FOR_TRANSPORT: Record<Transport, LegMode> = { bike: "ride", foot: "ride", bus: "hop", car: "ride", boat: "hop", flight: "hop" };

/**
 * Which router snaps a ridden leg. Touring by bike mostly follows the main road, which the car router picks;
 * the bike router prefers quiet side roads, and the foot router finds hiking trails.
 */
export const ROUTERS = ["car", "bike", "foot"] as const;
export type Router = (typeof ROUTERS)[number];

/** Hand corrections from the route editor; keyed by fix coordinates so they survive a re-import. */
export interface RouteEdits {
	/** Fixes to drop although the cleanup kept them. */
	remove: string[];
	/** Fixes to keep although the cleanup dropped them. */
	keep: string[];
	/** Per leg, keyed by `legKey`. */
	legs: Record<string, { mode?: LegMode; transport?: Transport; router?: Router; via?: Position[] }>;
	/**
	 * Fixes placed in the editor to split a leg, e.g. where a ride turns into a short hike. Each goes right
	 * after the fix keyed `after`, which may itself be an added one, and is never dropped by the cleanup.
	 */
	add?: { after: string; position: Position }[];
}

export const NO_EDITS: RouteEdits = { remove: [], keep: [], legs: {}, add: [] };

export type FixStatus = "kept" | "jitter" | "spike" | "excursion" | "stay" | "removed";

export interface CleanFix {
	key: string;
	position: Position;
	/** Index of the raw segment; the import starts a new one after every hop over 250 km. */
	segment: number;
	status: FixStatus;
	/** Fixes dropped together as one side trip share a group, so the editor can restore them at once. */
	group?: number;
}

export interface Leg {
	key: string;
	from: Position;
	to: Position;
	mode: LegMode;
	transport: Transport;
	router: Router;
	/** The mode, transport or router came from the editor rather than the heuristics. */
	edited: boolean;
	via: Position[];
	straightKm: number;
}

/** Haversine; legs include flights across half the globe, where the flat approximation in route.ts drifts. */
export function greatCircleKm([lon1, lat1]: Position, [lon2, lat2]: Position): number {
	const radians = Math.PI / 180;
	const a = Math.sin(((lat2 - lat1) * radians) / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(((lon2 - lon1) * radians) / 2) ** 2;
	return 12742 * Math.asin(Math.sqrt(a));
}

export function legKey(from: Position, to: Position): string {
	return `${fixKey(from)}>${fixKey(to)}`;
}

export interface CleanupOptions {
	/** A fix closer than this to the last kept one is GPS jitter around a standstill. */
	minSpacingKm: number;
	/** A single fix this far out whose neighbours sit close together is a spike. */
	spikeKm: number;
	spikeRatio: number;
	/** A side trip that comes back within `loopKm` of where it left... */
	loopKm: number;
	/** ...and never strays further than this (a day trip, walks around town)... */
	excursionKm: number;
	/** ...looked for within this much track after the fix it leaves from. */
	excursionWindowKm: number;
	/** At least `stayFixes` fixes in a row within `stayKm` of the first are days spent in one place. */
	stayKm: number;
	stayFixes: number;
	/** Legs longer than this were not ridden: flights, buses, trains. */
	hopKm: number;
	/** Hops longer than this were flown; shorter ones default to the bus. */
	flightKm: number;
}

export const CLEANUP: CleanupOptions = {
	minSpacingKm: 0.3,
	spikeKm: 0.5,
	spikeRatio: 0.35,
	loopKm: 0.6,
	excursionKm: 25,
	excursionWindowKm: 150,
	stayKm: 3,
	stayFixes: 8,
	hopKm: 80,
	flightKm: 500,
};

/**
 * Drops jitter, spikes and back-and-forth side trips from the GPS fixes. The router later draws the road
 * between the fixes that remain, so dropping the middle of a switchback or a detour costs nothing.
 */
export function cleanFixes(segments: Position[][], edits: RouteEdits = NO_EDITS, options: CleanupOptions = CLEANUP): CleanFix[] {
	const remove = new Set(edits.remove);
	const keep = new Set([...edits.keep, ...(edits.add ?? []).map((added) => fixKey(added.position))]);
	const withAdded = segments.map((segment) => [...segment]);
	for (const { after, position } of edits.add ?? []) {
		for (const segment of withAdded) {
			const index = segment.findIndex((candidate) => fixKey(candidate) === after);
			if (index === -1) continue;
			segment.splice(index + 1, 0, position);
			break;
		}
	}
	const fixes: CleanFix[] = withAdded.flatMap((segment, index) =>
		segment.map((position): CleanFix => ({ key: fixKey(position), position, segment: index, status: "kept" })),
	);
	const pinned = (fix: CleanFix) => keep.has(fix.key);

	for (const fix of fixes) if (remove.has(fix.key)) fix.status = "removed";

	let last: CleanFix | undefined;
	for (const [index, fix] of fixes.entries()) {
		if (fix.status !== "kept") continue;
		const segmentEnd = fixes[index + 1]?.segment !== fix.segment;
		const segmentStart = last?.segment !== fix.segment;
		if (!segmentStart && !segmentEnd && !pinned(fix) && distanceKm(last!.position, fix.position) < options.minSpacingKm) {
			fix.status = "jitter";
			continue;
		}
		last = fix;
	}

	dropSpikes(fixes, pinned, options);

	const kept = () => fixes.filter((fix) => fix.status === "kept");
	let group = 0;
	const candidates = kept();
	for (let start = 0; start < candidates.length; start++) {
		const origin = candidates[start];
		let travelled = 0;
		let furthest = 0;
		let returnTo = -1;
		for (let index = start + 1; index < candidates.length && candidates[index].segment === origin.segment; index++) {
			travelled += distanceKm(candidates[index - 1].position, candidates[index].position);
			if (travelled > options.excursionWindowKm) break;
			const away = distanceKm(origin.position, candidates[index].position);
			furthest = Math.max(furthest, away);
			if (furthest > options.excursionKm) break;
			if (index >= start + 2 && away < options.loopKm) returnTo = index;
		}
		if (returnTo === -1) continue;
		const between = candidates.slice(start + 1, returnTo);
		if (between.some(pinned)) continue;
		group++;
		for (const fix of between) {
			fix.status = "excursion";
			fix.group = group;
		}
		start = returnTo - 1;
	}

	// Days in one town: keep where the stay began and ended, the router joins the two.
	const remaining = kept();
	for (let start = 0; start < remaining.length; start++) {
		let end = start + 1;
		while (end < remaining.length && remaining[end].segment === remaining[start].segment && distanceKm(remaining[start].position, remaining[end].position) <= options.stayKm) end++;
		const between = remaining.slice(start + 1, end - 1);
		if (end - start < options.stayFixes || between.some(pinned)) continue;
		group++;
		for (const fix of between) {
			fix.status = "stay";
			fix.group = group;
		}
		start = end - 2;
	}

	dropSpikes(fixes, pinned, options);
	return fixes;
}

function dropSpikes(fixes: CleanFix[], pinned: (fix: CleanFix) => boolean, options: CleanupOptions) {
	let changed = true;
	while (changed) {
		changed = false;
		const kept = fixes.filter((fix) => fix.status === "kept");
		for (let index = 1; index < kept.length - 1; index++) {
			const [before, fix, after] = [kept[index - 1], kept[index], kept[index + 1]];
			if (before.segment !== fix.segment || after.segment !== fix.segment || pinned(fix)) continue;
			const out = distanceKm(before.position, fix.position);
			if (out > options.spikeKm && distanceKm(before.position, after.position) < out * options.spikeRatio) {
				fix.status = "spike";
				changed = true;
				index++;
			}
		}
	}
}

/** Consecutive kept fixes as legs. Legs across a segment break or longer than `hopKm` are hops. */
export function buildLegs(fixes: CleanFix[], edits: RouteEdits = NO_EDITS, options: CleanupOptions = CLEANUP): Leg[] {
	const kept = fixes.filter((fix) => fix.status === "kept");
	const legs: Leg[] = [];
	for (let index = 1; index < kept.length; index++) {
		const [from, to] = [kept[index - 1], kept[index]];
		const key = legKey(from.position, to.position);
		const straightKm = greatCircleKm(from.position, to.position);
		const edit = edits.legs[key];
		const hop = from.segment !== to.segment || straightKm > options.hopKm;
		const transport: Transport = edit?.transport ?? (!hop ? "bike" : straightKm > options.flightKm ? "flight" : "bus");
		const mode: LegMode = edit?.mode ?? (edit?.transport ? MODE_FOR_TRANSPORT[edit.transport] : hop ? "hop" : "ride");
		const router: Router = edit?.router ?? (transport === "foot" ? "foot" : "car");
		const edited = edit?.mode !== undefined || edit?.transport !== undefined || edit?.router !== undefined;
		legs.push({ key, from: from.position, to: to.position, mode, transport, router, edited, via: edit?.via ?? [], straightKm });
	}
	return legs;
}

/** Road geometry for one leg, as the router returned it. */
export interface SnappedLeg {
	coordinates: Position[];
	distanceKm: number;
}

/**
 * A leg is cached under its endpoints plus any via points, so moving a via point snaps it afresh, and under its
 * router, so switching routers never reuses another router's way. Car routes keep the bare key they were
 * cached under before there was a choice; `hike:` replaced an earlier foot router that missed many trails.
 */
export function snapKey(leg: Pick<Leg, "key" | "via" | "router">): string {
	const key = leg.via.length === 0 ? leg.key : `${leg.key}|${leg.via.map(fixKey).join(";")}`;
	if (leg.router === "foot") return `hike:${key}`;
	if (leg.router === "bike") return `bike:${key}`;
	return key;
}

/**
 * The router answers a waypoint beside a dead-end road by driving in and straight back out. Cuts any stretch
 * that returns within `toleranceKm` of a point it passed at most `maxSpurKm` earlier.
 */
export function removeSpurs(line: Position[], maxSpurKm = 2, toleranceKm = 0.015): Position[] {
	if (line.length < 3) return line;
	const cumulative = cumulativeKm(line);
	const result: Position[] = [];
	for (let index = 0; index < line.length; index++) {
		result.push(line[index]);
		let rejoin = -1;
		for (let ahead = index + 2; ahead < line.length && cumulative[ahead] - cumulative[index] <= maxSpurKm; ahead++) {
			if (distanceKm(line[index], line[ahead]) < toleranceKm) rejoin = ahead;
		}
		if (rejoin !== -1) index = rejoin;
	}
	return result;
}

/**
 * The map's route: one line per stretch between hops. Ridden legs follow the road once snapped and stay
 * straight until then, or when the router could only reach the next fix by a long detour.
 */
export function assembleRoute(legs: Leg[], snapped: (leg: Leg) => SnappedLeg | undefined, tolerance: number): Position[][] {
	const lines: Position[][] = [];
	let line: Position[] = [];
	const finish = () => {
		if (line.length > 1) lines.push(simplify(removeSpurs(line), tolerance));
		line = [];
	};
	for (const leg of legs) {
		if (leg.mode === "hop") {
			finish();
			continue;
		}
		if (line.length === 0) line.push(leg.from);
		const road = leg.mode === "ride" ? snapped(leg) : undefined;
		const usable = road && road.coordinates.length > 1 && !isLongDetour(leg, road);
		line.push(...(usable ? road.coordinates.slice(1) : [...leg.via, leg.to]));
	}
	finish();
	return lines;
}

/** Same rule as `isDetour` in route.ts, except that a leg routed through via points was drawn on purpose. */
export function isLongDetour(leg: Leg, road: SnappedLeg, maxDetour = 2.5, minExtraKm = 1): boolean {
	if (leg.via.length > 0) return false;
	return road.distanceKm > leg.straightKm * maxDetour && road.distanceKm - leg.straightKm > minExtraKm;
}
