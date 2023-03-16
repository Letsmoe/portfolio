import { defineConfig } from 'astro/config';

import svelte from "@astrojs/svelte";

// https://astro.build/config
import mdx from "@astrojs/mdx";

// https://astro.build/config
import tailwind from "@astrojs/tailwind";

// https://astro.build/config

// https://astro.build/config

// https://astro.build/config
import image from "@astrojs/image";

// https://astro.build/config
export default defineConfig({
  integrations: [svelte(), mdx({
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: "dracula"
    }
  }), tailwind(), image({
		serviceEntryPoint: "@astrojs/image/sharp"
	})]
});