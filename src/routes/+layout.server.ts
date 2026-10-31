import { journey } from "#lib/server/journey.ts";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = () => {
	const lastStep = journey.steps[journey.steps.length - 1];
	return { lastStop: { name: lastStep.name, lat: lastStep.lat, lon: lastStep.lon, slug: lastStep.slug } };
};
