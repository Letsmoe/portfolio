import { getStep, journey } from "#lib/server/journey.ts";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => {
	const found = getStep(params.slug);
	if (!found) {
		error(404, `No stop called "${params.slug}"`);
	}

	const neighbour = (offset: number) => {
		const step = journey.steps[found.index + offset];
		return step ? { slug: step.slug, name: step.name } : null;
	};

	return {
		step: found.step,
		day: Math.round((Date.parse(found.step.time) - Date.parse(journey.steps[0].time)) / 86_400_000) + 1,
		previous: neighbour(-1),
		next: neighbour(1),
	};
};
