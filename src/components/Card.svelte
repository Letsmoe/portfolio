<script lang="ts">
	import Button from "./Button.svelte";

	interface Props {
		name: string;
		slug: string;
		image?: string;
		link?: string;
	}

	let {
		name,
		slug,
		image = "",
		link = ""
	}: Props = $props();
</script>

<div class="flex flex-col-reverse border-2 rounded-lg p-4">
	<div>
		<h2>{name}</h2>
		<p class="text-xl mb-4">{slug}</p>
		<Button content="Explore" icon="support" target={link} type="default"></Button>
	</div>
	{#if image}
	<img src={image} alt="" class="w-[250px] self-center">
	{/if}
</div>