import { countryRoute, postcards, summarize } from "#lib/journey.ts";
import { toMapData } from "#lib/map.ts";
import { journey } from "#lib/server/journey.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({
	stats: summarize(journey),
	countries: countryRoute(journey.steps),
	postcards: postcards(journey.steps),
	map: toMapData(journey),
});
