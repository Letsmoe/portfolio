import { formatStepDate, groupIntoChapters, summarize } from "#lib/journey.ts";
import { toMapData } from "#lib/map.ts";
import { journey } from "#lib/server/journey.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({
	name: journey.name,
	summary: journey.summary,
	stats: summarize(journey),
	map: toMapData(journey),
	chapters: groupIntoChapters(journey.steps).map((chapter) => ({
		country: chapter.country,
		countryCode: chapter.countryCode,
		stops: chapter.steps.length,
		from: formatStepDate(chapter.steps[0]),
		to: formatStepDate(chapter.steps[chapter.steps.length - 1]),
		firstSlug: chapter.steps[0].slug,
		thumbs: chapter.steps.flatMap((step) => step.photos.slice(0, 1).map((photo) => photo.micro)).slice(0, 4),
	})),
});
