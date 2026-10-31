<script lang="ts">
	import AudioPlayer from "#components/AudioPlayer.svelte";
	import BlogProgressBar from "#components/BlogProgressBar.svelte";
	import Lightbox from "#components/Lightbox.svelte";
	import VideoPlayer from "#components/VideoPlayer.svelte";
	import moment from "moment";
	import ArrowLeft from "phosphor-svelte/lib/ArrowLeft";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";
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

<div class="mx-auto w-full max-w-screen-xl px-4 py-12 sm:px-6">
	<header>
		<a href="/blog" class="group flex items-center gap-2 self-start font-mono text-[11px] uppercase tracking-[0.18em] no-underline hover:text-accent">
			<ArrowLeft size={14} class="transition-transform group-hover:-translate-x-1" /> All stories
		</a>
		<p class="m-0 mt-10 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
			<span>{moment(data.frontmatter.date).format("DD MMM YYYY")}</span>
			<span>{data.readingTime} min read</span>
			{#each data.frontmatter.tags ?? [] as tag}<span>{tag}</span>{/each}
		</p>
		<h1 class="m-0 mt-6 text-[clamp(3rem,6.5vw,6.5rem)] font-medium leading-[0.9] tracking-[-0.055em]">{data.frontmatter.title}</h1>
		{#if data.frontmatter.description}
			<p class="m-0 mt-8 max-w-3xl text-[clamp(1.25rem,2vw,1.75rem)] leading-snug tracking-tight text-muted">{data.frontmatter.description}</p>
		{/if}
	</header>

	{#if data.frontmatter.image}
		<img src={data.frontmatter.image} alt="" class="m-0 mt-12 aspect-[2/1] max-h-[60vh] w-full rounded-[2rem] object-cover" />
	{/if}

	<div class="mx-auto max-w-screen-lg rounded-[2rem] border border-line bg-card px-5 pb-12 pt-10 shadow-soft sm:px-12 {data.frontmatter.image ? 'relative -mt-16' : 'mt-12'}">
		<div class="mx-auto max-w-2xl">
			<AudioPlayer slug={data.slug} />
		</div>
		<article use:customVideos use:zoomablePhotos class="post prose prose-lg mx-auto max-w-none">
			{@render children?.()}
		</article>
		<Lightbox count={photos.length} bind:index={openPhoto} caption={openPhoto === null ? "" : photos[openPhoto].alt}>
			{#snippet photo(index)}
				<img src={photos[index].src} alt={photos[index].alt} />
			{/snippet}
		</Lightbox>
	</div>

	<nav class="mx-auto mt-10 grid max-w-screen-lg grid-cols-2 gap-4" aria-label="More stories">
		{#if data.last}
			<a href={`/blog/${data.last}`} class="group flex items-center gap-2 rounded-2xl border border-line bg-card p-5 font-mono text-[11px] uppercase tracking-[0.18em] no-underline shadow-soft hover:text-accent">
				<ArrowLeft size={14} class="transition-transform group-hover:-translate-x-1" /> Previous story
			</a>
		{:else}<span></span>{/if}
		{#if data.next}
			<a href={`/blog/${data.next}`} class="group flex items-center justify-end gap-2 rounded-2xl border border-line bg-card p-5 font-mono text-[11px] uppercase tracking-[0.18em] no-underline shadow-soft hover:text-accent">
				Next story <ArrowRight size={14} class="transition-transform group-hover:translate-x-1" />
			</a>
		{/if}
	</nav>

	<aside class="mx-auto mt-4 flex max-w-screen-lg flex-col items-center gap-6 rounded-[2rem] border border-line bg-card p-6 shadow-soft sm:flex-row sm:p-8">
		<img src="/images/kyrgizstan.webp" class="m-0 h-28 w-28 shrink-0 rounded-full object-cover" alt="Moritz" />
		<div class="text-center sm:text-start">
			<p class="label m-0">Written by</p>
			<p class="m-0 mt-1 text-2xl font-medium tracking-tight">Moritz Utcke</p>
			<p class="m-0 mt-3 text-muted">Nach der Schule habe ich mich entschieden mit dem Fahrrad auf Weltreise zu gehen. Vier Wochen nach meinem Abi hab ich mein Zeug gepackt und mich aufs Rad geschwungen. Zwei Jahre später bin ich immer noch hier und fahre mit meinem Kompagnon Joe durch den Dschungel von Laos, die Berge Nepals oder die Kasachische Steppe.</p>
		</div>
	</aside>
</div>

<style>
	@reference "../../../style/main.css";

	/* Text stays in a readable column; photos and videos run the full width of the card. */
	.post :global(> :not(p:has(img, .video), .video, figure, div)) {
		@apply mx-auto max-w-2xl;
	}

	.post :global(img) {
		@apply mx-auto my-0 block max-h-[30rem] w-auto max-w-full cursor-zoom-in rounded-2xl;
	}

	.post :global(p:has(img, .video)) {
		@apply mx-auto my-10 max-w-3xl;
	}

	.post :global(> div:has(> .video)) {
		@apply mx-auto my-10 flex max-w-3xl justify-center;
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
