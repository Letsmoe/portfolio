import adapter from "@sveltejs/adapter-node";
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
			adapter: adapter(),
			extensions: [".svelte", ".md"],
			preprocess: [vitePreprocess(), mdsvex({ extensions: [".md"] })],
		}),
	],
});
