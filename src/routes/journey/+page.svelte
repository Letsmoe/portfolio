<script lang="ts">
	import JourneyMap from "#components/JourneyMap.svelte";
	import { flagEmoji } from "#lib/journey.ts";
	import type { PageData } from "./$types";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();
</script>

<svelte:head>
	<title>Journey - Moritz Utcke</title>
	<meta name="description" content="{data.stats.steps} stops across {data.stats.countries} countries by bicycle and on foot." />
</svelte:head>

<div class="h-svh">
	<h1 class="sr-only">{data.name}</h1>
	<JourneyMap data={data.map} chromeTop="5.25rem" />
</div>

<section class="mx-auto max-w-screen-xl px-4 py-16">
	<p class="label m-0 mb-2">Chapters</p>
	<h2 class="display m-0 mb-8 text-4xl">Country by country</h2>
	<ol class="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.chapters as chapter, index}
			<li class="m-0">
				<a href="/journey/{chapter.firstSlug}" class="panel group flex items-center gap-4 p-3 no-underline transition hover:-translate-y-0.5 hover:shadow-lift">
					<span class="w-6 shrink-0 text-right font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
					<span class="text-2xl">{flagEmoji(chapter.countryCode)}</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-semibold group-hover:text-accent">{chapter.country}</span>
						<span class="block font-mono text-[11px] text-muted">{chapter.from} – {chapter.to} · {chapter.stops} stop{chapter.stops === 1 ? "" : "s"}</span>
					</span>
					<span class="flex -space-x-3">
						{#each chapter.thumbs.slice(0, 3) as thumb}
							<img src={thumb} alt="" loading="lazy" class="m-0 h-8 w-8 rounded-full border-2 border-card object-cover" />
						{/each}
					</span>
				</a>
			</li>
		{/each}
	</ol>
</section>
