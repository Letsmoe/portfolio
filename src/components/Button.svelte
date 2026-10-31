<script lang="ts">
	interface Props {
		icon?: string;
		content: string;
		type?: "github" | "default";
		target: string;
	}

	let {
		icon = "",
		content,
		type = "default",
		target
	}: Props = $props();
</script>

<a href={target} class="button w-fit rounded-lg bg-violet-500 text-white border-2 border-violet-900 px-2 py-1 text-center flex items-center gap-2 font-medium text hover:bg-violet-700 transition-colors lg:text-lg lg:px-4 lg:py-2">
	{#if type == "github"}
		<img src="/images/icons/github-mark-white.svg" alt="GitHub" width=20>
	{:else if icon}
		<span class="material-symbols-outlined">{icon}</span>
	{/if}
{content}
</a>