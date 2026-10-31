<script lang="ts">
	interface Props {
		tags: string[];
	}

	let { tags }: Props = $props();

	function filterTags(e: any) {
		const selectedTag = e.target.value;
		if (selectedTag == "*") {
			// Show all
			(Array.from(document.querySelectorAll(".story")) as HTMLDivElement[]).map(x => x.style.display = "");
		} else {
			(Array.from(document.querySelectorAll(".story")) as HTMLDivElement[]).map(x => x.style.display = "");
			(Array.from(document.querySelectorAll(`.story:not([data-tags="${selectedTag}"])`)) as HTMLDivElement[]).map(x => x.style.display = "none");
		}
	}
</script>
	<select class="field" aria-label="Filter by tag" oninput={filterTags}>
		<option value="*" selected>All</option>
		{#each tags as tag}
		<option value={tag}>{tag}</option>
		{/each}
	</select>