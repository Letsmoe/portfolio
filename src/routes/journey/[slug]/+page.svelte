<script lang="ts">
	import DayStory from "#components/DayStory.svelte";
	import ArrowLeft from "phosphor-svelte/lib/ArrowLeft";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";
	import type { PageData } from "./$types";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let step = $derived(data.step);
</script>

<svelte:head>
	<title>{step.name} - Day {data.day} - Moritz Utcke</title>
	<meta name="description" content={step.description.slice(0, 160) || `Day ${data.day} of the journey, in ${step.country}.`} />
	{#if step.photos[0]}<meta property="og:image" content={step.photos[0].src} />{/if}
</svelte:head>

<article class="mx-auto max-w-screen-xl px-4 py-10">
	<a href="/journey" class="btn btn-ghost -ml-4 mb-6"><ArrowLeft size={16} /> Journey map</a>

	<DayStory {step} day={data.day} />

	<nav class="mt-16 grid gap-4 border-t border-line pt-8 sm:grid-cols-2">
		{#if data.previous}
			<a href="/journey/{data.previous.slug}" class="panel group flex items-center gap-3 p-4 no-underline hover:shadow-lift">
				<ArrowLeft size={18} class="shrink-0 text-muted" />
				<span><span class="label block">Day before</span><span class="font-semibold group-hover:text-accent">{data.previous.name}</span></span>
			</a>
		{:else}<span></span>{/if}
		{#if data.next}
			<a href="/journey/{data.next.slug}" class="panel group flex items-center justify-end gap-3 p-4 text-right no-underline hover:shadow-lift">
				<span><span class="label block">Next stop</span><span class="font-semibold group-hover:text-accent">{data.next.name}</span></span>
				<ArrowRight size={18} class="shrink-0 text-muted" />
			</a>
		{/if}
	</nav>
</article>
