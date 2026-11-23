import type { BlogEntry } from "#lib/blog.ts";
import { stepsOnDay } from "#lib/journey.ts";
import { getCollection } from "#lib/server/blog.ts";
import { journey } from "#lib/server/journey.ts";
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
		places: stepsOnDay(journey.steps, story.frontmatter.date.slice(0, 10)).map(({ slug, name, countryCode }) => ({ slug, name, countryCode })),
		last: last.slug ? { slug: last.slug, title: last.frontmatter.title } : null,
		next: next.slug ? { slug: next.slug, title: next.frontmatter.title } : null,
	};
};
