<script lang="ts">
	import { page } from "$app/state";
	import Header from "#components/Header.svelte";
	import "#style/main.css";
	import type { LayoutData } from "./$types";

	interface Props {
		data: LayoutData;
		children?: import('svelte').Snippet;
	}

	let { data, children }: Props = $props();

	/** These pages start with a full-screen hero or map that runs under the floating header. */
	const FULL_BLEED = ["/", "/journey"];
</script>

<Header />
<main class="min-h-screen {FULL_BLEED.includes(page.url.pathname) ? '' : 'pt-[88px]'}">
	{@render children?.()}
</main>

<footer class="border-t border-line bg-paper">
	<div class="mx-auto flex max-w-screen-xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:justify-between">
		<span>© {new Date().getFullYear()} Moritz Utcke</span>
		<span>Built on the road 🚲</span>
		<a href="https://github.com/Letsmoe" class="hover:text-accent" target="_blank" rel="noreferrer">GitHub ↗</a>
	</div>
</footer>
