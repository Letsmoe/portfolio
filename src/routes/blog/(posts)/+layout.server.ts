import type { BlogEntry } from "#lib/blog.ts";
import { getCollection } from "#lib/server/blog.ts";
import { error } from "@sveltejs/kit";
import moment from "moment";
import type { LayoutServerLoad } from "./$types";

function getClosestEntries(entries: BlogEntry[], target: string): [BlogEntry, BlogEntry] {
	let closestHigher = { frontmatter: { date: moment.max().toISOString() } } as BlogEntry;
	let closestLower = { frontmatter: { date: moment.min().toISOString() } } as BlogEntry;

	for (const entry of entries) {
		const currentDate = moment(entry.frontmatter.date);
		if (currentDate.isAfter(target) && currentDate.isBefore(closestHigher.frontmatter.date)) {
			closestHigher = entry;
		} else if (currentDate.isBefore(target) && currentDate.isAfter(closestLower.frontmatter.date)) {
			closestLower = entry;
		}
	}

	return [closestLower, closestHigher];
}

export const load: LayoutServerLoad = async ({ url }) => {
	const slug = url.pathname.split("/").filter(Boolean).pop();
	const stories = getCollection();
	const story = stories.find((entry) => entry.slug === slug);

	if (!story) {
		error(404, `No blog entry for "${slug}"`);
	}

	const [last, next] = getClosestEntries(stories, story.frontmatter.date);

	return {
		frontmatter: story.frontmatter,
		slug: story.slug,
		readingTime: story.readingTime,
		last: last.slug ?? null,
		next: next.slug ?? null,
	};
};
