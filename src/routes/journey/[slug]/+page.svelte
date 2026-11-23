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

<article class="mx-auto max-w-screen-2xl px-6 pb-24 pt-6">
	<a href="/journey" class="group mb-6 flex items-center gap-2 self-start font-mono text-[11px] uppercase tracking-[0.18em] no-underline hover:text-accent">
		<ArrowLeft size={14} class="transition-transform group-hover:-translate-x-1" /> Journey map
	</a>

	<DayStory {step} day={data.day} />

	<nav class="mt-20 grid grid-cols-1 gap-x-6 sm:grid-cols-2" aria-label="Neighbouring stops">
		{#if data.previous}
			<a href="/journey/{data.previous.slug}" class="group border-t border-ink py-8 no-underline">
				<span class="label flex items-center gap-2"><ArrowLeft size={14} class="transition-transform group-hover:-translate-x-1" /> Day before</span>
				<span class="mt-4 block text-[clamp(2rem,5vw,4.5rem)] font-medium leading-[0.9] tracking-[-0.055em] transition-colors group-hover:text-accent">{data.previous.name}</span>
			</a>
		{:else}<span></span>{/if}
		{#if data.next}
			<a href="/journey/{data.next.slug}" class="group border-t border-ink py-8 text-right no-underline">
				<span class="label flex items-center justify-end gap-2">Next stop <ArrowRight size={14} class="transition-transform group-hover:translate-x-1" /></span>
				<span class="mt-4 block text-[clamp(2rem,5vw,4.5rem)] font-medium leading-[0.9] tracking-[-0.055em] transition-colors group-hover:text-accent">{data.next.name}</span>
			</a>
		{/if}
	</nav>
</article>
