<script lang="ts">
	function onWindowScroll() {
		const article = document.querySelector("article");
		const articleHeight = article.scrollHeight;		
		const scrolled = Math.min(100, (window.scrollY / (articleHeight - article.getBoundingClientRect().top)) * 200);
		progressBar.style.width = scrolled + "%";
	}

	let progressBar: HTMLDivElement;
</script>

<svelte:window on:scroll={onWindowScroll}></svelte:window>

<div class="fixed top-[80px] h-1 w-0 bg-violet-500" bind:this={progressBar}></div>