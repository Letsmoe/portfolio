import { getStep, journey } from "#lib/server/journey.ts";
import { error } from "@sveltejs/kit";
import type { EntryGenerator, RequestHandler } from "./$types";

// Endpoints don't inherit `prerender` from the root layout.
export const prerender = true;

/** Nothing links to these; the map fetches them, so the prerenderer has to be told about every step. */
export const entries: EntryGenerator = () => journey.steps.map((step) => ({ slug: step.slug }));

export const GET: RequestHandler = ({ params }) => {
	const found = getStep(params.slug);
	if (!found) {
		error(404, `No step called "${params.slug}"`);
	}

	return Response.json({
		step: found.step,
		previous: journey.steps[found.index - 1]?.slug ?? null,
		next: journey.steps[found.index + 1]?.slug ?? null,
	});
};
