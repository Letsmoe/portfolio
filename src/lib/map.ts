import type { Journey } from "#lib/journey.ts";

type Position = [lon: number, lat: number];

/** What the map needs up front; everything else loads when a stop is opened. */
export interface MapStop {
	slug: string;
	name: string;
	countryCode: string;
	lon: number;
	lat: number;
	time: string;
	timezone: string;
	micro: string | null;
}

export interface MapData {
	route: Position[][];
	stops: MapStop[];
}

export function toMapData(journey: Journey): MapData {
	return {
		route: journey.route,
		stops: journey.steps.map((step) => ({
			slug: step.slug,
			name: step.name,
			countryCode: step.countryCode,
			lon: step.lon,
			lat: step.lat,
			time: step.time,
			timezone: step.timezone,
			micro: step.photos[0]?.micro ?? null,
		})),
	};
}

/**
 * For every stop, the index of the closest stop along the route that has a photo
 * (itself if it has one, the earlier one on a tie), or -1 if no stop has a photo.
 */
export function nearestPhotoIndex(stops: Pick<MapStop, "micro">[]): number[] {
	const before: number[] = [];
	let last = -1;
	for (let index = 0; index < stops.length; index++) {
		if (stops[index].micro) last = index;
		before.push(last);
	}
	const nearest = new Array<number>(stops.length);
	let next = -1;
	for (let index = stops.length - 1; index >= 0; index--) {
		if (stops[index].micro) next = index;
		const previous = before[index];
		if (previous === -1) nearest[index] = next;
		else if (next === -1) nearest[index] = previous;
		else nearest[index] = index - previous <= next - index ? previous : next;
	}
	return nearest;
}

/**
 * Straight lines between the end of one segment and the start of the next.
 * Longitudes are unwrapped so a hop over the antimeridian takes the short way.
 */
export function routeHops(route: Position[][]): Position[][] {
	const hops: Position[][] = [];
	for (let index = 1; index < route.length; index++) {
		const from = route[index - 1].at(-1);
		const to = route[index][0];
		if (!from || !to) continue;
		let toLon = to[0];
		if (toLon - from[0] > 180) toLon -= 360;
		if (toLon - from[0] < -180) toLon += 360;
		hops.push([from, [toLon, to[1]]]);
	}
	return hops;
}

/** The first `fraction` of all route points, segment by segment; drives the draw-in animation. */
export function truncateRoute(route: Position[][], fraction: number): Position[][] {
	const total = route.reduce((sum, segment) => sum + segment.length, 0);
	let remaining = Math.round(total * Math.min(Math.max(fraction, 0), 1));
	const truncated: Position[][] = [];
	for (const segment of route) {
		if (remaining < 2) break;
		truncated.push(segment.slice(0, remaining));
		remaining -= segment.length;
	}
	return truncated;
}

export interface DropdownPlacement {
	left: number;
	/** Distance from the top of the map when opening downwards, otherwise from the bottom. */
	offset: number;
	below: boolean;
	/** Horizontal position of the pointer arrow inside the dropdown. */
	caret: number;
}

/**
 * Hangs a dropdown off a node at `anchor` (map pixels). It opens downwards in the
 * top half of the map and upwards in the bottom half, and never leaves the map sideways.
 */
export function placeDropdown(
	anchor: { x: number; y: number },
	dropdownWidth: number,
	map: { width: number; height: number },
	gap = 28,
	margin = 8,
): DropdownPlacement {
	const below = anchor.y < map.height * 0.55;
	const maxLeft = Math.max(margin, map.width - dropdownWidth - margin);
	const left = Math.min(Math.max(anchor.x - dropdownWidth / 2, margin), maxLeft);
	return {
		left,
		offset: below ? anchor.y + gap : map.height - anchor.y + gap,
		below,
		caret: Math.min(Math.max(anchor.x - left, 16), dropdownWidth - 16),
	};
}
