<script lang="ts">
	import Cross1 from "radix-svelte-icons/src/lib/icons/Cross1.svelte";
	import Masonry from "./Masonry.svelte";
	import { ImageMetadata } from "astro";
	import { Image} from "astro:assets"

	export let sections: {
		title: string;
		folder: string;
		images: [string, ImageMetadata][];
		text: string;
	}[];

	let hideImageViewer: boolean = true;
	let displayed = {text: "", folder: "", image: {
		default: {src: ""}
	}, title: ""};

	function showImage({ title, folder, image, text }) {
		displayed = { title, folder, image, text };
		hideImageViewer = false;
	}
</script>

<div class="w-full">
	<Masonry stretchFirst={true} gridGap={'16px'} colWidth={'minmax(Min(20em, 100%), 1fr)'} items={[...sections.map(x => x.images)].flat(Infinity)}>
{#each sections as { title, folder, images, text }}
	{#each images as [src, image]}
		<div class="relative inline-block group cursor-pointer" on:click={() => showImage({title, folder, image, text})} on:keydown={() => showImage({title, folder, image, text})}>
			<Image src={image()} alt={text}></Image>
			<img
				alt={text}
				src={src}
				class="relative transition-all hover:brightness-50 focus:brightness-50 max-h-[70vh] w-full object-cover inline-block !my-0"
			/>
			<p class="absolute left-0 bottom-0 px-2 text-base-content flex flex-col invisible group-hover:visible group-focus:visible pointer-events-none !my-0">
				<span class="m-0 font-bold text-white">{title}</span>
				<span class="m-0">{text}</span>
			</p>
		</div>
	{/each}
{/each}
	</Masonry>
</div>

<div class="fixed top-0 px-6 left-0 bg-[rgba(0,0,0,0.95)] h-full w-full z-50 flex flex-col justify-center image-viewer" class:hidden={hideImageViewer}>
	<div class="max-w-[1200px] mx-auto">
		<div class="flex flex-row justify-end gap-2">
			<button class="btn btn-ghost btn-square" on:click={() => hideImageViewer=true}>
				<Cross1 size={24}></Cross1>
			</button>
		</div>
		<div>
			<h1>{displayed.title}</h1>
			<p>{displayed.text}</p>
		</div>
		<img src={displayed.image.default.src} class="max-h-[75vh] w-auto" alt="">
	</div>
</div>

<style global>
	body:has(.image-viewer:not(.hidden)) {
		overflow: hidden;
	}
</style>