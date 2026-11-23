<script lang="ts">
	import PrayerFlags from "#components/PrayerFlags.svelte";
	import Search from "#components/Search.svelte";
	import SectionHeading from "#components/SectionHeading.svelte";
	import Story from "#components/Story.svelte";
	import StoryFilter from "#components/StoryFilter.svelte";
	import PageHero from "#components/PageHero.svelte";
	import moment from "moment";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";
	import type { PageData } from "./$types";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let latest = $derived(data.stories.find((story) => story.frontmatter.image) ?? data.stories[0]);

	/** Stories arrive newest first, so the years come out newest first too. */
	let years = $derived(
		Map.groupBy(data.stories, (story) => moment(story.frontmatter.date).format("YYYY")),
	);
</script>

<svelte:head>
	<title>Blog - Moritz Utcke</title>
</svelte:head>

<PageHero
	tag="h2"
	image={latest.frontmatter.image}
	title={latest.frontmatter.title}
	description={latest.frontmatter.description}
	eyebrow="Latest story · {moment(latest.frontmatter.date).format('DD MMM YYYY')}"
	href={latest.url}
>
	{#snippet strip()}
		<a href={latest.url} class="group flex items-center gap-2 no-underline hover:text-[#fafaf8]">
			Read the story <ArrowRight size={14} class="transition-transform group-hover:translate-x-1" />
		</a>
		<span class="ml-auto">{data.stories.length} stories from the road</span>
	{/snippet}
</PageHero>

<div class="relative z-10 bg-paper">
	<PrayerFlags height={200} />

	<section class="mx-auto max-w-screen-2xl px-6 pb-24 pt-8">
		<SectionHeading index="03" title="Travel stories" />
		<div class="mb-16 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<a href="/journey" class="group flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] no-underline hover:text-accent">
				Every stop, day by day, on the journey map <ArrowRight size={14} class="transition-transform group-hover:translate-x-1" />
			</a>
			<div class="flex gap-3">
				{#if data.tags.length > 1}<StoryFilter tags={data.tags} />{/if}
				<Search searchList={data.stories} />
			</div>
		</div>

		{#each years as [year, stories] (year)}
			<section class="year grid grid-cols-6 gap-x-6 gap-y-8 border-t border-line pb-20 pt-3 lg:grid-cols-12">
				<header class="col-span-full lg:col-span-3">
					<div class="lg:sticky lg:top-28">
						<h2 class="m-0 text-[clamp(3rem,7vw,6rem)] font-medium leading-none tracking-[-0.055em]">{year}</h2>
						<p class="label m-0 mt-2">{stories.length} {stories.length === 1 ? "story" : "stories"}</p>
					</div>
				</header>
				<div class="col-span-full grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:col-span-9 xl:grid-cols-3">
					{#each stories as story (story.url)}
						<Story data={story} />
					{/each}
				</div>
			</section>
		{/each}
	</section>
</div>

<style>
	/* Search and the tag filter hide stories with inline styles; a year with none left goes too. */
	.year:not(:has(:global(.story:not([style*="display: none"])))) {
		display: none;
	}
</style>
