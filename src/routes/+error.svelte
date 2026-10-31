<script lang="ts">
	import { page } from "$app/state";
</script>

<svelte:head>
	<title>{page.status} - Moritz Utcke</title>
</svelte:head>

<div class="mx-auto w-full max-w-screen-xl px-4 py-24">
	<p class="label m-0">Lost the trail</p>
	<h1 class="display m-0 text-[8rem] text-accent sm:text-[12rem]">{page.status}</h1>
	<p class="mb-8 text-lg text-muted">{page.error?.message}</p>
	<a href="/" class="btn btn-ink">Back to the start</a>
</div>
