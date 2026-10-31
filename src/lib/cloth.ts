/**
 * Verlet cloth for a string of prayer flags: a rope pinned at both ends that sags under its own weight,
 * with flags whose top row of particles is part of the rope, so flags and string pull on each other.
 *
 * It runs in 3D. A flag fixed along its top edge cannot swing sideways in the picture plane, so real
 * flags move towards and away from the viewer; that depth is what makes them ripple and catch the light.
 */

/** Particles per flag across and down; the top row is part of the string itself. */
export const FLAG_COLUMNS = 5;
export const FLAG_ROWS = 7;
/** Empty string segments between two flags. */
const GAP_SEGMENTS = 1;
const GRAVITY = 1400;
/** Cotton flags are light: the wind moves them about as much as gravity pulls them down. */
const FABRIC_GRAVITY = 600;
const DAMPING = 0.985;
const ITERATIONS = 8;
export const STEP = 1 / 60;
const PUSH_RADIUS = 60;
const GRAB_RADIUS = 28;

export interface Flag {
	/** Particle indices, `grid[row][column]`; row 0 lies on the string. */
	grid: number[][];
	/** Index into the caller's palette. */
	colour: number;
}

export interface Cloth {
	x: Float32Array;
	y: Float32Array;
	/** Depth; positive is towards the viewer. */
	z: Float32Array;
	previousX: Float32Array;
	previousY: Float32Array;
	previousZ: Float32Array;
	pinned: Uint8Array;
	/** Flag particles; the string itself is too heavy to catch the wind. */
	fabric: Uint8Array;
	constraints: { a: number; b: number; rest: number }[];
	/**
	 * Long-range attachments: `index` may be at most `max` away from `anchor` and is pulled back if
	 * further. Distance links alone let a 100-segment string stretch by half under its own weight,
	 * because each solver pass only moves corrections a few links along the chain.
	 */
	tethers: { index: number; anchor: number; max: number }[];
	rope: number[];
	flags: Flag[];
	time: number;
	/** Particle held by the pointer, or -1. */
	grabbed: number;
}

export function createPrayerFlags(width: number, height: number): Cloth {
	const flagWidth = Math.min(Math.max(width / 26, 30), 54);
	const segments = Math.max(FLAG_COLUMNS + 4, Math.round(width / (flagWidth / (FLAG_COLUMNS - 1))));
	const spacing = width / segments;
	const cellHeight = (flagWidth * 1.3) / (FLAG_ROWS - 1);
	const top = 14;
	const sag = Math.min(height * 0.28, width * 0.06);

	const pointsX: number[] = [];
	const pointsY: number[] = [];
	const pins: number[] = [];
	const fabric: number[] = [];
	const constraints: Cloth["constraints"] = [];
	const add = (px: number, py: number, isPinned: boolean, isFabric: boolean) => {
		pointsX.push(px);
		pointsY.push(py);
		pins.push(isPinned ? 1 : 0);
		fabric.push(isFabric ? 1 : 0);
		return pointsX.length - 1;
	};
	const link = (a: number, b: number) => constraints.push({ a, b, rest: Math.hypot(pointsX[b] - pointsX[a], pointsY[b] - pointsY[a]) });

	// The string starts in its resting curve, so nothing jumps on the first frame.
	const rope: number[] = [];
	for (let index = 0; index <= segments; index++) {
		const t = index / segments;
		rope.push(add(index * spacing, top + sag * 4 * t * (1 - t), index === 0 || index === segments, false));
		if (index > 0) link(rope[index - 1], rope[index]);
	}

	const tethers: Cloth["tethers"] = [];
	const ropeLength = constraints.reduce((sum, constraint) => sum + constraint.rest, 0);
	let alongRope = 0;
	for (let index = 1; index < rope.length - 1; index++) {
		alongRope += constraints[index - 1].rest;
		tethers.push({ index: rope[index], anchor: rope[0], max: alongRope });
		tethers.push({ index: rope[index], anchor: rope[rope.length - 1], max: ropeLength - alongRope });
	}

	const flags: Flag[] = [];
	for (let start = 2; start + FLAG_COLUMNS - 1 <= segments - 2; start += FLAG_COLUMNS - 1 + GAP_SEGMENTS) {
		const grid: number[][] = [rope.slice(start, start + FLAG_COLUMNS)];
		for (let row = 1; row < FLAG_ROWS; row++) {
			grid.push(grid[0].map((anchor) => add(pointsX[anchor], pointsY[anchor] + row * cellHeight, false, true)));
			grid[row].forEach((index, column) => tethers.push({ index, anchor: grid[0][column], max: row * cellHeight }));
		}
		for (let row = 1; row < FLAG_ROWS; row++) {
			for (let column = 0; column < FLAG_COLUMNS; column++) {
				link(grid[row - 1][column], grid[row][column]);
				if (column === 0) continue;
				link(grid[row][column - 1], grid[row][column]);
				// Shear links keep the cloth from collapsing into a line.
				link(grid[row - 1][column - 1], grid[row][column]);
				link(grid[row - 1][column], grid[row][column - 1]);
			}
		}
		flags.push({ grid, colour: flags.length });
	}

	return {
		x: Float32Array.from(pointsX),
		y: Float32Array.from(pointsY),
		z: new Float32Array(pointsX.length),
		previousX: Float32Array.from(pointsX),
		previousY: Float32Array.from(pointsY),
		previousZ: new Float32Array(pointsX.length),
		pinned: Uint8Array.from(pins),
		fabric: Uint8Array.from(fabric),
		constraints,
		tethers,
		rope,
		flags,
		time: 0,
		grabbed: -1,
	};
}

/** A pointer over the cloth: it drags a grabbed particle along, otherwise it brushes nearby fabric aside. */
export interface PointerInput {
	x: number;
	y: number;
	deltaX: number;
	deltaY: number;
}

export function stepCloth(cloth: Cloth, pointer: PointerInput | null = null): void {
	const { x, y, z, previousX, previousY, previousZ, pinned, fabric, grabbed } = cloth;
	cloth.time += STEP;
	const time = cloth.time;
	// The breeze swells and drops over several seconds.
	const gust = 0.5 + 0.5 * Math.sin(time * 0.31) * Math.sin(time * 0.83 + 1.3);
	const scale = STEP * STEP;

	for (let index = 0; index < x.length; index++) {
		if (pinned[index] || index === grabbed) continue;
		const velocityX = (x[index] - previousX[index]) * DAMPING;
		const velocityY = (y[index] - previousY[index]) * DAMPING;
		const velocityZ = (z[index] - previousZ[index]) * DAMPING;
		previousX[index] = x[index];
		previousY[index] = y[index];
		previousZ[index] = z[index];
		let forceX = 0;
		let forceY = GRAVITY;
		let forceZ = 0;
		if (fabric[index]) {
			// Mostly blowing towards the viewer, with ripples running along the string and down each flag.
			const ripple = Math.sin(time * 5.2 - x[index] * 0.05 + y[index] * 0.11);
			const flutter = Math.sin(time * 9.7 + x[index] * 0.13 - y[index] * 0.2);
			forceZ = (500 + 300 * ripple) * gust + 160 * flutter;
			forceX = 220 * gust * Math.sin(time * 1.3 + x[index] * 0.004);
			forceY = FABRIC_GRAVITY + 180 * flutter * gust;
		}
		x[index] += velocityX + forceX * scale;
		y[index] += velocityY + forceY * scale;
		z[index] += velocityZ + forceZ * scale;
	}

	if (pointer && grabbed >= 0) {
		x[grabbed] = pointer.x;
		y[grabbed] = pointer.y;
		z[grabbed] *= 0.8;
	} else if (pointer && (pointer.deltaX || pointer.deltaY)) {
		const speed = Math.hypot(pointer.deltaX, pointer.deltaY);
		for (let index = 0; index < x.length; index++) {
			if (pinned[index]) continue;
			const distance = Math.hypot(x[index] - pointer.x, y[index] - pointer.y);
			if (distance > PUSH_RADIUS) continue;
			const strength = 0.35 * (1 - distance / PUSH_RADIUS);
			x[index] += pointer.deltaX * strength;
			y[index] += pointer.deltaY * strength;
			// A hand brushing past also pushes the cloth back a little.
			z[index] -= speed * strength * 0.6;
		}
	}

	for (let iteration = 0; iteration < ITERATIONS; iteration++) {
		for (const { a, b, rest } of cloth.constraints) {
			const lockedA = pinned[a] === 1 || a === grabbed;
			const lockedB = pinned[b] === 1 || b === grabbed;
			if (lockedA && lockedB) continue;
			const deltaX = x[b] - x[a];
			const deltaY = y[b] - y[a];
			const deltaZ = z[b] - z[a];
			const distance = Math.hypot(deltaX, deltaY, deltaZ) || 0.0001;
			const correction = (distance - rest) / distance;
			const shareA = lockedA ? 0 : lockedB ? 1 : 0.5;
			const shareB = lockedB ? 0 : lockedA ? 1 : 0.5;
			x[a] += deltaX * correction * shareA;
			y[a] += deltaY * correction * shareA;
			z[a] += deltaZ * correction * shareA;
			x[b] -= deltaX * correction * shareB;
			y[b] -= deltaY * correction * shareB;
			z[b] -= deltaZ * correction * shareB;
		}

		for (const { index, anchor, max } of cloth.tethers) {
			if (pinned[index] || index === grabbed) continue;
			const deltaX = x[index] - x[anchor];
			const deltaY = y[index] - y[anchor];
			const deltaZ = z[index] - z[anchor];
			const distance = Math.hypot(deltaX, deltaY, deltaZ);
			if (distance <= max) continue;
			const ratio = max / distance;
			x[index] = x[anchor] + deltaX * ratio;
			y[index] = y[anchor] + deltaY * ratio;
			z[index] = z[anchor] + deltaZ * ratio;
		}
	}
}

/** The flag particle nearest to a point on screen, if one is close enough to pick up; -1 otherwise. */
export function nearestFabric(cloth: Cloth, pointX: number, pointY: number): number {
	let nearest = -1;
	let nearestDistance = GRAB_RADIUS;
	for (let index = 0; index < cloth.x.length; index++) {
		if (!cloth.fabric[index]) continue;
		const distance = Math.hypot(cloth.x[index] - pointX, cloth.y[index] - pointY);
		if (distance < nearestDistance) {
			nearest = index;
			nearestDistance = distance;
		}
	}
	return nearest;
}

/**
 * How brightly a cell catches light from the upper front, 0 to 1, from the normal of the
 * triangle spanned by three of its corners.
 */
export function cellLight(cloth: Cloth, a: number, b: number, c: number): number {
	const { x, y, z } = cloth;
	const ux = x[b] - x[a];
	const uy = y[b] - y[a];
	const uz = z[b] - z[a];
	const vx = x[c] - x[a];
	const vy = y[c] - y[a];
	const vz = z[c] - z[a];
	const nx = uy * vz - uz * vy;
	const ny = uz * vx - ux * vz;
	const nz = ux * vy - uy * vx;
	const length = Math.hypot(nx, ny, nz) || 1;
	// Light from the front, slightly above and to the left; cloth is lit on both sides.
	return Math.abs((nx * -0.3 + ny * -0.4 + nz * 0.87) / length);
}
