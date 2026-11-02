import adapter from "@sveltejs/adapter-static";
import { enhancedImages } from "@sveltejs/enhanced-img";
import { sveltekit } from "@sveltejs/kit/vite";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { mdsvex } from "mdsvex";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwindcss(),
		enhancedImages(),
		sveltekit({
			// Every page is prerendered; Caddy serves `build/` and answers unknown paths with 404.html.
			adapter: adapter({ fallback: "404.html", precompress: true, strict: true }),
			prerender: {
				handleHttpError: ({ path, message }) => {
					// Journey photos and the GPS track are gitignored and live in their own folder on the
					// server (see deploy/Caddyfile), so they are missing from the build on purpose.
					if (/^\/journey\/(\d+\/|route\.json)/.test(path)) return;
					throw new Error(message);
				},
			},
			extensions: [".svelte", ".md"],
			preprocess: [vitePreprocess(), mdsvex({ extensions: [".md"] })],
		}),
	],
});
