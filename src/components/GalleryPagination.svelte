<script lang="ts">
	interface Props {
		imageCount: number;
		imagesPerPage: number;
		page: number;
	}

	let { imageCount, imagesPerPage, page }: Props = $props();

	let lastPage = Math.ceil(imageCount / imagesPerPage);

	// We want to show a maximum of 5 pagination entries.
	// They should be separated by 2 dots if there are more than 5 pages.
</script>

<nav class="flex gap-1 rounded-full border border-line bg-card p-1 shadow-soft" aria-label="Gallery pages">
	<!-- Last Page -->
	{#if page == lastPage}
		<a href="/gallery/1" class="page-item">1</a>
		<button class="page-item disabled">...</button>
		<a href="/gallery/{page - 2}" class="page-item">{page - 2}</a>
		<a href="/gallery/{page - 1}" class="page-item">{page - 1}</a>
		<a href="/gallery/{page}" class="page-item active">{page}</a>
	{:else if page == lastPage - 1}
		<a href="/gallery/1" class="page-item">1</a>
		<button class="page-item disabled">...</button>
		<a href="/gallery/{page - 2}" class="page-item">{page - 2}</a>
		<a href="/gallery/{page - 1}" class="page-item">{page - 1}</a>
		<a href="/gallery/{page}" class="page-item active">{page}</a>
		<a href="/gallery/{page + 1}" class="page-item">{page + 1}</a>
	{:else if page == 1}
		<a href="/gallery/{page}" class="page-item active">{page}</a>
		<a href="/gallery/{page + 1}" class="page-item">{page + 1}</a>
		<a href="/gallery/{page + 2}" class="page-item">{page + 2}</a>
		<button class="page-item disabled">...</button>
		<a href="/gallery/{lastPage}" class="page-item">{lastPage}</a>
	{:else if page == 2}
		<a href="/gallery/{page - 1}" class="page-item">{page - 1}</a>
		<a href="/gallery/{page}" class="page-item active">{page}</a>
		<a href="/gallery/{page + 1}" class="page-item">{page + 1}</a>
		<a href="/gallery/{page + 2}" class="page-item">{page + 2}</a>
		<button class="page-item disabled">...</button>
		<a href="/gallery/{lastPage}" class="page-item">{lastPage}</a>
	{:else}
		<a href="/gallery/1" class="page-item">1</a>
		<button class="page-item disabled">...</button>
		<a href="/gallery/{page - 1}" class="page-item">{page - 1}</a>
		<a href="/gallery/{page}" class="page-item active">{page}</a>
		<a href="/gallery/{page + 1}" class="page-item">{page + 1}</a>
		<button class="page-item disabled">...</button>
		<a href="/gallery/{lastPage}" class="page-item">{lastPage}</a>
	{/if}
</nav>

<style>
	@reference "../style/main.css";

	.page-item {
		@apply flex min-w-10 items-center justify-center rounded-full px-3 py-2 text-sm font-medium no-underline transition-colors hover:bg-sunken;
	}

	.page-item.active {
		@apply bg-ink text-paper;
	}

	.page-item.disabled {
		@apply pointer-events-none text-muted;
	}
</style>
