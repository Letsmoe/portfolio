<script lang="ts">
	import GalleryPagination from "#components/GalleryPagination.svelte";
	import Lightbox from "#components/Lightbox.svelte";
	import PageHero from "#components/PageHero.svelte";
	import PrayerFlags from "#components/PrayerFlags.svelte";
	import type { PageData } from "./$types";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let photos = $derived(data.sections.flatMap(({ title, text, images }) => images.map(([src, , full]) => ({ src, full, title, text }))));
	let openIndex = $state<number | null>(null);
	let lastPage = $derived(Math.ceil(data.imageCount / data.imagesPerPage));
</script>

<svelte:head>
	<title>Gallery - Moritz Utcke</title>
</svelte:head>

<PageHero
	image={data.sections[0]?.images[0]?.[2].img.src}
	title="Gallery"
	description="{data.imageCount} photos from the road, place by place."
	eyebrow="Page {data.page} of {lastPage}"
>
	{#snippet strip()}
		{#each data.sections as { title } (title)}<span>{title}</span>{/each}
	{/snippet}
</PageHero>

<div class="relative z-10 bg-paper">
	<PrayerFlags height={200} />

	<div class="mx-auto w-full max-w-screen-2xl px-6 pb-24 pt-8">
		{#each data.sections as { title, images, text }, sectionIndex (title)}
			<section class="grid grid-cols-6 gap-x-6 gap-y-8 border-t border-line pb-20 pt-3 lg:grid-cols-12">
				<header class="col-span-full lg:col-span-3">
					<div class="lg:sticky lg:top-28">
						<h2 class="m-0 text-[clamp(3rem,6vw,5.5rem)] font-medium leading-none tracking-[-0.055em]">{title}</h2>
						<p class="label m-0 mt-2">{images.length} photo{images.length === 1 ? "" : "s"}</p>
						{#if text}<p class="m-0 mt-4 text-lg text-muted">{text}</p>{/if}
					</div>
				</header>
				<div class="col-span-full columns-1 gap-6 sm:columns-2 lg:col-span-9 xl:columns-3">
					{#each images as [src, image], imageIndex (src)}
						<button
							class="mb-6 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-3xl bg-sunken p-0"
							aria-label="Open {title} photo"
							onclick={() => (openIndex = photos.findIndex((photo) => photo.src === src))}
						>
							<enhanced:img
								src={image}
								alt={text || title}
								sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
								loading={sectionIndex === 0 && imageIndex < 3 ? "eager" : "lazy"}
								decoding="async"
								class="m-0 block w-full transition duration-700 hover:scale-105"
							/>
						</button>
					{/each}
				</div>
			</section>
		{/each}
		<div class="flex items-center justify-between gap-6 border-t border-ink pt-6">
			<span class="label">Page {data.page} of {lastPage}</span>
			<GalleryPagination imageCount={data.imageCount} imagesPerPage={data.imagesPerPage} page={data.page} />
		</div>
	</div>
</div>

<Lightbox count={photos.length} bind:index={openIndex} caption={openIndex === null ? "" : photos[openIndex].title}>
	{#snippet photo(index)}
		<enhanced:img src={photos[index].full} alt={photos[index].text || photos[index].title} sizes="100vw" />
	{/snippet}
</Lightbox>
