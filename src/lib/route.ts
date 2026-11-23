/** [longitude, latitude], as in GeoJSON. */
export type Position = [number, number];

export interface SectionStop {
	slug: string;
	name: string;
	country: string;
	countryCode: string;
	time: string;
	timezone: string;
	lon: number;
	lat: number;
	/** 96px square photo of the step, if it has one. */
	micro: string | null;
	/** Distance from the section's first step along the road route. */
	kilometres: number;
}

export interface SectionPhoto {
	src: string;
	thumb: string;
	width: number;
	height: number;
	/** Index into `SectionRoute.stops`. */
	stop: number;
}

/** One stretch of the trip told in a single blog post; written by `scripts/section-route.ts`. */
export interface SectionRoute {
	slug: string;
	kilometres: number;
	/** Road-snapped route. */
	route: Position[];
	stops: SectionStop[];
	photos: SectionPhoto[];
	/** [kilometres along the route, metres above sea level], sampled at even intervals. */
	profile: [number, number][];
	ascent: number;
	descent: number;
}

/** Distance from the start of `line` to each of its vertices. */
export function cumulativeKm(line: Position[]): number[] {
	const cumulative = [0];
	for (let index = 1; index < line.length; index++) cumulative.push(cumulative[index - 1] + distanceKm(line[index - 1], line[index]));
	return cumulative;
}

/** The point `km` along `line`, interpolated between vertices; `cumulative` comes from `cumulativeKm`. */
export function positionAt(line: Position[], cumulative: number[], km: number): Position {
	if (km <= 0) return line[0];
	if (km >= cumulative[cumulative.length - 1]) return line[line.length - 1];
	let low = 0;
	let high = cumulative.length - 1;
	while (high - low > 1) {
		const middle = (low + high) >> 1;
		if (cumulative[middle] <= km) low = middle;
		else high = middle;
	}
	const span = cumulative[high] - cumulative[low];
	const fraction = span === 0 ? 0 : (km - cumulative[low]) / span;
	return [line[low][0] + (line[high][0] - line[low][0]) * fraction, line[low][1] + (line[high][1] - line[low][1]) * fraction];
}

/** Points every `everyKm` along `line`, always including both ends. */
export function resample(line: Position[], everyKm: number): { km: number; position: Position }[] {
	const cumulative = cumulativeKm(line);
	const total = cumulative[cumulative.length - 1];
	const samples: { km: number; position: Position }[] = [];
	for (let km = 0; km < total; km += everyKm) samples.push({ km, position: positionAt(line, cumulative, km) });
	samples.push({ km: total, position: line[line.length - 1] });
	return samples;
}

/**
 * Total climb and descent. A terrain model wobbles by a few metres between neighbouring samples, and
 * summing every wobble inflates the climb; changes only count once they exceed `threshold` metres.
 */
export function climb(elevations: number[], threshold = 10): { ascent: number; descent: number } {
	let ascent = 0;
	let descent = 0;
	let reference = elevations[0] ?? 0;
	for (const elevation of elevations) {
		const change = elevation - reference;
		if (Math.abs(change) < threshold) continue;
		if (change > 0) ascent += change;
		else descent -= change;
		reference = elevation;
	}
	return { ascent: Math.round(ascent), descent: Math.round(descent) };
}

/** Equirectangular approximation; accurate to well under 1% at the distances between GPS fixes. */
export function distanceKm([lon1, lat1]: Position, [lon2, lat2]: Position): number {
	const radians = Math.PI / 180;
	const x = (lon2 - lon1) * radians * Math.cos(((lat1 + lat2) / 2) * radians);
	const y = (lat2 - lat1) * radians;
	return Math.hypot(x, y) * 6371;
}

export function lengthKm(line: Position[]): number {
	let total = 0;
	for (let index = 1; index < line.length; index++) total += distanceKm(line[index - 1], line[index]);
	return total;
}

export interface RoutedLeg {
	/** Road geometry from one GPS fix to the next. */
	coordinates: Position[];
	distanceKm: number;
}

/**
 * A leg the router made much longer than the straight line between its fixes. That is usually a fix off
 * the road network (a compound, a ferry deck, a truck bed), answered with an out-and-back spike.
 */
export function isDetour(from: Position, to: Position, leg: RoutedLeg, maxDetour = 2.5, minExtraKm = 1): boolean {
	const straightKm = distanceKm(from, to);
	return leg.distanceKm > straightKm * maxDetour && leg.distanceKm - straightKm > minExtraKm;
}

/** Joins the road geometry between consecutive fixes into one line; detours stay straight. */
export function stitchLegs(fixes: Position[], legs: RoutedLeg[]): Position[] {
	const line: Position[] = [fixes[0]];
	legs.forEach((leg, index) => {
		const keepStraight = isDetour(fixes[index], fixes[index + 1], leg) || leg.coordinates.length < 2;
		line.push(...(keepStraight ? [fixes[index + 1]] : leg.coordinates.slice(1)));
	});
	return line;
}

/** Douglas–Peucker with the tolerance in degrees. */
export function simplify(line: Position[], tolerance: number): Position[] {
	if (line.length < 3) return line;
	const [startLon, startLat] = line[0];
	const [endLon, endLat] = line[line.length - 1];
	const spanLon = endLon - startLon;
	const spanLat = endLat - startLat;
	const span = Math.hypot(spanLon, spanLat);
	let furthest = 0;
	let furthestDistance = 0;
	for (let index = 1; index < line.length - 1; index++) {
		const [lon, lat] = line[index];
		const distance = span === 0 ? Math.hypot(lon - startLon, lat - startLat) : Math.abs(spanLat * lon - spanLon * lat + endLon * startLat - endLat * startLon) / span;
		if (distance > furthestDistance) {
			furthest = index;
			furthestDistance = distance;
		}
	}
	if (furthestDistance <= tolerance) return [line[0], line[line.length - 1]];
	return [...simplify(line.slice(0, furthest + 1), tolerance).slice(0, -1), ...simplify(line.slice(furthest), tolerance)];
}

/**
 * Distance along `line` to the point nearest each of `places`, which must be in travel order. Each search
 * starts where the previous one matched, so a route that passes a place twice counts the right visit.
 */
export function kilometresAlong(line: Position[], places: Position[]): number[] {
	const cumulative = cumulativeKm(line);
	let from = 0;
	return places.map((place) => {
		let nearest = from;
		for (let index = from; index < line.length; index++) {
			if (distanceKm(line[index], place) < distanceKm(line[nearest], place)) nearest = index;
		}
		from = nearest;
		return cumulative[nearest];
	});
}
