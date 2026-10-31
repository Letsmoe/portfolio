/**
 * Imports one trip from a Polarsteps data export (unzipped) into the site.
 *
 *   unzip polarsteps-user-data.zip 'trip/reise-nach-nepal_5393255/*' -d /tmp/polarsteps
 *   bun scripts/import-polarsteps.ts /tmp/polarsteps/trip/reise-nach-nepal_5393255
 *
 * Writes `src/lib/server/journey.json`, compressed photos to `static/journey/` and the
 * full-resolution GPS track to `static/journey/route.json` (the JSON keeps a simplified
 * copy for first paint; the map swaps in the full track once it has loaded).
 * Videos are re-encoded with ffmpeg (H.264, CRF 30, fast start) next to a poster frame.
 * Photos and videos that already exist are skipped, so re-running after a new export is cheap.
 * `user/user.json` (email, account ids) is never read.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { Journey, JourneyPhoto, JourneyStep, JourneyVideo } from "../src/lib/journey";

const FULL_WIDTH = 1080;
const THUMB_WIDTH = 400;
const FULL_QUALITY = 60;
const THUMB_QUALITY = 55;
/** Map nodes are ~48px circles; these load by the hundred. */
const MICRO_WIDTH = 96;
const MICRO_QUALITY = 40;
/** Consecutive GPS fixes further apart than this are drawn as a hop (flight, ferry, bus). */
const HOP_KM = 250;
/** Douglas-Peucker tolerance in degrees for the first-paint route; route.json keeps every fix. */
const ROUTE_TOLERANCE = 0.02;
const CONCURRENCY = 8;
/** libx264 already uses several threads per encode. */
const VIDEO_CONCURRENCY = 3;
const VIDEO_MAX_HEIGHT = 720;
const VIDEO_CRF = 30;

interface PolarstepsStep {
	id: number;
	display_name: string;
	display_slug: string;
	description: string | null;
	start_time: number;
	timezone_id: string;
	weather_condition: string | null;
	weather_temperature: number | null;
	is_deleted: boolean;
	location: { name: string; detail: string; country_code: string; lat: number; lon: number };
}

interface PolarstepsTrip {
	name: string;
	slug: string;
	summary: string | null;
	start_date: number;
	end_date: number;
	total_km: number;
	all_steps: PolarstepsStep[];
}

type Point = [lon: number, lat: number];

const tripDirectory = process.argv[2];
if (!tripDirectory) {
	console.error("usage: bun scripts/import-polarsteps.ts <export>/trip/<slug>_<id>");
	process.exit(1);
}

const projectRoot = join(import.meta.dir, "..");
const photoRoot = join(projectRoot, "static/journey");
const trip: PolarstepsTrip = JSON.parse(readFileSync(join(tripDirectory, "trip.json"), "utf8"));
const locations: { lat: number; lon: number; time: number }[] = JSON.parse(
	readFileSync(join(tripDirectory, "locations.json"), "utf8"),
).locations;

const stepDirectories = new Map(
	readdirSync(tripDirectory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => [Number(entry.name.split("_").at(-1)), entry.name]),
);

function distanceKm([lon1, lat1]: Point, [lon2, lat2]: Point): number {
	const radians = Math.PI / 180;
	const deltaLat = (lat2 - lat1) * radians;
	const deltaLon = (lon2 - lon1) * radians;
	const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(deltaLon / 2) ** 2;
	return 12742 * Math.asin(Math.sqrt(a));
}

function simplify(points: Point[], tolerance: number): Point[] {
	if (points.length < 3) return points;
	const [x1, y1] = points[0];
	const [x2, y2] = points[points.length - 1];
	const length = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
	let furthest = 0;
	let furthestDistance = 0;
	for (let index = 1; index < points.length - 1; index++) {
		const [x, y] = points[index];
		const distance = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / length;
		if (distance > furthestDistance) {
			furthest = index;
			furthestDistance = distance;
		}
	}
	if (furthestDistance <= tolerance) return [points[0], points[points.length - 1]];
	return [...simplify(points.slice(0, furthest + 1), tolerance).slice(0, -1), ...simplify(points.slice(furthest), tolerance)];
}

async function importPhoto(source: string, stepId: number, name: string): Promise<JourneyPhoto> {
	const directory = join(photoRoot, String(stepId));
	mkdirSync(directory, { recursive: true });
	const fullPath = join(directory, `${name}.webp`);
	const thumbPath = join(directory, `${name}-thumb.webp`);
	const microPath = join(directory, `${name}-micro.webp`);

	if (!existsSync(fullPath)) {
		await sharp(source).rotate().resize({ width: FULL_WIDTH, height: FULL_WIDTH, fit: "inside", withoutEnlargement: true }).webp({ quality: FULL_QUALITY, effort: 6 }).toFile(fullPath);
	}
	if (!existsSync(thumbPath)) {
		await sharp(source).rotate().resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: "inside", withoutEnlargement: true }).webp({ quality: THUMB_QUALITY, effort: 6 }).toFile(thumbPath);
	}

	if (!existsSync(microPath)) {
		await sharp(source).rotate().resize({ width: MICRO_WIDTH, height: MICRO_WIDTH, fit: "cover" }).webp({ quality: MICRO_QUALITY, effort: 6 }).toFile(microPath);
	}

	const { width = 0, height = 0 } = await sharp(fullPath).metadata();
	return {
		src: `/journey/${stepId}/${name}.webp`,
		thumb: `/journey/${stepId}/${name}-thumb.webp`,
		micro: `/journey/${stepId}/${name}-micro.webp`,
		width,
		height,
	};
}

const sortedSteps = trip.all_steps.filter((step) => !step.is_deleted).sort((a, b) => a.start_time - b.start_time);
const photoJobs: { stepIndex: number; source: string; stepId: number; name: string }[] = [];
for (const [stepIndex, step] of sortedSteps.entries()) {
	const directory = stepDirectories.get(step.id);
	const photoDirectory = directory && join(tripDirectory, directory, "photos");
	if (!photoDirectory || !existsSync(photoDirectory)) continue;
	for (const file of readdirSync(photoDirectory).sort()) {
		if (!/\.jpe?g$/i.test(file)) continue;
		photoJobs.push({ stepIndex, source: join(photoDirectory, file), stepId: step.id, name: file.split("_")[0] });
	}
}

const photosByStep: JourneyPhoto[][] = sortedSteps.map(() => []);
let done = 0;
async function worker() {
	while (photoJobs.length > 0) {
		const job = photoJobs.shift()!;
		photosByStep[job.stepIndex].push(await importPhoto(job.source, job.stepId, job.name));
		done++;
		if (done % 100 === 0) console.log(`photos: ${done}`);
	}
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

async function run(command: string[]): Promise<string> {
	const process = Bun.spawn(command, { stdout: "pipe", stderr: "pipe" });
	const [output, errors, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
	if (exitCode !== 0) throw new Error(`${command[0]} failed (${exitCode}): ${errors.slice(-400)}`);
	return output;
}

async function importVideo(source: string, stepId: number, name: string): Promise<JourneyVideo> {
	const directory = join(photoRoot, String(stepId));
	mkdirSync(directory, { recursive: true });
	const videoPath = join(directory, `${name}.mp4`);
	const posterPath = join(directory, `${name}-poster.webp`);

	if (!existsSync(videoPath)) {
		const partialPath = `${videoPath}.part.mp4`;
		await run([
			"ffmpeg", "-y", "-loglevel", "error", "-i", source,
			"-vf", `scale=-2:'min(${VIDEO_MAX_HEIGHT},ih)'`,
			"-c:v", "libx264", "-preset", "slow", "-crf", String(VIDEO_CRF), "-pix_fmt", "yuv420p",
			"-c:a", "aac", "-b:a", "80k", "-movflags", "+faststart",
			partialPath,
		]);
		renameSync(partialPath, videoPath);
	}
	if (!existsSync(posterPath)) {
		const framePath = `${posterPath}.png`;
		await run(["ffmpeg", "-y", "-loglevel", "error", "-ss", "0.5", "-i", videoPath, "-frames:v", "1", framePath]);
		await sharp(framePath).resize({ width: THUMB_WIDTH }).webp({ quality: THUMB_QUALITY }).toFile(posterPath);
		unlinkSync(framePath);
	}

	const probe = JSON.parse(
		await run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", videoPath]),
	);
	return {
		src: `/journey/${stepId}/${name}.mp4`,
		poster: `/journey/${stepId}/${name}-poster.webp`,
		width: probe.streams[0]?.width ?? 0,
		height: probe.streams[0]?.height ?? 0,
		duration: Math.round(Number(probe.format?.duration ?? 0)),
	};
}

const videoJobs: { stepIndex: number; source: string; stepId: number; name: string }[] = [];
for (const [stepIndex, step] of sortedSteps.entries()) {
	const directory = stepDirectories.get(step.id);
	const videoDirectory = directory && join(tripDirectory, directory, "videos");
	if (!videoDirectory || !existsSync(videoDirectory)) continue;
	for (const file of readdirSync(videoDirectory).sort()) {
		if (!/\.mp4$/i.test(file)) continue;
		videoJobs.push({ stepIndex, source: join(videoDirectory, file), stepId: step.id, name: file.split("_")[0] });
	}
}

const videosByStep: JourneyVideo[][] = sortedSteps.map(() => []);
let videosDone = 0;
async function videoWorker() {
	while (videoJobs.length > 0) {
		const job = videoJobs.shift()!;
		try {
			videosByStep[job.stepIndex].push(await importVideo(job.source, job.stepId, job.name));
		} catch (error) {
			console.error(`video ${job.source}: ${(error as Error).message}`);
		}
		videosDone++;
		console.log(`videos: ${videosDone}`);
	}
}
await Promise.all(Array.from({ length: VIDEO_CONCURRENCY }, videoWorker));

const steps: JourneyStep[] = sortedSteps.map((step, index) => ({
	id: step.id,
	slug: `${step.display_slug}-${step.id}`,
	name: step.display_name.trim(),
	country: step.location.country_code === "00" ? "At sea" : step.location.detail,
	countryCode: step.location.country_code,
	lat: step.location.lat,
	lon: step.location.lon,
	time: new Date(step.start_time * 1000).toISOString(),
	timezone: step.timezone_id,
	description: step.description?.trim() ?? "",
	weather: step.weather_condition ? { condition: step.weather_condition, temperature: step.weather_temperature } : null,
	photos: photosByStep[index].sort((a, b) => a.src.localeCompare(b.src)),
	videos: videosByStep[index].sort((a, b) => a.src.localeCompare(b.src)),
}));

const fixes = locations
	.filter((location) => location.time >= trip.start_date && location.time <= trip.end_date)
	.sort((a, b) => a.time - b.time)
	.map((location): Point => [location.lon, location.lat]);
const route: Point[][] = [];
let segment: Point[] = [];
for (const fix of fixes) {
	if (segment.length > 0 && distanceKm(segment[segment.length - 1], fix) > HOP_KM) {
		route.push(segment);
		segment = [];
	}
	segment.push(fix);
}
if (segment.length > 0) route.push(segment);

const journey: Journey = {
	name: trip.name,
	summary: trip.summary ?? "",
	startDate: new Date(trip.start_date * 1000).toISOString(),
	endDate: new Date(trip.end_date * 1000).toISOString(),
	totalKm: Math.round(trip.total_km),
	steps,
	route: route
		.map((points) => simplify(points, ROUTE_TOLERANCE).map(([lon, lat]): Point => [Number(lon.toFixed(3)), Number(lat.toFixed(3))]))
		.filter((points) => points.length > 1),
};

writeFileSync(join(projectRoot, "src/lib/server/journey.json"), JSON.stringify(journey));
const fullRoute = route
	.map((points) => points.map(([lon, lat]): Point => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]))
	.filter((points) => points.length > 1);
writeFileSync(join(photoRoot, "route.json"), JSON.stringify(fullRoute));
console.log(
	`${steps.length} steps, ${steps.reduce((sum, step) => sum + step.photos.length, 0)} photos, ${steps.reduce((sum, step) => sum + step.videos.length, 0)} videos, ${journey.route.length} route segments`,
);
