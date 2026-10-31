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
</script>

<header class="mb-8 grid gap-6 border-b border-line pb-6 {compact ? '' : 'lg:grid-cols-[1fr_auto] lg:items-end'}">
	<div>
		<p class="label m-0 mb-3">Day {day}</p>
		<h1 class="display m-0 {compact ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-7xl'}">{step.name}</h1>
	</div>
	<dl class="m-0 grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs {compact ? '' : 'sm:grid-cols-4 lg:grid-cols-2'}">
		<div><dt class="uppercase tracking-widest text-muted">Country</dt><dd class="m-0">{flagEmoji(step.countryCode)} {step.country}</dd></div>
		<div><dt class="uppercase tracking-widest text-muted">Date</dt><dd class="m-0">{formatStepDate(step)}</dd></div>
		<div><dt class="uppercase tracking-widest text-muted">Position</dt><dd class="m-0">{formatCoordinates(step.lat, step.lon)}</dd></div>
		{#if step.weather}
			<div>
				<dt class="uppercase tracking-widest text-muted">Weather</dt>
				<dd class="m-0">{weatherEmoji(step.weather.condition)} {step.weather.temperature ?? "–"}°C</dd>
			</div>
		{/if}
	</dl>
</header>

<div class="grid gap-10 {compact ? '' : 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'}">
	<div class={compact ? "" : "lg:sticky lg:top-[104px] lg:self-start"}>
		{#if paragraphs.length > 0}
			<ol class="m-0 list-none space-y-4 p-0">
				{#each paragraphs as paragraph, index}
					<li class="m-0 flex gap-3 text-[1.05rem] leading-relaxed">
						<span class="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[10px] text-paper">{index + 1}</span>
						<span>{paragraph}</span>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="m-0 font-hand text-2xl text-muted">No words that day, just pictures.</p>
		{/if}
	</div>

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
					class="m-0 h-auto w-full rounded-lg bg-sunken shadow-soft"
				></video>
				<span class="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-card/90 px-2 py-0.5 font-mono text-[10px] shadow-soft">
					<Play size={10} weight="fill" /> Video {index + 1} · {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, "0")}
				</span>
			</figure>
		{/each}
		{#each step.photos as photo, index (photo.src)}
			<a
				href={photo.src}
				target="_blank"
				rel="noreferrer"
				class="group relative mb-4 block break-inside-avoid"
				style="rotate: {index % 3 === 0 ? -1.2 : index % 3 === 1 ? 0.8 : 0}deg"
			>
				<img
					src={photo.thumb}
					srcset="{photo.thumb} 400w, {photo.src} {photo.width}w"
					sizes={compact ? "(min-width: 640px) 18rem, 50vw" : "(min-width: 1024px) 28vw, (min-width: 640px) 33vw, 50vw"}
					width={photo.width}
					height={photo.height}
					alt="{step.name}, photo {index + 1}"
					loading={index < 4 ? "eager" : "lazy"}
					class="m-0 w-full rounded-lg shadow-soft transition group-hover:shadow-lift"
				/>
				<span class="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-card/90 font-mono text-[10px] shadow-soft">{index + 1}</span>
			</a>
		{/each}
	</div>
</div>
