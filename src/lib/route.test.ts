import { describe, expect, it } from "bun:test";
import { climb, cumulativeKm, distanceKm, kilometresAlong, lengthKm, positionAt, resample, simplify, stitchLegs, type Position } from "./route";

describe("distanceKm", () => {
	it("measures one degree of latitude as about 111 km", () => {
		expect(distanceKm([110, -7], [110, -8])).toBeCloseTo(111.2, 0);
	});
});

describe("stitchLegs", () => {
	const fixes: Position[] = [
		[0, 0],
		[0, 0.01],
		[0, 0.02],
	];

	it("joins road geometry without repeating the shared fixes", () => {
		const line = stitchLegs(fixes, [
			{ coordinates: [[0, 0], [0.001, 0.005], [0, 0.01]], distanceKm: 1.2 },
			{ coordinates: [[0, 0.01], [0, 0.02]], distanceKm: 1.1 },
		]);
		expect(line).toEqual([[0, 0], [0.001, 0.005], [0, 0.01], [0, 0.02]]);
	});

	it("keeps a leg straight when the router detours far beyond the fixes", () => {
		const spike: Position[] = [[0, 0.01], [0.05, 0.015], [0, 0.02]];
		const line = stitchLegs(fixes, [
			{ coordinates: [[0, 0], [0, 0.01]], distanceKm: 1.1 },
			{ coordinates: spike, distanceKm: 11 },
		]);
		expect(line).toEqual([[0, 0], [0, 0.01], [0, 0.02]]);
	});

	it("accepts a long detour ratio when the extra distance is small", () => {
		const close: Position[] = [[0, 0], [0, 0.001]];
		const line = stitchLegs(close, [{ coordinates: [[0, 0], [0.001, 0.0005], [0, 0.001]], distanceKm: 0.5 }]);
		expect(line).toHaveLength(3);
	});
});

describe("simplify", () => {
	it("drops points that lie on the line between their neighbours", () => {
		expect(simplify([[0, 0], [1, 0.00001], [2, 0]], 0.001)).toEqual([[0, 0], [2, 0]]);
	});

	it("keeps corners", () => {
		expect(simplify([[0, 0], [1, 1], [2, 0]], 0.001)).toEqual([[0, 0], [1, 1], [2, 0]]);
	});
});

describe("kilometresAlong", () => {
	const line: Position[] = [
		[0, 0],
		[0, 0.1],
		[0, 0.2],
		[0, 0.1],
		[0, 0],
	];

	it("measures each place along the line in travel order", () => {
		const [start, turn, end] = kilometresAlong(line, [[0, 0], [0, 0.2], [0, 0]]);
		expect(start).toBe(0);
		expect(turn).toBeCloseTo(lengthKm(line.slice(0, 3)), 6);
		expect(end).toBeCloseTo(lengthKm(line), 6);
	});
});

describe("positionAt", () => {
	const line: Position[] = [
		[0, 0],
		[0, 1],
		[0, 2],
	];
	const cumulative = cumulativeKm(line);

	it("interpolates between vertices", () => {
		const [lon, lat] = positionAt(line, cumulative, cumulative[1] * 1.5);
		expect(lon).toBe(0);
		expect(lat).toBeCloseTo(1.5, 6);
	});

	it("clamps to the ends", () => {
		expect(positionAt(line, cumulative, -5)).toEqual([0, 0]);
		expect(positionAt(line, cumulative, 10_000)).toEqual([0, 2]);
	});
});

describe("resample", () => {
	it("samples at even distances and keeps the end", () => {
		const line: Position[] = [
			[0, 0],
			[0, 0.1],
		];
		const samples = resample(line, 2);
		const total = lengthKm(line);
		expect(samples.map((sample) => sample.km)).toEqual([...Array.from({ length: Math.ceil(total / 2) }, (_, index) => index * 2), total]);
		expect(samples.at(-1)?.position).toEqual([0, 0.1]);
	});
});

describe("climb", () => {
	it("ignores wobble below the threshold", () => {
		expect(climb([100, 104, 99, 103, 100])).toEqual({ ascent: 0, descent: 0 });
	});

	it("counts real climbs and descents", () => {
		expect(climb([100, 150, 145, 300, 120])).toEqual({ ascent: 200, descent: 180 });
	});
});
