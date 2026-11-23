<script lang="ts">
	import { page } from "$app/state";
	import Header from "#components/Header.svelte";
	import { hasHero } from "#lib/hero.ts";
	import "#style/main.css";
	import type { LayoutData } from "./$types";

	interface Props {
		data: LayoutData;
		children?: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	/** The journey map runs under the floating header just like the heroes do. */
	let fullBleed = $derived(page.url.pathname === "/journey" || hasHero(page.url.pathname));
</script>

<Header />
<main class="min-h-screen {fullBleed ? '' : 'pt-[88px]'}">
	{@render children?.()}
</main>

<footer class="border-t border-line bg-paper">
	<div class="mx-auto flex max-w-screen-xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
		<span>© {new Date().getFullYear()} Moritz Utcke</span>
		<span>Built on the road 🚲</span>
		<a href="https://github.com/Letsmoe" class="hover:text-accent" target="_blank" rel="noreferrer">GitHub ↗</a>
	</div>
</footer>
