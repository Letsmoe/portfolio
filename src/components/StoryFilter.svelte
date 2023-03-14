<script lang="ts">
	export let categories: string[];

	function filterCategories(e) {
		const selectedCategory = e.target.value;
		if (selectedCategory == "*") {
			// Show all
			(Array.from(document.querySelectorAll(".story")) as HTMLDivElement[]).map(x => x.style.display = "block");
		} else {
			(Array.from(document.querySelectorAll(".story")) as HTMLDivElement[]).map(x => x.style.display = "block");
			(Array.from(document.querySelectorAll(`.story:not([data-category="${selectedCategory}"])`)) as HTMLDivElement[]).map(x => x.style.display = "none");
		}
	}
</script>
	<select on:input={filterCategories}>
		<option value="*" selected>All</option>
		{#each categories as category}
		<option value={category}>{category}</option>
		{/each}
	</select>