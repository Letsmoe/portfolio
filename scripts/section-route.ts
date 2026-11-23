/**
 * Cuts one stretch of the trip out of the GPS track and snaps it to roads, for a blog post's route map.
 *
 *   bun scripts/section-route.ts <section-slug> <first-step-slug> <last-step-slug>
 *
 * Writes to static/journey/sections/: <section-slug>.gpx (the road route plus a waypoint per step),
 * <section-slug>-recorded.gpx (the raw GPS fixes) and <section-slug>.json (route, elevation profile,
 * steps and photos, read by SectionRoute.svelte and SectionGallery.svelte).
 * Polarsteps logs a fix every few kilometres, which is too sparse for map matching, so each pair of
 * consecutive fixes is routed instead, on the public FOSSGIS OSRM car profile (most of the trip was on
 * roads that cyclists share with cars).
 */
import { climb, isDetour, kilometresAlong, lengthKm, resample, simplify, stitchLegs, type Position, type RoutedLeg, type SectionRoute } from "#lib/route.ts";
import type { Journey } from "#lib/journey.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OSRM = "https://routing.openstreetmap.de/routed-car/route/v1/driving";
/** Waypoints per request; the public server accepts 100. Chunks share their boundary fix. */
const CHUNK = 100;
/** The FOSSGIS usage policy asks for at most one request per second. */
const REQUEST_GAP_MS = 1100;
/** About 1 m; the snapped geometry has a vertex every few metres, far more than a blog map needs. */
const SIMPLIFY_TOLERANCE = 0.00001;
/** Open-Meteo's free elevation API (Copernicus 90 m terrain model) takes 100 points per request. */
const ELEVATION = "https://api.open-meteo.com/v1/elevation";
const ELEVATION_BATCH = 100;
const PROFILE_EVERY_KM = 0.5;

const [sectionSlug, firstSlug, lastSlug] = process.argv.slice(2);
if (!lastSlug) throw new Error("Usage: bun scripts/section-route.ts <section-slug> <first-step-slug> <last-step-slug>");

const journey: Journey = JSON.parse(readFileSync("src/lib/server/journey.json", "utf8"));
const track: Position[][] = JSON.parse(readFileSync("static/journey/route.json", "utf8"));

const firstIndex = journey.steps.findIndex((step) => step.slug === firstSlug);
const lastIndex = journey.steps.findIndex((step) => step.slug === lastSlug);
if (firstIndex === -1 || lastIndex < firstIndex) throw new Error(`Unknown or misordered steps ${firstSlug} → ${lastSlug}`);
const steps = journey.steps.slice(firstIndex, lastIndex + 1);

// route.json holds the fixes in time order but without times, so the section runs from the fix nearest
// the first step to the next fix nearest the last one. Segments split where the import saw a long hop.
const fixesInOrder = track.flat();
const nearestFrom = (from: number, [lon, lat]: Position) => {
	let nearest = from;
	for (let index = from; index < fixesInOrder.length; index++) {
		const [fixLon, fixLat] = fixesInOrder[index];
		const [bestLon, bestLat] = fixesInOrder[nearest];
		if (Math.hypot(fixLon - lon, fixLat - lat) < Math.hypot(bestLon - lon, bestLat - lat)) nearest = index;
	}
	return nearest;
};
const start = nearestFrom(0, [steps[0].lon, steps[0].lat]);
const end = nearestFrom(start, [steps.at(-1)!.lon, steps.at(-1)!.lat]);
const fixes = fixesInOrder.slice(start, end + 1);
console.log(`${steps.length} steps, ${fixes.length} GPS fixes, ${lengthKm(fixes).toFixed(0)} km between fixes`);

const legs: RoutedLeg[] = [];
for (let chunkStart = 0; chunkStart < fixes.length - 1; chunkStart += CHUNK - 1) {
	const chunk = fixes.slice(chunkStart, chunkStart + CHUNK);
	const coordinates = chunk.map(([lon, lat]) => `${lon},${lat}`).join(";");
	const response = await fetch(`${OSRM}/${coordinates}?overview=false&steps=true&geometries=geojson&continue_straight=false`, {
		headers: { "User-Agent": "letsmoe.com blog route snapping" },
	});
	const body = await response.json();
	if (body.code !== "Ok") throw new Error(`OSRM ${body.code}: ${body.message ?? response.status}`);
	for (const leg of body.routes[0].legs) {
		legs.push({ coordinates: leg.steps.flatMap((step: { geometry: { coordinates: Position[] } }) => step.geometry.coordinates), distanceKm: leg.distance / 1000 });
	}
	await Bun.sleep(REQUEST_GAP_MS);
}

const route = simplify(stitchLegs(fixes, legs), SIMPLIFY_TOLERANCE).map(([lon, lat]): Position => [Number(lon.toFixed(5)), Number(lat.toFixed(5))]);
const kilometres = kilometresAlong(route, steps.map((step): Position => [step.lon, step.lat]));

const samples = resample(route, PROFILE_EVERY_KM);
const elevations: number[] = [];
for (let batchStart = 0; batchStart < samples.length; batchStart += ELEVATION_BATCH) {
	const batch = samples.slice(batchStart, batchStart + ELEVATION_BATCH);
	const latitudes = batch.map(({ position }) => position[1].toFixed(5)).join(",");
	const longitudes = batch.map(({ position }) => position[0].toFixed(5)).join(",");
	const response = await fetch(`${ELEVATION}?latitude=${latitudes}&longitude=${longitudes}`);
	const body = await response.json();
	// The free tier counts every coordinate against a per-minute quota; a long section runs into it.
	if (response.status === 429) {
		console.log("Elevation quota reached, waiting a minute…");
		await Bun.sleep(61_000);
		batchStart -= ELEVATION_BATCH;
		continue;
	}
	if (!Array.isArray(body.elevation)) throw new Error(`Elevation API: ${body.reason ?? response.status}`);
	elevations.push(...body.elevation);
	await Bun.sleep(REQUEST_GAP_MS);
}
const { ascent, descent } = climb(elevations);

const section: SectionRoute = {
	slug: sectionSlug,
	kilometres: Math.round(lengthKm(route)),
	route,
	profile: samples.map(({ km }, index): [number, number] => [Number(km.toFixed(2)), Math.round(elevations[index])]),
	ascent,
	descent,
	stops: steps.map((step, index) => ({
		slug: step.slug,
		name: step.name,
		country: step.country,
		countryCode: step.countryCode,
		time: step.time,
		timezone: step.timezone,
		lon: step.lon,
		lat: step.lat,
		micro: step.photos[0]?.micro ?? null,
		kilometres: Math.round(kilometres[index]),
	})),
	photos: steps.flatMap((step, stop) => step.photos.map(({ src, thumb, width, height }) => ({ src, thumb, width, height, stop }))),
};

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const gpx = (name: string, track: Position[]) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="letsmoe.com" xmlns="http://www.topografix.com/GPX/1/1">
${steps.map((step) => `	<wpt lat="${step.lat}" lon="${step.lon}"><time>${step.time}</time><name>${escape(step.name)}</name></wpt>`).join("\n")}
	<trk><name>${escape(name)}</name><trkseg>
${track.map(([lon, lat]) => `		<trkpt lat="${lat}" lon="${lon}"/>`).join("\n")}
	</trkseg></trk>
</gpx>
`;

mkdirSync("static/journey/sections", { recursive: true });
// The download offers the road route, which navigation devices can follow; the GPS fixes are kept beside it.
writeFileSync(`static/journey/sections/${sectionSlug}.gpx`, gpx(sectionSlug, route));
writeFileSync(`static/journey/sections/${sectionSlug}-recorded.gpx`, gpx(`${sectionSlug} (recorded)`, fixes));
writeFileSync(`static/journey/sections/${sectionSlug}.json`, JSON.stringify(section));
const straightLegs = legs.filter((leg, index) => isDetour(fixes[index], fixes[index + 1], leg)).length;
console.log(`${section.kilometres} km by road, ${route.length} route points, ${straightLegs} of ${legs.length} legs kept straight`);
console.log(`${samples.length} elevation samples, ${Math.min(...elevations)}–${Math.max(...elevations)} m, ↑ ${ascent} m ↓ ${descent} m`);
for (const stop of section.stops) console.log(`  ${String(stop.kilometres).padStart(5)} km  ${stop.name}`);
