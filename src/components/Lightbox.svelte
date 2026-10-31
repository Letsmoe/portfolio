<script lang="ts">
	import ArrowLeft from "phosphor-svelte/lib/ArrowLeft";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";
	import X from "phosphor-svelte/lib/X";
	import type { Snippet } from "svelte";

	interface Props {
		/** Number of photos the viewer steps through. */
		count: number;
		/** The open photo, or null while closed. */
		index: number | null;
		caption?: string;
		/** Renders the photo at `index`, sized to fit the screen. */
		photo: Snippet<[number]>;
	}

	let { count, index = $bindable(), caption = "", photo }: Props = $props();

	let dialog: HTMLDialogElement = $state();

	$effect(() => {
		if (index !== null && !dialog.open) dialog.showModal();
		if (index === null && dialog.open) dialog.close();
	});

	function step(offset: number) {
		if (index === null) return;
		index = (index + offset + count) % count;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (index === null) return;
		if (event.key === "ArrowRight") step(1);
		if (event.key === "ArrowLeft") step(-1);
	}}
/>

<dialog
	bind:this={dialog}
	class="lightbox m-0 h-full max-h-none w-full max-w-none bg-transparent p-0"
	onclose={() => (index = null)}
	onclick={(event) => event.target === event.currentTarget && dialog.close()}
>
	{#if index !== null}
		<div class="pointer-events-none flex h-full w-full items-center justify-center p-4 sm:p-12">
			{#key index}{@render photo(index)}{/key}
		</div>
		<p class="label absolute bottom-5 left-6 m-0 text-white/80">{caption ? `${caption} · ` : ""}{index + 1} / {count}</p>
		<div class="absolute right-4 top-4 flex gap-2">
			{#if count > 1}
				<button class="lightbox-button" onclick={() => step(-1)} aria-label="Previous photo"><ArrowLeft size={18} /></button>
				<button class="lightbox-button" onclick={() => step(1)} aria-label="Next photo"><ArrowRight size={18} /></button>
			{/if}
			<button class="lightbox-button" onclick={() => dialog.close()} aria-label="Close"><X size={18} /></button>
		</div>
	{/if}
</dialog>

<style>
	@reference "../style/main.css";

	.lightbox::backdrop {
		background: rgb(10 10 12 / 0.92);
	}

	.lightbox-button {
		@apply flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur hover:bg-white/20;
	}

	.lightbox :global(img) {
		@apply pointer-events-auto m-0 max-h-full w-auto max-w-full rounded-xl object-contain;
	}
</style>
