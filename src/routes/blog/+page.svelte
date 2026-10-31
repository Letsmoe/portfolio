<script lang="ts">
	import Search from "#components/Search.svelte";
	import SectionHeading from "#components/SectionHeading.svelte";
	import Story from "#components/Story.svelte";
	import StoryFilter from "#components/StoryFilter.svelte";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";
	import type { PageData } from "./$types";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>Blog - Moritz Utcke</title>
</svelte:head>

<div class="mx-auto w-full max-w-screen-2xl px-6 py-16">
	<SectionHeading index="03" title="Travel stories" meta="{data.stories.length} stories from the road" />
	<div class="mb-12 flex flex-col gap-4 border-y border-line py-4 sm:flex-row sm:items-center sm:justify-between">
		<a href="/journey" class="group flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] no-underline hover:text-accent">
			Every stop, day by day, on the journey map <ArrowRight size={14} class="transition-transform group-hover:translate-x-1" />
		</a>
		<div class="flex gap-3">
			{#if data.tags.length > 1}<StoryFilter tags={data.tags} />{/if}
			<Search searchList={data.stories} />
		</div>
	</div>
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each data.stories as story, index (story.url)}
			<Story data={story} featured={index === 0} />
		{/each}
	</div>
</div>
