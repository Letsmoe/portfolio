<script lang="ts">
	import ElevationProfile from "#components/ElevationProfile.svelte";
	import JourneyMap from "#components/JourneyMap.svelte";
	import { flagEmoji } from "#lib/journey.ts";
	import { TRANSPORTS, type Transport } from "#lib/routeCleanup.ts";
	import type { PageData } from "./$types";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const TRANSPORT_STYLE: Record<Transport, { label: string; bar: string }> = {
		bike: { label: "Bicycle", bar: "bg-accent" },
		foot: { label: "On foot", bar: "bg-flag-green" },
		bus: { label: "Bus", bar: "bg-flag-blue" },
		car: { label: "Car", bar: "bg-flag-yellow" },
		boat: { label: "Boat", bar: "bg-muted" },
		flight: { label: "Plane", bar: "bg-rock" },
	};

	const km = (value: number) => Math.round(value).toLocaleString("en-US");

	/** One vertical scale for every chapter's profile. */
	let ceiling = $derived(Math.max(1000, ...data.chapters.map((chapter) => chapter.route?.highest ?? 0)));
</script>

<svelte:head>
	<title>Journey - Moritz Utcke</title>
	<meta name="description" content="{data.stats.steps} stops across {data.stats.countries} countries by bicycle and on foot." />
</svelte:head>

<div class="h-svh">
	<h1 class="sr-only">{data.name}</h1>
	<JourneyMap data={data.map} chromeTop="5.25rem" />
</div>

{#if data.route}
	{@const route = data.route}
	<section class="mx-auto max-w-screen-2xl px-6 pt-16">
		<dl class="m-0 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
			{#each [[km(route.totalKm), "Kilometres in total"], [km(route.withoutFlightsKm), "Without flights"], [`${route.ascent.toLocaleString("en-US")} m`, "Climbed"], [route.highest === null ? "–" : `${route.highest.toLocaleString("en-US")} m`, "Highest point"]] as [value, unit]}
				<div class="border-t border-line pt-3">
					<dt class="label">{unit}</dt>
					<dd class="m-0 mt-3 text-[clamp(2rem,5vw,4.5rem)] font-medium leading-none tracking-[-0.05em]">{value}</dd>
				</div>
			{/each}
		</dl>

		<div class="mt-16 border-t border-line pt-3">
			<p class="label m-0">How I got there</p>
			<div class="mt-6 flex h-4 overflow-hidden rounded-full bg-sunken">
				{#each TRANSPORTS as transport}
					{#if route.km[transport] > 0}
						<span class="h-full {TRANSPORT_STYLE[transport].bar}" style="width: {(route.km[transport] / route.totalKm) * 100}%" title="{TRANSPORT_STYLE[transport].label}: {km(route.km[transport])} km"></span>
					{/if}
				{/each}
			</div>
			<dl class="m-0 mt-6 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
				{#each TRANSPORTS as transport}
					<div>
						<dt class="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
							<span class="h-2.5 w-2.5 rounded-full {TRANSPORT_STYLE[transport].bar}"></span>{TRANSPORT_STYLE[transport].label}
						</dt>
						<dd class="m-0 mt-2 text-3xl font-medium tracking-[-0.04em]">
							{km(route.km[transport])} <span class="text-base text-muted">km · {Math.round((route.km[transport] / route.totalKm) * 100)}%</span>
						</dd>
					</div>
				{/each}
			</dl>
		</div>
	</section>
{/if}

<section class="mx-auto max-w-screen-2xl px-6 py-16">
	<p class="label m-0 mb-2">Chapters</p>
	<h2 class="m-0 mb-10 text-[clamp(2.5rem,6vw,5rem)] font-medium leading-none tracking-[-0.055em]">Country by country</h2>
	<ol class="m-0 list-none border-b border-line p-0">
		{#each data.chapters as chapter, index}
			<li class="m-0 border-t border-line">
				<a href="/journey/{chapter.firstSlug}" class="group grid grid-cols-6 items-center gap-x-6 gap-y-3 py-5 no-underline lg:grid-cols-12">
					<span class="col-span-1 font-mono text-[11px] tracking-[0.18em] text-muted">{String(index + 1).padStart(2, "0")}</span>
					<span class="col-span-5 flex min-w-0 items-center gap-3 lg:col-span-4">
						<span class="text-2xl">{flagEmoji(chapter.countryCode)}</span>
						<span class="min-w-0">
							<span class="block truncate text-xl font-medium tracking-tight group-hover:text-accent">{chapter.country}</span>
							<span class="block font-mono text-[11px] text-muted">{chapter.from} – {chapter.to} · {chapter.stops} stop{chapter.stops === 1 ? "" : "s"}</span>
						</span>
					</span>
					{#if chapter.route}
						<span class="col-span-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted lg:col-span-3">
							{km(chapter.route.km.bike + chapter.route.km.foot)} km own power
							{#if chapter.route.ascent > 0}<br />↑ {chapter.route.ascent.toLocaleString("en-US")} m{#if chapter.route.highest !== null} · top {chapter.route.highest.toLocaleString("en-US")} m{/if}{/if}
						</span>
						<ElevationProfile profile={chapter.route.profile} ceiling={ceiling} class="col-span-3 h-10 w-full text-accent/70 lg:col-span-4" />
					{/if}
				</a>
			</li>
		{/each}
	</ol>
</section>
