<script lang="ts">
	import type { BlogFrontmatter } from "#lib/blog.ts";
	import moment from "moment";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";

	interface Props {
		data: { frontmatter: BlogFrontmatter };
		/** The newest story spans the whole row with a large image. */
		featured?: boolean;
	}

	let { data, featured = false }: Props = $props();
</script>

<a
	class="story group grid content-start gap-x-8 gap-y-5 rounded-[2rem] border border-line bg-card p-3 no-underline shadow-soft transition hover:-translate-y-1 hover:shadow-lift {featured
		? 'col-span-full lg:grid-cols-12 lg:items-center'
		: ''}"
	data-tags={data.frontmatter.tags[0]}
	data-slug={data.frontmatter.slug}
	href={"/blog/" + data.frontmatter.slug}
>
	<div class="overflow-hidden rounded-[1.5rem] bg-sunken {featured ? 'lg:col-span-7' : ''}">
		<img
			src={featured ? data.frontmatter.image : `/images/blog/thumbs/${data.frontmatter.slug}.webp`}
			alt=""
			loading={featured ? "eager" : "lazy"}
			decoding="async"
			class="m-0 w-full object-cover transition duration-700 group-hover:scale-105 {featured ? 'aspect-[16/10]' : 'aspect-[4/3]'}"
		/>
	</div>
	<div class="flex flex-col px-3 pb-4 {featured ? 'lg:col-span-5 lg:pr-8' : ''}">
		<p class="m-0 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
			{moment(data.frontmatter.date).format("DD MMM YYYY")}
		</p>
		<h2
			class="m-0 mt-3 font-medium tracking-[-0.03em] transition-colors group-hover:text-accent {featured
				? 'text-[clamp(2.25rem,4.5vw,4rem)] leading-[0.95]'
				: 'text-2xl leading-tight'}"
		>
			{data.frontmatter.title}
		</h2>
		<p class="m-0 mt-3 text-muted {featured ? 'text-xl leading-snug' : 'line-clamp-3 leading-relaxed'}">{data.frontmatter.description}</p>
		{#if featured}
			<span class="mt-8 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]">
				Read the story <ArrowRight size={14} class="transition-transform group-hover:translate-x-1" />
			</span>
		{/if}
	</div>
</a>
