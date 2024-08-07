import { defineCollection, z } from 'astro:content';

export const collections = {
  'blog':  defineCollection({
		type: "content",
		schema: z.object({
			title: z.string(),
			image: z.string(),
			description: z.string(),
			tags: z.array(z.string()),
			date: z.date()
		})
	})
};