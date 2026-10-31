<script lang="ts">
	function onWindowScroll() {
		const article = document.querySelector("article");
		const articleHeight = article.scrollHeight;		
		const scrolled = Math.min(100, (window.scrollY / (articleHeight - article.getBoundingClientRect().top)) * 200);
		progressBar.style.width = scrolled + "%";
	}

	let progressBar: HTMLDivElement = $state();
</script>

<svelte:window onscroll={onWindowScroll}></svelte:window>

<div class="fixed top-0 z-40 h-1 w-0 bg-accent" bind:this={progressBar}></div>