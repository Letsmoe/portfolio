<script lang="ts">
	import Masonry from "./Masonry.svelte";

	export let sections: {
		title: string;
		folder: string;
		images: {
			default: {
				src: string
			}
		}[];
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
	{#each images as image}
		<div class="relative inline-block group cursor-pointer" on:click={() => showImage({title, folder, image, text})} on:keydown={() => showImage({title, folder, image, text})}>
			<img
				alt={text}
				src={image.default.src}
				class="relative transition-all hover:brightness-50 focus:brightness-50 inline-block"
			/>
			<p class="absolute left-0 bottom-0 px-2 text-white flex flex-col invisible group-hover:visible group-focus:visible pointer-events-none">
				<span class="m-0 font-bold">{title}</span>
				<span class="m-0">{text}</span>
			</p>
		</div>
	{/each}
{/each}
	</Masonry>
</div>

<div class="fixed top-0 px-6 left-0 bg-white h-full w-full z-50 flex flex-col justify-center image-viewer" class:hidden={hideImageViewer}>
	<div class="max-w-[1200px] mx-auto">
		<div class="flex flex-row justify-end gap-2">
			<button class="rounded-lg hover:bg-gray-200 p-1 transition-colors" on:click={() => hideImageViewer=true}>
				<svg width="25" height="25" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>
			</button>
		</div>
		<div>
			<h1>{displayed.title}</h1>
			<p>{displayed.text}</p>
		</div>
		<img src={displayed.image.default.src} class="max-h-[75vh] w-auto">
	</div>
</div>

<style global>
	body:has(.image-viewer:not(.hidden)) {
		overflow: hidden;
	}
</style>