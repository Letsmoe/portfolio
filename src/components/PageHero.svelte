<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		/** Without a photo the hero is a rock-black band, like the home page's projects section. */
		image?: string;
		title: string;
		description?: string;
		eyebrow?: string;
		/** Makes the title a link, for teasing a story from the index. */
		href?: string;
		/** Facts along the bottom edge, in the home hero's ticker style. */
		strip?: Snippet;
		/** A post's own title is the page heading; a teased story on the index is not. */
		tag?: "h1" | "h2";
		/** Buttons under the description. The hero carries the dark band's tokens, so `.btn` reads on it. */
		actions?: Snippet;
		/** Artwork beside the title on wide screens, e.g. a project's cover. */
		aside?: Snippet;
	}

	let { image = undefined, title, description = "", eyebrow = "", href = undefined, strip, tag = "h1", actions, aside }: Props = $props();
</script>

<section class="hero band-dark relative flex h-svh min-h-[36rem] flex-col justify-end overflow-hidden bg-[#141314] text-[#fafaf8]">
	{#if image}<img src={image} alt="" class="absolute inset-0 m-0 h-full w-full object-cover" />{/if}

	<div class="copy relative mx-auto w-full max-w-screen-2xl px-6 pb-5">
		<div class={aside ? "grid grid-cols-6 items-end gap-x-6 gap-y-10 lg:grid-cols-12" : ""}>
			<div class={aside ? "col-span-full lg:col-span-6" : ""}>
				{#if eyebrow}
					<p class="m-0 font-mono text-[11px] uppercase tracking-[0.2em] text-[#fafaf8]/85">{eyebrow}</p>
				{/if}
				<svelte:element this={tag} class="m-0 mt-4 max-w-[16ch] text-[clamp(3.5rem,10vw,9rem)] font-medium leading-[0.85] tracking-[-0.055em]">
					{#if href}<a {href} class="no-underline hover:text-[#fafaf8]/85">{title}</a>{:else}{title}{/if}
				</svelte:element>
				{#if description}
					<p class="m-0 mt-6 max-w-2xl text-[clamp(1.15rem,1.8vw,1.6rem)] leading-snug tracking-tight text-[#fafaf8]/90">{description}</p>
				{/if}
				{#if actions}
					<div class="mt-8 flex flex-wrap items-center gap-3">
						{@render actions()}
					</div>
				{/if}
			</div>
			{#if aside}
				<div class="col-span-full hidden sm:block lg:col-span-6">
					{@render aside()}
				</div>
			{/if}
		</div>
		{#if strip}
			<div class="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#fafaf8]/25 pt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[#fafaf8]/85">
				{@render strip()}
			</div>
		{/if}
	</div>
</section>

<style>
	/* Same dusk gradient as the home hero's route strip, tall enough to carry the title. */
	.hero::after {
		content: "";
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgb(12 20 35 / 0.75), rgb(12 20 35 / 0.25) 45%, transparent 70%);
	}

	.copy {
		z-index: 1;
		animation: rise 1.4s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes rise {
		from {
			opacity: 0;
			translate: 0 2rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.copy {
			animation: none;
		}
	}
</style>
