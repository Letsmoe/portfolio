<script lang="ts">
	import AudioPlayer from "#components/AudioPlayer.svelte";
	import BlogProgressBar from "#components/BlogProgressBar.svelte";
	import Lightbox from "#components/Lightbox.svelte";
	import PrayerFlags from "#components/PrayerFlags.svelte";
	import PageHero from "#components/PageHero.svelte";
	import VideoPlayer from "#components/VideoPlayer.svelte";
	import { flagEmoji } from "#lib/journey.ts";
	import moment from "moment";
	import ArrowLeft from "phosphor-svelte/lib/ArrowLeft";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";
	import ArrowUpRight from "phosphor-svelte/lib/ArrowUpRight";
	import { mount, unmount } from "svelte";
	import type { Action } from "svelte/action";
	import type { LayoutData } from "./$types";

	interface Props {
		data: LayoutData;
		children?: import("svelte").Snippet;
	}

	let { data, children }: Props = $props();

	/** Posts embed plain `<video>` HTML (the CMS writes it that way); swap each for the site's player. */
	const customVideos: Action = (article) => {
		const players = [...article.querySelectorAll("video")].map((video) => {
			const source = video.querySelector("source");
			const target = document.createElement("div");
			video.replaceWith(target);
			return mount(VideoPlayer, {
				target,
				props: { src: source?.getAttribute("src") ?? video.getAttribute("src") ?? "", type: source?.getAttribute("type") ?? undefined },
			});
		});
		return { destroy: () => players.forEach((player) => unmount(player)) };
	};

	let photos = $state<{ src: string; alt: string }[]>([]);
	let openPhoto = $state<number | null>(null);

	const zoomablePhotos: Action = (article) => {
		const images = [...article.querySelectorAll("img")];
		photos = images.map((image) => ({ src: image.currentSrc || image.src, alt: image.alt }));
		const onClick = (event: MouseEvent) => {
			const index = images.indexOf(event.target as HTMLImageElement);
			if (index !== -1) openPhoto = index;
		};
		article.addEventListener("click", onClick);
		return { destroy: () => article.removeEventListener("click", onClick) };
	};
</script>

<svelte:head>
	<title>{data.frontmatter.title} - Moritz Utcke</title>
	<meta name="description" content={data.frontmatter.description} />
</svelte:head>

<BlogProgressBar />

<PageHero image={data.frontmatter.image} title={data.frontmatter.title} description={data.frontmatter.description} eyebrow={moment(data.frontmatter.date).format("DD MMM YYYY")}>
	{#snippet strip()}
		<a href="/blog" class="group flex items-center gap-2 no-underline hover:text-[#fafaf8]">
			<ArrowLeft size={14} class="transition-transform group-hover:-translate-x-1" /> All stories
		</a>
		<span class="ml-auto">{data.readingTime} min read</span>
		{#if data.places.length > 0}
			<span>{flagEmoji(data.places[0].countryCode)} {data.places[0].name}{data.places.length > 1 ? ` → ${data.places.at(-1)?.name}` : ""}</span>
		{/if}
	{/snippet}
</PageHero>

<div class="relative z-10 bg-paper">
	<PrayerFlags height={160} />

	<div class="mx-auto grid max-w-screen-2xl grid-cols-6 gap-x-6 gap-y-12 px-6 pb-24 pt-8 lg:grid-cols-12">
		<aside class="col-span-full lg:col-span-3">
			<dl class="m-0 grid grid-cols-2 gap-x-6 gap-y-8 lg:sticky lg:top-28 lg:grid-cols-1">
				<div class="border-t border-line pt-3">
					<dt class="label">Date</dt>
					<dd class="m-0 mt-2 text-2xl font-medium tracking-tight">{moment(data.frontmatter.date).format("D MMM YYYY")}</dd>
				</div>
				<div class="border-t border-line pt-3">
					<dt class="label">Reading time</dt>
					<dd class="m-0 mt-2 text-2xl font-medium tracking-tight">{data.readingTime} min</dd>
				</div>
				{#if data.places.length > 0}
					<div class="col-span-full border-t border-line pt-3">
						<dt class="label">On the map that day</dt>
						<dd class="m-0 mt-3">
							<ol class="m-0 list-none p-0">
								{#each data.places as place (place.slug)}
									<li class="m-0">
										<a href="/journey/{place.slug}" class="group flex items-baseline gap-3 py-1 text-lg no-underline hover:text-accent">
											<span aria-hidden="true">{flagEmoji(place.countryCode)}</span>
											<span class="flex-1">{place.name}</span>
											<ArrowUpRight size={14} class="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
										</a>
									</li>
								{/each}
							</ol>
						</dd>
					</div>
				{/if}
			</dl>
		</aside>

		<div class="col-span-full lg:col-span-8 lg:col-start-5">
			<div class="max-w-2xl">
				<AudioPlayer slug={data.slug} />
			</div>
			<article use:customVideos use:zoomablePhotos class="post prose prose-lg max-w-none">
				{@render children?.()}
			</article>
			<Lightbox count={photos.length} bind:index={openPhoto} caption={openPhoto === null ? "" : photos[openPhoto].alt}>
				{#snippet photo(index)}
					<img src={photos[index].src} alt={photos[index].alt} />
				{/snippet}
			</Lightbox>
		</div>
	</div>

	<nav class="mx-auto grid max-w-screen-2xl grid-cols-1 gap-x-6 px-6 sm:grid-cols-2" aria-label="More stories">
		{#if data.last}
			<a href="/blog/{data.last.slug}" class="group border-t border-ink py-8 no-underline">
				<span class="label flex items-center gap-2"><ArrowLeft size={14} class="transition-transform group-hover:-translate-x-1" /> Previous story</span>
				<span class="mt-4 block text-[clamp(2.5rem,6vw,5.5rem)] font-medium leading-[0.9] tracking-[-0.055em] transition-colors group-hover:text-accent">{data.last.title}</span>
			</a>
		{:else}<span></span>{/if}
		{#if data.next}
			<a href="/blog/{data.next.slug}" class="group border-t border-ink py-8 text-right no-underline">
				<span class="label flex items-center justify-end gap-2">Next story <ArrowRight size={14} class="transition-transform group-hover:translate-x-1" /></span>
				<span class="mt-4 block text-[clamp(2.5rem,6vw,5.5rem)] font-medium leading-[0.9] tracking-[-0.055em] transition-colors group-hover:text-accent">{data.next.title}</span>
			</a>
		{/if}
	</nav>

	<aside class="mx-auto grid max-w-screen-2xl grid-cols-6 gap-x-6 gap-y-8 px-6 pb-24 pt-16 lg:grid-cols-12">
		<img src="/images/kyrgizstan.webp" class="col-span-2 m-0 aspect-square w-full rounded-3xl object-cover lg:col-span-2" alt="Moritz" />
		<div class="col-span-full sm:col-span-4 lg:col-span-7 lg:col-start-5">
			<p class="label m-0">Written by</p>
			<p class="m-0 mt-2 text-3xl font-medium tracking-tight">Moritz Utcke</p>
			<p class="m-0 mt-4 text-lg leading-relaxed text-muted">Nach der Schule habe ich mich entschieden mit dem Fahrrad auf Weltreise zu gehen. Vier Wochen nach meinem Abi hab ich mein Zeug gepackt und mich aufs Rad geschwungen. Zwei Jahre später bin ich immer noch hier und fahre mit meinem Kompagnon Joe durch den Dschungel von Laos, die Berge Nepals oder die Kasachische Steppe.</p>
		</div>
	</aside>
</div>

<style>
	@reference "../../../style/main.css";

	/* Text stays in a readable measure; photos and videos run the full width of the column. */
	.post :global(> :not(p:has(img, .video), .video, figure, div)) {
		@apply max-w-2xl;
	}

	.post :global(img) {
		@apply my-0 block max-h-[40rem] w-auto max-w-full cursor-zoom-in rounded-3xl;
	}

	.post :global(p:has(img, .video)) {
		@apply my-12;
	}

	.post :global(> div:has(> .video)) {
		@apply my-12 flex;
	}

	/* Photos written on consecutive lines land in one paragraph: lay them out as a row,
	   two or three across, cropped to the same height. */
	.post :global(p:has(> img + img)) {
		@apply grid grid-cols-2 gap-3;
	}

	.post :global(p:has(> img + img + img)) {
		@apply sm:grid-cols-3;
	}

	.post :global(p:has(> img + img + img + img)) {
		@apply sm:grid-cols-2;
	}

	.post :global(p:has(> img + img) > img) {
		@apply aspect-[4/3] h-full w-full max-h-none object-cover;
	}
</style>
