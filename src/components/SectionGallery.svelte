<script lang="ts">
	import Lightbox from "#components/Lightbox.svelte";
	import { formatStepDate } from "#lib/journey.ts";
	import type { SectionRoute } from "#lib/route.ts";
	import CaretLeft from "phosphor-svelte/lib/CaretLeft";
	import CaretRight from "phosphor-svelte/lib/CaretRight";
	import { onMount } from "svelte";

	interface Props {
		/** Slug of a section written by `scripts/section-route.ts`; its Polarsteps photos, in travel order. */
		section: string;
	}

	let { section }: Props = $props();

	let data: SectionRoute | null = $state(null);
	let track: HTMLUListElement | undefined = $state();
	let current = $state(0);
	let openPhoto: number | null = $state(null);

	function caption(index: number) {
		if (!data) return "";
		const stop = data.stops[data.photos[index].stop];
		return `${stop.name} · ${formatStepDate(stop)}`;
	}

	/** Slides are a scroll-snap track, so touch swiping is native and the buttons only scroll it. */
	function show(index: number) {
		if (!track || !data) return;
		const target = (index + data.photos.length) % data.photos.length;
		track.scrollTo({ left: target * track.clientWidth, behavior: "smooth" });
	}

	function onScroll() {
		if (track) current = Math.round(track.scrollLeft / track.clientWidth);
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === "ArrowRight") show(current + 1);
		if (event.key === "ArrowLeft") show(current - 1);
	}

	onMount(() => {
		// Same file as SectionRoute's, so the browser serves it from cache.
		fetch(`/journey/sections/${section}.json`)
			.then((response) => (response.ok ? response.json() : null))
			.then((route: SectionRoute | null) => (data = route));
	});
</script>

{#if data && data.photos.length > 0}
	<div class="section-gallery not-prose">
		<div class="slideshow" role="region" aria-roledescription="carousel" aria-label="Photo gallery">
			<!-- A scrollable strip has to be focusable for keyboard users; the arrow keys page through it. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
			<ul class="track" bind:this={track} onscroll={onScroll} onkeydown={onKeydown} tabindex="0">
				{#each data.photos as photo, index (photo.src)}
					<li class="slide" aria-roledescription="slide" aria-label="{index + 1} of {data.photos.length}">
						<button type="button" class="slide-button" onclick={() => (openPhoto = index)} aria-label="Enlarge photo: {caption(index)}">
							<img src={photo.src} alt={caption(index)} width={photo.width} height={photo.height} loading={index < 2 ? "eager" : "lazy"} decoding="async" class="slide-photo" />
						</button>
					</li>
				{/each}
			</ul>
			<button type="button" class="slide-arrow previous" onclick={() => show(current - 1)} aria-label="Previous photo"><CaretLeft size={22} weight="bold" /></button>
			<button type="button" class="slide-arrow next" onclick={() => show(current + 1)} aria-label="Next photo"><CaretRight size={22} weight="bold" /></button>
		</div>
		<p class="slide-caption">{caption(current)}</p>
		<div class="dots">
			{#each data.photos as photo, index (photo.src)}
				<button type="button" class="dot" class:active={index === current} onclick={() => show(index)} aria-label="Show photo {index + 1}" aria-current={index === current}></button>
			{/each}
		</div>
		<Lightbox count={data.photos.length} bind:index={openPhoto} caption={openPhoto === null ? "" : caption(openPhoto)}>
			{#snippet photo(index)}
				<img src={data!.photos[index].src} alt={caption(index)} class="lightbox-photo" />
			{/snippet}
		</Lightbox>
	</div>
{/if}

<!-- Posts style every <img> in the article as strongly as a single class; these selectors carry two. -->
<style>
	.section-gallery {
		margin: 3rem 0;
	}

	.slideshow {
		position: relative;
	}

	.track {
		display: flex;
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-x: auto;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		border-radius: 0.75rem;
		background: var(--color-ink);
	}

	.track::-webkit-scrollbar {
		display: none;
	}

	.track:focus-visible {
		outline: 2px solid var(--color-accent);
		outline-offset: 3px;
	}

	.slide {
		flex: 0 0 100%;
		margin: 0;
		aspect-ratio: 3 / 2;
		scroll-snap-align: start;
	}

	.slide-button {
		display: block;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		background: none;
		cursor: zoom-in;
	}

	/* Portrait photos keep their whole frame instead of being cropped to the landscape slide. */
	.section-gallery .slide-photo {
		display: block;
		width: 100%;
		height: 100%;
		max-height: none;
		margin: 0;
		border-radius: 0;
		object-fit: contain;
	}

	.slide-arrow {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		display: flex;
		width: 2.5rem;
		height: 2.5rem;
		align-items: center;
		justify-content: center;
		border: 0;
		border-radius: 9999px;
		background: rgb(255 255 255 / 0.85);
		color: #1c1a1b;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.slideshow:hover .slide-arrow,
	.slide-arrow:focus-visible {
		opacity: 1;
	}

	/* No hover on touch screens, so the arrows stay visible there. */
	@media (hover: none) {
		.slide-arrow {
			opacity: 0.85;
		}
	}

	.previous {
		left: 0.75rem;
	}

	.next {
		right: 0.75rem;
	}

	.slide-caption {
		margin: 0.75rem 0 0;
		text-align: center;
		color: var(--color-muted);
		font: 0.75rem var(--font-mono, monospace);
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.dots {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.15rem;
		margin-top: 0.5rem;
	}

	.dot {
		width: 1rem;
		height: 1rem;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}

	.dot::before {
		content: "";
		display: block;
		width: 0.45rem;
		height: 0.45rem;
		margin: auto;
		border-radius: 9999px;
		background: var(--color-line);
		transition: background-color 0.2s ease;
	}

	.dot:hover::before {
		background: var(--color-muted);
	}

	.dot.active::before {
		background: var(--color-accent);
	}

	.section-gallery .lightbox-photo {
		pointer-events: auto;
		width: auto;
		max-width: 100%;
		max-height: 100%;
		margin: 0;
		border-radius: 0.75rem;
		object-fit: contain;
		cursor: default;
	}
</style>
