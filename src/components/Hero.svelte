<script lang="ts">
	import { flagEmoji, type RouteCountry } from "#lib/journey.ts";
	import { onMount } from "svelte";

	interface Props {
		/** Countries in the order they were first entered. */
		countries: RouteCountry[];
	}

	let { countries }: Props = $props();

	const LATITUDE = "41°46′52″S";
	const LONGITUDE = "146°14′32″E";

	let hero: HTMLElement = $state();
	/** 0 while the hero is in place, 1 once it has scrolled out of view. */
	let progress = $state(0);
	/** Width of the title in em, estimated for Geist and measured once the font has loaded. */
	let titleWidth = $state(10.8);

	/** Measures the text itself rather than the element, whose box depends on the layout being fitted.
	   Narrow screens break the title onto two lines, so it measures again on resize. */
	function measureTitle() {
		const context = document.createElement("canvas").getContext("2d");
		if (!context) return;
		context.font = '500 100px "Geist"';
		context.letterSpacing = "-6px";
		const lines = window.matchMedia("(max-width: 639px)").matches ? [LATITUDE, LONGITUDE] : [`${LATITUDE} ${LONGITUDE}`];
		titleWidth = Math.max(...lines.map((line) => context.measureText(line).width)) / 100;
	}

	onMount(() => {
		// `document.fonts.ready` can resolve before the Google Fonts face is even requested; `load` waits for it.
		document.fonts.load('500 1em "Geist"', `${LATITUDE} ${LONGITUDE}`).then(measureTitle);

		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		let frame = 0;
		const update = () => {
			frame = 0;
			const { top, height } = hero.getBoundingClientRect();
			progress = Math.min(Math.max(-top / height, 0), 1);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		update();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			window.removeEventListener("scroll", onScroll);
			cancelAnimationFrame(frame);
		};
	});
</script>

<svelte:window onresize={measureTitle} />

<section bind:this={hero} class="hero relative h-svh min-h-[36rem] overflow-hidden bg-[#a3b4c7] text-[#fafaf8]" style="--p: {progress}; --title-width: {titleWidth}">
	<div class="stack">
		<img src="/images/hero/argentina/back.webp" alt="" class="layer back" />
		<img src="/images/hero/argentina/front.webp" alt="Moritz riding a loaded bicycle towards the camera on an empty Patagonian road" class="layer front" />
	</div>

	<h1 class="sr-only">Moritz Utcke</h1>
	<p class="title m-0 font-medium" aria-hidden="true"><span>{LATITUDE}</span> <span>{LONGITUDE}</span></p>

	<a href="/journey" class="route group absolute inset-x-0 bottom-0 flex items-center gap-6 px-6 pb-5 pt-24 font-mono text-[11px] uppercase tracking-[0.2em] no-underline">
		<span>01</span>
		<span class="ticker relative min-w-0 flex-1 overflow-hidden">
			<span class="ticker-track flex w-max gap-10">
				{#each [0, 1] as copy}
					<span class="flex gap-10" aria-hidden={copy === 1 ? "true" : undefined}>
						{#each countries as country}<span class="text-xl leading-none" role="img" aria-label={country.name} title={country.name}>{flagEmoji(country.countryCode)}</span>{/each}
					</span>
				{/each}
			</span>
		</span>
		<span>{String(countries.length).padStart(2, "0")}</span>
	</a>
</section>

<style>
	.hero {
		container-type: size;
	}

	/* The photo keeps its 4:3 ratio and covers the hero. Vertically it puts the mesa (40% down the photo)
	   at 42% of the hero; horizontally it keeps the rider (49% across) centred on narrow screens.
	   Positioned without transforms so the layers and the title share the hero's stacking context. */
	.stack,
	.title {
		--width: max(100cqw, 133.333cqh);
		--height: calc(var(--width) * 0.75);
		--top: clamp(100cqh - var(--height), 42cqh - 0.4 * var(--height), 0px);
		--left: clamp(100cqw - var(--width), 50cqw - 0.49 * var(--width), 0px);
		/* The title fills the sky edge to edge; its baseline sits 38.5% down the photo, where the highest
		   part of the mesa (on the left) just touches it. */
		--title-space: calc(100cqw - 3rem);
		--title-size: calc(var(--title-space) / var(--title-width));
		--title-baseline: calc(var(--top) + 0.385 * var(--height));
	}

	@media (max-width: 639px) {
		.title span {
			display: block;
		}

		.title span + span {
			margin-top: 0.12em;
		}
	}

	.stack {
		position: absolute;
		top: var(--top);
		left: var(--left);
		width: var(--width);
		height: var(--height);
		/* Extra sky above back.webp and extra ground below front.webp; matches EXTEND in scripts/hero-layers.py. */
		--extend: 12%;
	}

	.layer {
		position: absolute;
		left: 0;
		width: 100%;
		margin: 0;
		will-change: transform;
	}

	.back {
		z-index: 0;
		top: calc(-1 * var(--extend));
		height: calc(100% + var(--extend));
		transform: translateY(calc(var(--p) * 10%));
	}

	.front {
		z-index: 3;
		top: 0;
		height: calc(100% + var(--extend));
		transform: translateY(calc(var(--p) * -8%));
	}

	/* line-height equals Geist's cap height, so the box is exactly the capitals and its bottom edge is the
	   baseline. */
	.title {
		position: absolute;
		z-index: 1;
		left: 50%;
		top: var(--title-baseline);
		translate: -50% -100%;
		font-size: var(--title-size);
		line-height: 0.71;
		letter-spacing: -0.06em;
		white-space: nowrap;
		transform: translateY(calc(var(--p) * 30cqh));
		animation: rise 1.4s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.route {
		z-index: 4;
		color: rgb(255 248 238 / 0.85);
		background: linear-gradient(to top, rgb(12 20 35 / 0.55), transparent);
	}

	.ticker {
		mask-image: linear-gradient(to right, transparent, black 4rem, black calc(100% - 4rem), transparent);
	}

	.ticker-track {
		animation: ticker 120s linear infinite;
	}

	.route:hover .ticker-track {
		animation-play-state: paused;
	}

	@keyframes ticker {
		to {
			translate: calc(-50% - 1.25rem);
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: -50% -60%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.title,
		.ticker-track {
			animation: none;
		}
	}
</style>
