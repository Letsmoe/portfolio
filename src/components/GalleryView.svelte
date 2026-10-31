<script lang="ts">
	import type { Picture } from "@sveltejs/enhanced-img";
	import X from "phosphor-svelte/lib/X";
	import Masonry from "./Masonry.svelte";

	interface Props {
		sections: {
		title: string;
		folder: string;
		images: [string, Picture][];
		text: string;
	}[];
	}

	let { sections }: Props = $props();

	let hideImageViewer: boolean = $state(true);
	let displayed = $state({ text: "", folder: "", src: "", title: "" });

	function showImage({ title, folder, src, text }) {
		displayed = { title, folder, src, text };
		hideImageViewer = false;
	}
</script>

<div class="w-full">
	<Masonry stretchFirst={true} gridGap={'16px'} colWidth={'minmax(Min(20em, 100%), 1fr)'} items={[...sections.map(x => x.images)].flat(Infinity)}>
{#each sections as { title, folder, images, text }}
	{#each images as [src, image] (src)}
		<div class="relative inline-block group cursor-pointer" onclick={() => showImage({title, folder, src: image.img.src, text})} onkeydown={() => showImage({title, folder, src: image.img.src, text})}>
			<enhanced:img
				src={image}
				alt={text}
				class="relative transition-all hover:brightness-50 focus:brightness-50 max-h-[70vh] w-full object-cover inline-block my-0!"
			/>
			<p class="absolute left-0 bottom-0 px-2 text-ink flex flex-col invisible group-hover:visible group-focus:visible pointer-events-none my-0!">
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
			<button class="btn btn-ghost btn-square text-white" onclick={() => hideImageViewer=true}>
				<X size={24}></X>
			</button>
		</div>
		<div>
			<h1>{displayed.title}</h1>
			<p>{displayed.text}</p>
		</div>
		<img src={displayed.src} class="max-h-[75vh] w-auto" alt="">
	</div>
</div>

<style>
	:global(body:has(.image-viewer:not(.hidden))) {
		overflow: hidden;
	}
</style>
