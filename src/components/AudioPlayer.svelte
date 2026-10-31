<script lang="ts">
	import Wavesurfer from "wavesurfer.js";
	import Pause from "phosphor-svelte/lib/Pause";
	import Play from "phosphor-svelte/lib/Play";
	import { onMount } from "svelte";
	interface Props {
		slug: string;
	}

	let { slug }: Props = $props();

	let wavesurfer: Wavesurfer;

	onMount(() => {
		const styles = getComputedStyle(document.documentElement);
		wavesurfer = Wavesurfer.create({
			container: "#waveform",
			waveColor: styles.getPropertyValue("--color-muted"),
			progressColor: styles.getPropertyValue("--color-accent"),
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

	let visible = $state(false);
	let isPlaying = $state(false);
</script>

<div class="panel mb-8 flex-row items-center gap-4 p-2" class:hidden={!visible} class:flex={visible}>
	<button onclick={togglePlayback} class="btn btn-accent btn-square" aria-label={isPlaying ? "Pause" : "Play"}>
		{#if isPlaying}
		<Pause size={24}></Pause>
		{:else}
		<Play size={24}></Play>
		{/if}
	</button>
	<div id="waveform" class="w-full"></div>
</div>