import { getCollection } from "#lib/server/blog.ts";
import moment from "moment";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
	const stories = getCollection().sort((a, b) =>
		moment(b.frontmatter.date).diff(a.frontmatter.date, "milliseconds")
	);

	const tags = [
		...new Set(stories.map((x) => x.frontmatter.tags).flat().filter((x) => x)),
	];

	return {
		stories: stories.map(({ frontmatter, url }) => ({ frontmatter, url })),
		tags,
	};
};
