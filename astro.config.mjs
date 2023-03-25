import { defineConfig } from 'astro/config';

import svelte from "@astrojs/svelte";

import image from '@astrojs/image';

// https://astro.build/config
import mdx from "@astrojs/mdx";

// https://astro.build/config
import tailwind from "@astrojs/tailwind";

import compress from "astro-compress";

// https://astro.build/config
export default defineConfig({
  integrations: [compress({
		img: {
			jpeg: false
		},
		css: {
			comments: false,
		},
		html: {
			minifyCSS: true,
			minifyJS: true,
			removeComments: true,
			removeEmptyAttributes: true,
			removeAttributeQuotes: true,
		},
		path: ["./dist/"]
	}),svelte(), mdx({
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: "dracula"
    }
  }), tailwind(), image({
		cacheDir: "./.cache/image",
		serviceEntryPoint: "@astrojs/image/sharp"
	})]
});