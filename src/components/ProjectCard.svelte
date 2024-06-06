<script lang="ts">
	import { ExternalLink, GithubLogo } from "radix-svelte-icons";

	export let icon: string;
	export let title: string;
	export let description: string;
	export let github: string;
	export let website: string;
</script>

<div class="card w-full bg-base-100 shadow-xl">
	<div class="card-body">
		<div class="flex flex-row gap-4">
			<img src={icon} width="64" class="!my-0" alt={title}>
			<h2 class="card-title !my-0">{title}</h2>
		</div>
		<p>{description}</p>
		<div class="card-actions justify-end gap-4">
			<a href={github} target="_blank" class="btn btn-outline btn-lg"><GithubLogo size={32}></GithubLogo> View on GitHub</a>
			<a href={website} target="_blank" class="btn btn-secondary btn-lg"><ExternalLink size={32}></ExternalLink> Website</a>
		</div>
	</div>
</div>