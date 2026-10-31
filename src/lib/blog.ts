export interface BlogFrontmatter {
	title: string;
	image: string;
	description: string;
	tags: string[];
	slug: string;
	date: string;
}

export interface BlogEntry {
	slug: string;
	url: string;
	frontmatter: BlogFrontmatter;
	readingTime: number;
}

/** `/src/routes/blog/(posts)/tag-1/+page.md` -> `tag-1` */
export function slugFromPath(path: string): string {
	return path.split("/").at(-2);
}
