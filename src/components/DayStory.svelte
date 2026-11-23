<script lang="ts">
	import { flagEmoji, formatCoordinates, formatStepDate, weatherEmoji, type JourneyStep } from "#lib/journey.ts";
	import Play from "phosphor-svelte/lib/Play";


	interface Props {
		step: JourneyStep;
		day: number;
		/** The sheet is narrow, so text and media stack instead of sitting side by side. */
		compact?: boolean;
	}

	let { step, day, compact = false }: Props = $props();

	let paragraphs = $derived(step.description.split(/\n\s*\n|\n/).filter((paragraph) => paragraph.trim()));
	let videos = $derived(step.videos ?? []);
	let cover = $derived(step.photos[0]);
	/** Without a photo the dark band only needs room for the title. */
	let coverHeight = $derived.by(() => {
		if (!cover) return compact ? "14rem" : "18rem";
		return compact ? "min(28rem, 60svh)" : "min(40rem, 65svh)";
	});
</script>

<!-- In the sheet the cover runs edge to edge; on the page it sits in the column like the blog's photos. -->
<header class="cover relative flex flex-col justify-end overflow-hidden bg-[#141314] text-[#fafaf8] {compact ? '' : 'rounded-3xl'}" style="height: {coverHeight}">
	{#if cover}
		<img src={cover.src} alt="" width={cover.width} height={cover.height} class="absolute inset-0 m-0 h-full w-full object-cover" />
	{/if}
	<div class="relative z-[1] {compact ? 'px-5 pb-6 sm:px-8' : 'px-6 pb-8 sm:px-10'}">
		<p class="m-0 font-mono text-[11px] uppercase tracking-[0.2em] text-[#fafaf8]/85">Day {day} · {flagEmoji(step.countryCode)} {step.country}</p>
		<h1 class="m-0 mt-3 font-medium leading-[0.9] tracking-[-0.055em] {compact ? 'text-[clamp(2.5rem,7vw,3.75rem)]' : 'text-[clamp(3rem,8vw,6.5rem)]'}">{step.name}</h1>
	</div>
</header>

<dl class="m-0 grid grid-cols-2 gap-x-6 gap-y-6 {compact ? 'px-5 pt-6 sm:px-8' : 'mt-8 sm:grid-cols-4'}">
	<div class="border-t border-line pt-3">
		<dt class="label">Country</dt>
		<dd class="m-0 mt-2 text-lg font-medium tracking-tight">{flagEmoji(step.countryCode)} {step.country}</dd>
	</div>
	<div class="border-t border-line pt-3">
		<dt class="label">Date</dt>
		<dd class="m-0 mt-2 text-lg font-medium tracking-tight">{formatStepDate(step)}</dd>
	</div>
	<div class="border-t border-line pt-3">
		<dt class="label">Position</dt>
		<dd class="m-0 mt-2 font-mono text-sm">{formatCoordinates(step.lat, step.lon)}</dd>
	</div>
	{#if step.weather}
		<div class="border-t border-line pt-3">
			<dt class="label">Weather</dt>
			<dd class="m-0 mt-2 text-lg font-medium tracking-tight">{weatherEmoji(step.weather.condition)} {step.weather.temperature ?? "–"}°C</dd>
		</div>
	{/if}
</dl>

<div class="grid gap-10 {compact ? 'px-5 pb-10 pt-10 sm:px-8' : 'mt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'}">
	<div class={compact ? "" : "lg:sticky lg:top-[104px] lg:self-start"}>
		{#if paragraphs.length > 0}
			<div class="max-w-2xl space-y-4">
				{#each paragraphs as paragraph, index}
					<p class="m-0 {index === 0 ? 'text-[clamp(1.25rem,2vw,1.6rem)] leading-snug tracking-tight' : 'text-[1.05rem] leading-relaxed text-muted'}">{paragraph}</p>
				{/each}
			</div>
		{:else}
			<p class="m-0 font-hand text-3xl text-muted">No words that day, just pictures.</p>
		{/if}
	</div>

	{#if videos.length > 0 || step.photos.length > 0}
		<div class="columns-2 gap-4 {compact ? '' : 'sm:columns-3 lg:columns-2'}">
			{#each videos as video, index (video.src)}
				<figure class="relative m-0 mb-4 break-inside-avoid">
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={video.src}
						poster={video.poster}
						width={video.width}
						height={video.height}
						controls
						playsinline
						preload="none"
						class="m-0 h-auto w-full rounded-3xl bg-sunken"
					></video>
					<span class="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-card/90 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] shadow-soft">
						<Play size={10} weight="fill" /> Video {index + 1} · {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, "0")}
					</span>
				</figure>
			{/each}
			{#each step.photos as photo, index (photo.src)}
				<a href={photo.src} target="_blank" rel="noreferrer" class="group mb-4 block break-inside-avoid overflow-hidden rounded-3xl bg-sunken">
					<img
						src={photo.thumb}
						srcset="{photo.thumb} 400w, {photo.src} {photo.width}w"
						sizes={compact ? "(min-width: 640px) 18rem, 50vw" : "(min-width: 1024px) 28vw, (min-width: 640px) 33vw, 50vw"}
						width={photo.width}
						height={photo.height}
						alt="{step.name}, photo {index + 1}"
						loading={index < 4 ? "eager" : "lazy"}
						class="m-0 block w-full transition duration-700 group-hover:scale-105"
					/>
				</a>
			{/each}
		</div>
	{/if}
</div>

<style>
	/* Same dusk gradient as the page heroes, so the title reads over any photo. */
	.cover::after {
		content: "";
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(12 20 35 / 0.75), rgb(12 20 35 / 0.2) 50%, transparent 75%);
	}
</style>
