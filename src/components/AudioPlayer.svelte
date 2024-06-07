<script lang="ts">
	export let slug: string;
	import Wavesurfer from "wavesurfer.js";
	import { Play, Pause } from "radix-svelte-icons"
	import { onMount } from "svelte";

	let wavesurfer: Wavesurfer;

	onMount(() => {
		wavesurfer = Wavesurfer.create({
			container: "#waveform",
			waveColor: "violet",
			progressColor: "purple",
			barWidth: 3,
			height: 60,
			url: `/audio/${slug}.wav`
		});
		
		

		wavesurfer.on("ready", () => {
			visible = true;
		});
	})

	function togglePlayback() {
		if (wavesurfer && wavesurfer.isPlaying()) {
			wavesurfer.playPause();
			isPlaying = false;
		} else {
			wavesurfer.playPause();
			isPlaying = true;
			wavesurfer.on("finish", () => {
				wavesurfer.stop();
				isPlaying = false;
			});
		}
	}

	let visible = false;
	let isPlaying = false;
</script>

<div class="flex-row border border-gray-700 rounded-lg items-center p-2 gap-4" class:hidden={!visible} class:flex={visible}>
	<button on:click={togglePlayback} class="btn btn-circle btn-ghost p-1">
		{#if isPlaying}
		<Pause size={24}></Pause>
		{:else}
		<Play size={24}></Play>
		{/if}
	</button>
	<div id="waveform" class="w-full"></div>
</div>