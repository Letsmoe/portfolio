import { getProject, PROJECTS } from "#lib/projects.ts";
import { latestRelease, readmeHtml } from "#lib/server/github.ts";
import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, fetch }) => {
	const project = getProject(params.slug);
	if (!project) {
		error(404, `No project called "${params.slug}"`);
	}

	const [readme, release] = project.repository
		? await Promise.all([readmeHtml(project.repository, fetch), latestRelease(project.repository, fetch)])
		: [null, null];

	return { project, index: PROJECTS.indexOf(project), readme, release };
};
