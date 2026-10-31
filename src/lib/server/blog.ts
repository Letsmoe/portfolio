import { slugFromPath, type BlogEntry, type BlogFrontmatter } from "#lib/blog.ts";

const metadataByPath = import.meta.glob<Omit<BlogFrontmatter, "date"> & { date: unknown }>(
	"/src/routes/blog/**/+page.md",
	{ eager: true, import: "metadata" }
);

const rawByPath = import.meta.glob<string>("/src/routes/blog/**/+page.md", {
	eager: true,
	query: "?raw",
	import: "default",
});

export function getCollection(): BlogEntry[] {
	return Object.entries(metadataByPath).map(([path, metadata]) => {
		const slug = slugFromPath(path);

		return {
			slug,
			url: `/blog/${slug}`,
			frontmatter: {
				...metadata,
				slug,
				date:
					metadata.date instanceof Date
						? metadata.date.toISOString()
						: String(metadata.date),
			},
			readingTime: Math.ceil(rawByPath[path].split(" ").length / 240),
		};
	});
}
