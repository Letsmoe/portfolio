<script lang="ts">
	export let icon: string = "";
	export let content: string;
	export let type: "github" | "default" = "default";
	export let target: string;
</script>

<a href={target} class="button w-fit rounded-lg bg-violet-600 text-white border-2 border-violet-900 px-4 py-2 text-center flex items-center gap-2 font-medium text-lg hover:bg-violet-700 transition-colors">
	{#if type == "github"}
		<img src="/images/icons/github-mark-white.svg" alt="GitHub" width=20>
	{:else if icon}
		<span class="material-symbols-outlined">{icon}</span>
	{/if}
{content}
</a>