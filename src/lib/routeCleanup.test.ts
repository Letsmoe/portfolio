import { describe, expect, test } from "bun:test";
import type { Position } from "./route";
import { assembleRoute, buildLegs, cleanFixes, CLEANUP, fixKey, legKey, NO_EDITS, removeSpurs, snapKey, type Leg } from "./routeCleanup";

/** ~1.1 km per 0.01° of latitude; longitude 0 keeps the arithmetic simple. */
const north = (km: number): Position => [0, km / 111.2];
const east = (km: number, fromKm = 0): Position => [km / 111.2, fromKm / 111.2];

const statuses = (segments: Position[][], edits = NO_EDITS) => cleanFixes(segments, edits).map((fix) => fix.status);

describe("cleanFixes", () => {
	test("thins jitter around a standstill but keeps the ends of every segment", () => {
		expect(statuses([[north(0), north(0.05), north(0.1), north(1), north(1.05)]])).toEqual(["kept", "jitter", "jitter", "kept", "kept"]);
	});

	test("places added fixes after the fix they follow, in the order they were split, and keeps them", () => {
		// The second split falls between the first fix and the first added one, as the editor stores it.
		const add = [
			{ after: fixKey(north(0)), position: north(4) },
			{ after: fixKey(north(0)), position: north(2) },
			{ after: fixKey(north(4)), position: north(4.1) },
		];
		const fixes = cleanFixes([[north(0), north(10)]], { ...NO_EDITS, add });
		expect(fixes.map((fix) => fix.position)).toEqual([north(0), north(2), north(4), north(4.1), north(10)]);
		expect(fixes.every((fix) => fix.status === "kept")).toBe(true);
		expect(buildLegs(fixes)).toHaveLength(4);
	});

	test("drops a single fix that jumps out and straight back", () => {
		expect(statuses([[north(0), north(1), east(3, 1), north(1.2), north(2.5)]])).toEqual(["kept", "kept", "spike", "kept", "kept"]);
	});

	test("drops a day trip that returns to where it left", () => {
		const trip = [north(0), north(1), east(3, 1), east(6, 3), east(3, 5), north(1.2), north(3)];
		const fixes = cleanFixes([trip]);
		expect(fixes.map((fix) => fix.status)).toEqual(["kept", "kept", "excursion", "excursion", "excursion", "kept", "kept"]);
		expect(new Set(fixes.filter((fix) => fix.group).map((fix) => fix.group)).size).toBe(1);
	});

	test("keeps only the arrival and departure of a stay in one place", () => {
		const stay = [north(0), north(10), east(1, 10), east(2, 10.5), east(1, 11.5), east(0, 12), east(1.5, 12.2), east(2.5, 11), east(1, 10.8), north(20)];
		// Without the side-trip rule, which would otherwise claim part of this wandering first.
		const fixes = cleanFixes([stay], NO_EDITS, { ...CLEANUP, loopKm: 0 });
		expect(fixes.map((fix) => fix.status)).toEqual(["kept", "kept", "stay", "stay", "stay", "stay", "stay", "stay", "kept", "kept"]);
		expect(new Set(fixes.filter((fix) => fix.status === "stay").map((fix) => fix.group)).size).toBe(1);
	});

	test("keeps a trip that strays further than a day trip", () => {
		const longTrip = [north(0), north(1), east(24, 1), east(48, 24), east(24, 40), north(1.2), north(3)];
		expect(statuses([longTrip]).every((status) => status === "kept")).toBe(true);
	});

	test("editor overrides win over the heuristics", () => {
		const trip = [north(0), north(1), east(3, 1), north(1.2), north(3)];
		expect(statuses([trip], { remove: [fixKey(north(3))], keep: [fixKey(east(3, 1))], legs: {} })).toEqual(["kept", "kept", "kept", "kept", "removed"]);
	});
});

describe("buildLegs", () => {
	test("hops across segment breaks and over long gaps, rides otherwise", () => {
		const fixes = cleanFixes([[north(0), north(2), north(100)], [north(500), north(502)]]);
		expect(buildLegs(fixes).map((leg) => leg.mode)).toEqual(["ride", "hop", "hop", "ride"]);
	});

	test("flies long hops, buses short ones and rides the rest", () => {
		const fixes = cleanFixes([[north(0), north(2), north(100)], [north(1000), north(1002)]]);
		expect(buildLegs(fixes).map((leg) => leg.transport)).toEqual(["bike", "bus", "flight", "bike"]);
	});

	test("a transport picked in the editor brings its drawing mode along", () => {
		const fixes = cleanFixes([[north(0), north(2)]]);
		const [leg] = buildLegs(fixes, { remove: [], keep: [], legs: { [legKey(north(0), north(2))]: { transport: "bus" } } });
		expect(leg).toMatchObject({ transport: "bus", mode: "hop", edited: true });
	});

	test("a car ride snaps to roads", () => {
		const fixes = cleanFixes([[north(0), north(2)]]);
		const [leg] = buildLegs(fixes, { remove: [], keep: [], legs: { [legKey(north(0), north(2))]: { transport: "car" } } });
		expect(leg).toMatchObject({ transport: "car", mode: "ride", edited: true });
	});

	test("a boat is drawn as a hop", () => {
		const fixes = cleanFixes([[north(0), north(2)]]);
		const [leg] = buildLegs(fixes, { remove: [], keep: [], legs: { [legKey(north(0), north(2))]: { transport: "boat" } } });
		expect(leg).toMatchObject({ transport: "boat", mode: "hop", edited: true });
	});

	test("takes the mode and via points from the editor", () => {
		const fixes = cleanFixes([[north(0), north(2)]]);
		const key = legKey(north(0), north(2));
		const [leg] = buildLegs(fixes, { remove: [], keep: [], legs: { [key]: { mode: "straight", via: [east(1, 1)] } } });
		expect(leg).toMatchObject({ mode: "straight", edited: true, via: [east(1, 1)] });
		expect(snapKey(leg)).toBe(`${key}|${fixKey(east(1, 1))}`);
	});

	test("walking snaps to paths, under its own cache key", () => {
		const fixes = cleanFixes([[north(0), north(2)]]);
		const key = legKey(north(0), north(2));
		const [leg] = buildLegs(fixes, { remove: [], keep: [], legs: { [key]: { transport: "foot" } } });
		expect(leg).toMatchObject({ transport: "foot", mode: "ride", router: "foot" });
		expect(snapKey(leg)).toBe(`hike:${key}`);
	});

	test("a router picked in the editor wins over the transport's, and caches apart", () => {
		const fixes = cleanFixes([[north(0), north(2)]]);
		const key = legKey(north(0), north(2));
		const [onTrail] = buildLegs(fixes, { remove: [], keep: [], legs: { [key]: { router: "foot" } } });
		expect(onTrail).toMatchObject({ transport: "bike", router: "foot", edited: true });
		const [sideRoads] = buildLegs(fixes, { remove: [], keep: [], legs: { [key]: { transport: "foot", router: "bike" } } });
		expect(snapKey(sideRoads)).toBe(`bike:${key}`);
		const [byDefault] = buildLegs(fixes);
		expect([byDefault.router, snapKey(byDefault)]).toEqual(["car", key]);
	});
});

describe("removeSpurs", () => {
	test("cuts an in-and-out spur down a side road", () => {
		const line = [north(0), north(1), east(0.5, 1), north(1), north(2)];
		expect(removeSpurs(line)).toEqual([north(0), north(1), north(2)]);
	});

	test("leaves a line that never doubles back alone", () => {
		const line = [north(0), north(1), east(0.5, 1.5), north(2)];
		expect(removeSpurs(line)).toEqual(line);
	});
});

describe("assembleRoute", () => {
	const leg = (from: Position, to: Position, mode: Leg["mode"]): Leg => ({ key: legKey(from, to), from, to, mode, transport: "bike", router: "car", edited: false, via: [], straightKm: 1 });

	test("splits at hops and draws unsnapped legs straight", () => {
		const legs = [leg(north(0), north(1), "ride"), leg(north(1), north(400), "hop"), leg(north(400), north(401), "straight")];
		expect(assembleRoute(legs, () => undefined, 0)).toEqual([
			[north(0), north(1)],
			[north(400), north(401)],
		]);
	});

	test("follows the road once a leg is snapped", () => {
		const road = [north(0), east(0.2, 0.5), north(1)];
		expect(assembleRoute([leg(north(0), north(1), "ride")], () => ({ coordinates: road, distanceKm: 1.1 }), 0)).toEqual([road]);
	});
});
