/**
 * Writes an 800px WebP thumbnail of every blog post's cover image to
 * `static/images/blog/thumbs/<slug>.webp`, which the blog index shows instead of the original.
 * `bun run build` runs it first; run it by hand to see new covers in `bun run dev`.
 */
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const POSTS = "src/routes/blog/(posts)";
const THUMBS = "static/images/blog/thumbs";

await mkdir(THUMBS, { recursive: true });

for (const slug of await readdir(POSTS)) {
	const markdown = await readFile(join(POSTS, slug, "+page.md"), "utf8").catch(() => null);
	const image = markdown?.match(/^image:\s*(.+)$/m)?.[1].trim();
	if (!image) continue;

	await sharp(join("static", image))
		.rotate()
		.resize({ width: 800, withoutEnlargement: true })
		.webp({ quality: 70 })
		.toFile(join(THUMBS, `${slug}.webp`));
	console.log(`${slug} <- ${image}`);
}
