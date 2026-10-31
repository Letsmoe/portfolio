import { describe, expect, test } from "bun:test";
import { cellLight, createPrayerFlags, FLAG_COLUMNS, FLAG_ROWS, nearestFabric, stepCloth, type Cloth } from "./cloth";

function maxStretch(cloth: Cloth) {
	let stretch = 0;
	for (const { a, b, rest } of cloth.constraints) {
		stretch = Math.max(stretch, Math.hypot(cloth.x[b] - cloth.x[a], cloth.y[b] - cloth.y[a], cloth.z[b] - cloth.z[a]) / rest);
	}
	return stretch;
}

describe("createPrayerFlags", () => {
	test("hangs flags from the string, pinned only at both ends", () => {
		const cloth = createPrayerFlags(1200, 220);
		expect(cloth.flags.length).toBeGreaterThan(10);
		const pinned = [...cloth.pinned].flatMap((value, index) => (value ? [index] : []));
		expect(pinned).toEqual([cloth.rope[0], cloth.rope[cloth.rope.length - 1]]);
		for (const flag of cloth.flags) {
			expect(flag.grid.length).toBe(FLAG_ROWS);
			expect(flag.grid[0].every((index) => cloth.rope.includes(index))).toBe(true);
			expect(flag.grid.every((row) => row.length === FLAG_COLUMNS)).toBe(true);
		}
	});
});

describe("stepCloth", () => {
	test("stays stable through half a minute of wind without stretching or leaving the strip", () => {
		const cloth = createPrayerFlags(1200, 220);
		for (let step = 0; step < 1800; step++) stepCloth(cloth);
		const positions = [...cloth.x, ...cloth.y, ...cloth.z];
		expect(positions.every(Number.isFinite)).toBe(true);
		expect(Math.min(...cloth.y)).toBeGreaterThan(0);
		expect(Math.max(...cloth.y)).toBeLessThan(220);
		expect(maxStretch(cloth)).toBeLessThan(1.1);
	}, 20_000);

	test("the wind moves the flags", () => {
		const cloth = createPrayerFlags(1200, 220);
		const corner = cloth.flags[4].grid[FLAG_ROWS - 1][FLAG_COLUMNS - 1];
		const depths: number[] = [];
		for (let step = 0; step < 1200; step++) {
			stepCloth(cloth);
			depths.push(cloth.z[corner]);
		}
		expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(20);
	});

	test("a grabbed particle follows the pointer and the cloth holds together after release", () => {
		const cloth = createPrayerFlags(800, 220);
		const corner = cloth.flags[2].grid[FLAG_ROWS - 1][0];
		cloth.grabbed = nearestFabric(cloth, cloth.x[corner], cloth.y[corner]);
		expect(cloth.grabbed).toBe(corner);
		const target = { x: cloth.x[corner] + 40, y: cloth.y[corner] + 30 };
		for (let step = 0; step < 30; step++) stepCloth(cloth, { ...target, deltaX: 0, deltaY: 0 });
		expect(cloth.x[corner]).toBeCloseTo(target.x, 0);
		expect(cloth.y[corner]).toBeCloseTo(target.y, 0);
		cloth.grabbed = -1;
		for (let step = 0; step < 600; step++) stepCloth(cloth);
		expect(maxStretch(cloth)).toBeLessThan(1.1);
	});
});

describe("cellLight", () => {
	test("a cell facing the viewer is lit, one edge-on is dark", () => {
		const cloth = createPrayerFlags(800, 220);
		const [a, b] = cloth.flags[0].grid[1];
		const c = cloth.flags[0].grid[2][0];
		expect(cellLight(cloth, a, b, c)).toBeCloseTo(0.87, 2);
		// Fold the lower corner straight back, so the cell is seen side-on from above.
		cloth.y[c] = cloth.y[a];
		cloth.z[c] = -10;
		expect(cellLight(cloth, a, b, c)).toBeLessThan(0.45);
	});
});
