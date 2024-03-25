<script lang="ts">
	export let imageCount: number;
	export let imagesPerPage: number;
	export let page: number

	let lastPage = Math.ceil(imageCount / imagesPerPage);

	// We want to show a maximum of 5 pagination entries.
	// They should be separated by 2 dots if there are more than 5 pages.
</script>

<div class="join">
	<!-- Last Page -->
	{#if page == lastPage}
		<a href="/gallery/1" class="btn join-item">1</a>
		<button class="btn join-item btn-disabled">...</button>
		<a href="/gallery/{page - 2}" class="btn join-item">{page - 2}</a>
		<a href="/gallery/{page - 1}" class="btn join-item">{page - 1}</a>
		<a href="/gallery/{page}" class="btn join-item btn-primary">{page}</a>
	{:else if page == lastPage - 1}
		<a href="/gallery/1" class="btn join-item">1</a>
		<button class="btn join-item btn-disabled">...</button>
		<a href="/gallery/{page - 2}" class="btn join-item">{page - 2}</a>
		<a href="/gallery/{page - 1}" class="btn join-item">{page - 1}</a>
		<a href="/gallery/{page}" class="btn join-item btn-primary">{page}</a>
		<a href="/gallery/{page + 1}" class="btn join-item">{page + 1}</a>
	{:else if page == 1}
		<a href="/gallery/{page}" class="btn join-item btn-primary">{page}</a>
		<a href="/gallery/{page + 1}" class="btn join-item">{page + 1}</a>
		<a href="/gallery/{page + 1}" class="btn join-item">{page + 2}</a>
		<button class="btn join-item btn-disabled">...</button>
		<a href="/gallery/{lastPage}" class="btn join-item">{lastPage}</a>
	{:else if page == 2}
		<a href="/gallery/{page - 1}" class="btn join-item">{page - 1}</a>
		<a href="/gallery/{page}" class="btn join-item btn-primary">{page}</a>
		<a href="/gallery/{page + 1}" class="btn join-item">{page + 1}</a>
		<a href="/gallery/{page + 1}" class="btn join-item">{page + 2}</a>
		<button class="btn join-item btn-disabled">...</button>
		<a href="/gallery/{lastPage}" class="btn join-item">{lastPage}</a>
	{:else}
		<a href="/gallery/1" class="btn join-item">1</a>
		<button class="btn join-item btn-disabled">...</button>
		<a href="/gallery/{page - 1}" class="btn join-item">{page - 1}</a>
		<a href="/gallery/{page}" class="btn join-item btn-primary">{page}</a>
		<a href="/gallery/{page + 1}" class="btn join-item">{page + 1}</a>
		<button class="btn join-item btn-disabled">...</button>
		<a href="/gallery/{lastPage}" class="btn join-item">{lastPage}</a>
	{/if}
</div>