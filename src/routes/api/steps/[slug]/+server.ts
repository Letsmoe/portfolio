import { getStep, journey } from "#lib/server/journey.ts";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = ({ params, setHeaders }) => {
	const found = getStep(params.slug);
	if (!found) {
		error(404, `No step called "${params.slug}"`);
	}

	setHeaders({ "cache-control": "public, max-age=3600" });
	return Response.json({
		step: found.step,
		previous: journey.steps[found.index - 1]?.slug ?? null,
		next: journey.steps[found.index + 1]?.slug ?? null,
	});
};
