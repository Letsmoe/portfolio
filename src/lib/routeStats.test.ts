import { describe, expect, test } from "bun:test";
import type { Position } from "./route";
import { alignSteps, buildRouteStats, type LegSample } from "./routeStats";

describe("alignSteps", () => {
	test("matches each step to its nearest fix without running backwards", () => {
		// The route passes x = 0 twice; the second step belongs to the later visit.
		const fixes: Position[] = [[0, 0], [1, 0], [2, 0], [1, 0.01], [0, 0.01], [-1, 0]];
		expect(alignSteps([[2, 0], [0, 0], [-1, 0]], fixes)).toEqual([2, 4, 5]);
	});
});

describe("buildRouteStats", () => {
	const leg = (transport: LegSample["transport"], km: number, section: number, elevations: number[] = []): LegSample => ({ transport, km, section, elevations });

	test("adds up kilometres per transport, with and without flights", () => {
		const stats = buildRouteStats([leg("bike", 10, 0, [0, 0]), leg("flight", 900, 0), leg("bus", 120, 1), leg("foot", 5, 1, [0, 0])], ["a", "b"]);
		expect(stats.km).toEqual({ bike: 10, foot: 5, bus: 120, car: 0, boat: 0, flight: 900 });
		expect([stats.totalKm, stats.withoutFlightsKm]).toEqual([1035, 135]);
		expect(stats.sections.map((section) => section.km.bus)).toEqual([0, 120]);
	});

	test("climbs only under own power and never across a bus ride", () => {
		const stats = buildRouteStats([leg("bike", 2, 0, [100, 150, 200]), leg("bike", 2, 0, [200, 250, 300]), leg("bus", 50, 0), leg("bike", 2, 0, [1000, 1050, 1100])], ["a"]);
		expect([stats.ascent, stats.descent, stats.highest]).toEqual([300, 0, 1100]);
		expect(stats.sections[0].profile).toEqual([
			[0, 100],
			[1, 150],
			[2, 200],
			[3, 250],
			[4, 300],
			[4, 1000],
			[5, 1050],
			[6, 1100],
		]);
	});
});
