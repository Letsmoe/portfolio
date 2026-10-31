import { summarize } from "#lib/journey.ts";
import { journey } from "#lib/server/journey.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => ({
	stats: summarize(journey),
});
