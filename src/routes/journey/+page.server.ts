import { formatStepDate, groupIntoChapters, summarize } from "#lib/journey.ts";
import { toMapData } from "#lib/map.ts";
import type { RouteStats } from "#lib/routeStats.ts";
import { journey } from "#lib/server/journey.ts";
import type { PageServerLoad } from "./$types";

/** Written by `scripts/route/snap.ts`; a fresh checkout without it simply shows no numbers. */
const routeStats = Object.values(import.meta.glob<RouteStats>("/src/lib/server/route-stats.json", { eager: true, import: "default" }))[0] ?? null;

export const load: PageServerLoad = () => {
	const sections = new Map(routeStats?.sections.map((section) => [section.firstSlug, section]));
	return {
		name: journey.name,
		summary: journey.summary,
		stats: summarize(journey),
		map: toMapData(journey),
		route: routeStats && {
			km: routeStats.km,
			totalKm: routeStats.totalKm,
			withoutFlightsKm: routeStats.withoutFlightsKm,
			ascent: routeStats.ascent,
			highest: routeStats.highest,
		},
		chapters: groupIntoChapters(journey.steps).map((chapter) => ({
			country: chapter.country,
			countryCode: chapter.countryCode,
			stops: chapter.steps.length,
			from: formatStepDate(chapter.steps[0]),
			to: formatStepDate(chapter.steps[chapter.steps.length - 1]),
			firstSlug: chapter.steps[0].slug,
			thumbs: chapter.steps.flatMap((step) => step.photos.slice(0, 1).map((photo) => photo.micro)).slice(0, 4),
			route: sections.get(chapter.steps[0].slug) ?? null,
		})),
	};
};
