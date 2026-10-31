<script lang="ts">
	import GalleryPagination from "#components/GalleryPagination.svelte";
	import Lightbox from "#components/Lightbox.svelte";
	import SectionHeading from "#components/SectionHeading.svelte";
	import type { PageData } from "./$types";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	let photos = $derived(data.sections.flatMap(({ title, text, images }) => images.map(([src, , full]) => ({ src, full, title, text }))));
	let openIndex = $state<number | null>(null);
</script>

<svelte:head>
	<title>Gallery - Moritz Utcke</title>
</svelte:head>

<div class="mx-auto w-full max-w-screen-2xl px-6 py-16">
	<SectionHeading index="04" title="Gallery" meta="Page {data.page} of {Math.ceil(data.imageCount / data.imagesPerPage)}" />
	{#each data.sections as { title, images, text }, sectionIndex (title)}
		<section class={sectionIndex > 0 ? "mt-20" : ""}>
			<h2 class="label m-0 mb-6 flex items-baseline justify-between gap-6 border-t border-ink pt-3">
				<span>{title}</span>
				<span class="text-muted">{images.length} photo{images.length === 1 ? "" : "s"}</span>
			</h2>
			{#if text}<p class="m-0 mb-6 max-w-2xl text-lg text-muted">{text}</p>{/if}
			<div class="columns-1 gap-4 sm:columns-2 lg:columns-3">
				{#each images as [src, image], imageIndex (src)}
					<button
						class="mb-4 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-2xl bg-sunken p-0"
						aria-label="Open {title} photo"
						onclick={() => (openIndex = photos.findIndex((photo) => photo.src === src))}
					>
						<enhanced:img
							src={image}
							alt={text || title}
							sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
							loading={sectionIndex === 0 && imageIndex < 3 ? "eager" : "lazy"}
							decoding="async"
							class="m-0 block w-full transition duration-500 hover:scale-[1.02]"
						/>
					</button>
				{/each}
			</div>
		</section>
	{/each}
	<div class="mt-16 flex justify-center">
		<GalleryPagination imageCount={data.imageCount} imagesPerPage={data.imagesPerPage} page={data.page} />
	</div>
</div>

<Lightbox count={photos.length} bind:index={openIndex} caption={openIndex === null ? "" : photos[openIndex].title}>
	{#snippet photo(index)}
		<enhanced:img src={photos[index].full} alt={photos[index].text || photos[index].title} sizes="100vw" />
	{/snippet}
</Lightbox>
