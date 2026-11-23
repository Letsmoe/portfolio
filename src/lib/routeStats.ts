import { climb, distanceKm, type Position } from "#lib/route.ts";
import { TRANSPORTS, type Transport } from "#lib/routeCleanup.ts";

export type TransportKm = Record<Transport, number>;

/** One country chapter of the journey page; written by `scripts/route/snap.ts`. */
export interface SectionStats {
	/** Slug of the chapter's first step, which identifies the chapter on the journey page. */
	firstSlug: string;
	km: TransportKm;
	ascent: number;
	descent: number;
	highest: number | null;
	/** [kilometres under own power, metres above sea level]; motorised legs are left out. */
	profile: [number, number][];
}

export interface RouteStats {
	km: TransportKm;
	totalKm: number;
	withoutFlightsKm: number;
	ascent: number;
	descent: number;
	highest: number | null;
	sections: SectionStats[];
}

/** Legs covered on one's own power, the ones that climb. */
export const SELF_POWERED: Transport[] = ["bike", "foot"];

const PROFILE_POINTS = 160;

/**
 * For each step, the index of the fix it was posted from. Steps and fixes are both in travel order, so the
 * matches never run backwards; within that, the total distance between steps and their fixes is the smallest
 * possible. That keeps a step from snapping to a later visit of the same place.
 */
export function alignSteps(steps: Position[], fixes: Position[]): number[] {
	if (steps.length === 0 || fixes.length === 0) return steps.map(() => 0);
	const choices = new Int32Array(steps.length * fixes.length);
	let previous = new Float64Array(fixes.length);
	let current = new Float64Array(fixes.length);
	for (let step = 0; step < steps.length; step++) {
		let best = Infinity;
		let bestFix = 0;
		for (let fix = 0; fix < fixes.length; fix++) {
			if (step > 0 && previous[fix] < best) {
				best = previous[fix];
				bestFix = fix;
			}
			current[fix] = distanceKm(steps[step], fixes[fix]) + (step > 0 ? best : 0);
			choices[step * fixes.length + fix] = bestFix;
		}
		[previous, current] = [current, previous];
	}
	let fix = previous.indexOf(Math.min(...previous));
	const matches = new Array<number>(steps.length);
	for (let step = steps.length - 1; step >= 0; step--) {
		matches[step] = fix;
		fix = choices[step * fixes.length + fix];
	}
	return matches;
}

export interface LegSample {
	transport: Transport;
	km: number;
	/** Index into the sections. */
	section: number;
	/** Elevations at even steps along the leg, both ends included; empty for motorised legs. */
	elevations: number[];
}

function emptyKm(): TransportKm {
	return Object.fromEntries(TRANSPORTS.map((transport) => [transport, 0])) as TransportKm;
}

/** Every `step`-th point and the last one, so a long profile stays a few kilobytes. */
function thin(profile: [number, number][], points: number): [number, number][] {
	if (profile.length <= points) return profile;
	const step = profile.length / points;
	const thinned = Array.from({ length: points }, (_, index) => profile[Math.floor(index * step)]);
	thinned.push(profile[profile.length - 1]);
	return thinned;
}

export function buildRouteStats(legs: LegSample[], sectionSlugs: string[]): RouteStats {
	const sections: SectionStats[] = sectionSlugs.map((firstSlug) => ({ firstSlug, km: emptyKm(), ascent: 0, descent: 0, highest: null, profile: [] }));
	const runs: number[][][] = sectionSlugs.map(() => []);
	const travelled = sectionSlugs.map(() => 0);
	let lastSection = -1;
	let inRun = false;

	for (const leg of legs) {
		const section = sections[leg.section];
		section.km[leg.transport] += leg.km;
		if (leg.elevations.length === 0) {
			inRun = false;
			continue;
		}
		// A run of climbing breaks at every bus or flight, so the jump between its ends is not counted as a climb.
		if (!inRun || lastSection !== leg.section) runs[leg.section].push([]);
		const run = runs[leg.section].at(-1)!;
		const spacing = leg.km / Math.max(leg.elevations.length - 1, 1);
		const start = travelled[leg.section];
		// Consecutive legs share their joining point; it is only counted once.
		for (let index = run.length === 0 ? 0 : 1; index < leg.elevations.length; index++) {
			run.push(leg.elevations[index]);
			section.profile.push([Number((start + index * spacing).toFixed(2)), Math.round(leg.elevations[index])]);
		}
		travelled[leg.section] += leg.km;
		inRun = true;
		lastSection = leg.section;
	}

	for (const [index, section] of sections.entries()) {
		for (const run of runs[index]) {
			const { ascent, descent } = climb(run);
			section.ascent += ascent;
			section.descent += descent;
		}
		section.highest = section.profile.length > 0 ? Math.max(...section.profile.map(([, metres]) => metres)) : null;
		section.profile = thin(section.profile, PROFILE_POINTS);
		for (const transport of TRANSPORTS) section.km[transport] = Math.round(section.km[transport]);
	}

	const km = emptyKm();
	for (const section of sections) for (const transport of TRANSPORTS) km[transport] += section.km[transport];
	const totalKm = TRANSPORTS.reduce((sum, transport) => sum + km[transport], 0);
	const highs = sections.flatMap((section) => (section.highest === null ? [] : [section.highest]));
	return {
		km,
		totalKm,
		withoutFlightsKm: totalKm - km.flight,
		ascent: sections.reduce((sum, section) => sum + section.ascent, 0),
		descent: sections.reduce((sum, section) => sum + section.descent, 0),
		highest: highs.length > 0 ? Math.max(...highs) : null,
		sections,
	};
}
