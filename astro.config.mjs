import { defineConfig } from 'astro/config';
import svelte from "@astrojs/svelte";
import image from '@astrojs/image';

import mdx from "@astrojs/mdx";

// https://astro.build/config
import tailwind from "@astrojs/tailwind";
import compress from "astro-compress";
import node from "@astrojs/node";

// https://astro.build/config

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: "middleware"
  }),
  integrations: [mdx({
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: "dracula"
    }
  }), compress({
    img: {
      jpeg: false
    },
    css: {
      comments: false
    },
    html: {
      minifyCSS: true,
      minifyJS: true,
      removeComments: true,
      removeEmptyAttributes: true,
      removeAttributeQuotes: true
    },
    path: ["./dist/"]
  }), svelte(), tailwind(), image({
    cacheDir: "./.cache/image",
    serviceEntryPoint: "@astrojs/image/sharp"
  })]
});