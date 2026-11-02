import Config from "#assets/gallery/config.json";
import { redirect } from "@sveltejs/kit";
import type { EntryGenerator, PageServerLoad } from "./$types";

const IMAGES_PER_PAGE = 25;

// Without explicit widths enhanced-img only emits the original and half of it, so every
// thumbnail column would download a 1800px file. AVIF is left out: it takes ~40x longer
// to encode than WebP (the dev server does it on request) and came out larger at this quality.
const allImages = import.meta.glob("/src/assets/gallery/**/*.jpg", {
	query: "?enhanced&w=1000;600&quality=70&format=webp;jpg",
	import: "default",
});

/** What the full-screen viewer loads. Widths above the source's own are skipped, so larger originals get the 2400px version. */
const fullImages = import.meta.glob("/src/assets/gallery/**/*.jpg", {
	query: "?enhanced&w=2400;1600&quality=85&format=webp;jpg",
	import: "default",
});

/** The pagination only links a few pages around the current one, so list them all. */
export const entries: EntryGenerator = () =>
	Array.from({ length: Math.ceil(Object.keys(allImages).length / IMAGES_PER_PAGE) }, (_, index) => ({ page: String(index + 1) }));

export const load: PageServerLoad = async ({ params }) => {
	const page = parseInt(params.page);

	if (!page || isNaN(page) || page < 1) {
		redirect(302, "/gallery/1");
	}

	const entries = Object.entries(allImages).slice(
		(page - 1) * IMAGES_PER_PAGE,
		page * IMAGES_PER_PAGE
	);

	const images = await Promise.all(
		entries.map(async ([src, importImage]) => [src, await importImage(), await fullImages[src]()] as const)
	);

	const sections = [];
	for (const title in Config) {
		const { folder, text } = Config[title];
		const sectionImages = images.filter(([src]) => src.indexOf(folder) > -1);

		if (sectionImages.length === 0) {
			continue;
		}

		sections.push({ text, images: sectionImages, title, folder });
	}

	return {
		sections,
		page,
		imageCount: Object.keys(allImages).length,
		imagesPerPage: IMAGES_PER_PAGE,
	};
};
