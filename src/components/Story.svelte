<script lang="ts">
	import type { BlogFrontmatter } from "#lib/blog.ts";
	import moment from "moment";

	interface Props {
		data: { frontmatter: BlogFrontmatter };
	}

	let { data }: Props = $props();
</script>

<a class="story group block no-underline" data-tags={data.frontmatter.tags[0]} data-slug={data.frontmatter.slug} href={"/blog/" + data.frontmatter.slug}>
	<div class="overflow-hidden rounded-3xl bg-sunken">
		{#if data.frontmatter.image}
			<img
				src={`/images/blog/thumbs/${data.frontmatter.slug}.webp`}
				alt=""
				loading="lazy"
				decoding="async"
				class="m-0 aspect-[4/3] w-full object-cover transition duration-700 group-hover:scale-105"
			/>
		{:else}
			<div class="aspect-[4/3] w-full"></div>
		{/if}
	</div>
	<p class="m-0 mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
		{moment(data.frontmatter.date).format("DD MMM YYYY")}
	</p>
	<h3 class="m-0 mt-2 text-3xl font-medium leading-tight tracking-[-0.03em] transition-colors group-hover:text-accent">
		{data.frontmatter.title}
	</h3>
	<p class="m-0 mt-2 line-clamp-2 leading-relaxed text-muted">{data.frontmatter.description}</p>
</a>
