import { defineCollection, z } from 'astro:content';

export const collections = {
  'blog':  defineCollection({
		schema: z.object({
			title: z.string(),
			image: z.string(),
			description: z.string(),
			category: z.string(),
			order: z.number()
		})
	}),
	"projects": defineCollection({
		schema: z.object({
			title: z.string(),
			description: z.string(),
			image: z.string()
		})
	})
};