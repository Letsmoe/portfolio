/**
 * Elevation from the AWS Open Data terrain tiles (Mapzen "terrarium" encoding), which the site's map already
 * uses for hillshading. Zoom 11 is ~75 m per pixel at the equator, as fine as the 90 m models under the free
 * elevation APIs, without their quotas. Tiles are cached in .cache/terrain.
 */
import type { Position } from "#lib/route.ts";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const ZOOM = 11;
const TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";
const CACHE = ".cache/terrain";
/** Decoded tiles are 192 KB each; the route walks through them in order, so a few hundred is plenty. */
const KEEP_DECODED = 300;
const DOWNLOADS_AT_ONCE = 8;

const decoded = new Map<string, Promise<Uint8Array | null>>();

async function download(x: number, y: number): Promise<Buffer | null> {
	const path = `${CACHE}/${ZOOM}/${x}/${y}.png`;
	if (existsSync(path)) return readFileSync(path);
	const response = await fetch(`${TILES}/${ZOOM}/${x}/${y}.png`);
	// The open ocean has no tiles.
	if (response.status === 403 || response.status === 404) return null;
	if (!response.ok) throw new Error(`Terrain tile ${ZOOM}/${x}/${y}: HTTP ${response.status}`);
	const png = Buffer.from(await response.arrayBuffer());
	mkdirSync(`${CACHE}/${ZOOM}/${x}`, { recursive: true });
	writeFileSync(path, png);
	return png;
}

function tile(x: number, y: number): Promise<Uint8Array | null> {
	const key = `${x}/${y}`;
	const cached = decoded.get(key);
	if (cached) {
		decoded.delete(key);
		decoded.set(key, cached);
		return cached;
	}
	const loading = download(x, y).then(async (png) => (png ? new Uint8Array(await sharp(png).removeAlpha().raw().toBuffer()) : null));
	decoded.set(key, loading);
	if (decoded.size > KEEP_DECODED) decoded.delete(decoded.keys().next().value!);
	return loading;
}

function pixel([lon, lat]: Position) {
	const scale = 2 ** ZOOM;
	const radians = (lat * Math.PI) / 180;
	const x = ((lon + 180) / 360) * scale;
	const y = ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * scale;
	const tileX = Math.floor(x);
	const tileY = Math.floor(y);
	return { tileX, tileY, column: Math.min(255, Math.floor((x - tileX) * 256)), row: Math.min(255, Math.floor((y - tileY) * 256)) };
}

/** Metres above sea level for each position; 0 where there is no tile. */
export async function elevations(positions: Position[]): Promise<number[]> {
	const pixels = positions.map(pixel);
	const needed = [...new Set(pixels.map(({ tileX, tileY }) => `${tileX}/${tileY}`))];
	for (let start = 0; start < needed.length; start += DOWNLOADS_AT_ONCE) {
		await Promise.all(needed.slice(start, start + DOWNLOADS_AT_ONCE).map((key) => tile(...(key.split("/").map(Number) as [number, number]))));
	}
	return Promise.all(
		pixels.map(async ({ tileX, tileY, column, row }) => {
			const rgb = await tile(tileX, tileY);
			if (!rgb) return 0;
			const offset = (row * 256 + column) * 3;
			return rgb[offset] * 256 + rgb[offset + 1] + rgb[offset + 2] / 256 - 32768;
		}),
	);
}
