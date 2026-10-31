<script lang="ts">
	import type { BlogFrontmatter } from "#lib/blog.ts";
	import Fuse from "fuse.js";

	interface Props {
		searchList: { frontmatter: BlogFrontmatter; url: string }[];
	}

	let { searchList }: Props = $props();
	const fuse = new Fuse(searchList, {
		keys: [
			{
				name: "frontmatter.title",
				weight: 4
			},{
				name: "frontmatter.description",
				weight: 1
			}
		],
		includeMatches: true,
		minMatchCharLength: 2,
		threshold: 0.6,});
	function search(e) {
		let query = e.target.value;
		if (query == "") {
			// Show all if nothing was searched
			(Array.from(document.querySelectorAll(".story")) as HTMLDivElement[]).map(x => x.style.display = "");
			return
		}

		const stories = fuse.search(query).map((result) => result.item);

		// Hide all
		(Array.from(document.querySelectorAll(".story")) as HTMLDivElement[]).map(x => x.style.display = "none");

		for (const story of stories) {
			// Show the stories that were found
			let target = (document.querySelector(`.story[data-slug="${story.frontmatter.slug}"]`) as HTMLDivElement);
			if (target) {
				target.style.display = "";
			}
		}
	}
</script>

<input type="text" class="field sm:w-72" aria-label="Search entries" oninput={search} placeholder="Search..." />
