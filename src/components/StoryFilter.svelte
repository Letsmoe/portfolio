<script lang="ts">
	export let tags: string[];

	function filterTags(e: any) {
		const selectedTag = e.target.value;
		if (selectedTag == "*") {
			// Show all
			(Array.from(document.querySelectorAll(".story")) as HTMLDivElement[]).map(x => x.style.display = "block");
		} else {
			(Array.from(document.querySelectorAll(".story")) as HTMLDivElement[]).map(x => x.style.display = "block");
			(Array.from(document.querySelectorAll(`.story:not([data-tags="${selectedTag}"])`)) as HTMLDivElement[]).map(x => x.style.display = "none");
		}
	}
</script>
	<select class="select select-bordered" on:input={filterTags}>
		<option value="*" selected>All</option>
		{#each tags as tag}
		<option value={tag}>{tag}</option>
		{/each}
	</select>