<script lang="ts">
	import ArrowsOut from "phosphor-svelte/lib/ArrowsOut";
	import Pause from "phosphor-svelte/lib/Pause";
	import Play from "phosphor-svelte/lib/Play";
	import SpeakerHigh from "phosphor-svelte/lib/SpeakerHigh";
	import SpeakerSlash from "phosphor-svelte/lib/SpeakerSlash";

	interface Props {
		src: string;
		type?: string;
	}

	let { src, type }: Props = $props();

	let figure: HTMLElement = $state();
	let video: HTMLVideoElement = $state();
	let paused = $state(true);
	let muted = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);

	let progress = $derived(duration ? (currentTime / duration) * 100 : 0);

	function formatTime(seconds: number) {
		if (!Number.isFinite(seconds)) return "0:00";
		return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
	}

	function togglePlayback() {
		if (paused) video.play();
		else video.pause();
	}
</script>

<figure bind:this={figure} class="video group relative m-0 w-fit max-w-full overflow-hidden rounded-2xl bg-sunken" class:playing={!paused}>
	<video
		bind:this={video}
		bind:paused
		bind:muted
		bind:currentTime
		bind:duration
		playsinline
		preload="metadata"
		class="m-0 block max-h-[30rem] w-auto max-w-full cursor-pointer"
		onclick={togglePlayback}
	>
		<source {src} {type} />
	</video>

	{#if paused}
		<button
			class="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:scale-105 hover:bg-black/50"
			onclick={togglePlayback}
			aria-label="Play video"
		>
			<Play size={20} weight="fill" />
		</button>
	{/if}

	<div class="controls absolute inset-x-2 bottom-2 flex items-center gap-1 rounded-full bg-black/35 py-1 pl-1 pr-3 text-white backdrop-blur-md">
		<button class="control" onclick={togglePlayback} aria-label={paused ? "Play" : "Pause"}>
			{#if paused}<Play size={14} weight="fill" />{:else}<Pause size={14} weight="fill" />{/if}
		</button>
		<input type="range" min="0" max={duration || 0} step="0.01" bind:value={currentTime} class="seek" style="--progress: {progress}%" aria-label="Seek" />
		<span class="ml-2 shrink-0 font-mono text-[10px] tabular-nums opacity-80">{formatTime(currentTime)}</span>
		<button class="control" onclick={() => (muted = !muted)} aria-label={muted ? "Unmute" : "Mute"}>
			{#if muted}<SpeakerSlash size={14} />{:else}<SpeakerHigh size={14} />{/if}
		</button>
		<button class="control -mr-2" onclick={() => figure.requestFullscreen()} aria-label="Fullscreen">
			<ArrowsOut size={14} />
		</button>
	</div>
</figure>

<style>
	@reference "../style/main.css";

	.control {
		@apply flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-white/15;
	}

	.seek {
		@apply h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full;
		background: linear-gradient(to right, white var(--progress), rgb(255 255 255 / 0.3) var(--progress));
	}

	.seek::-webkit-slider-thumb {
		@apply h-2.5 w-2.5 appearance-none rounded-full bg-white;
	}

	.seek::-moz-range-thumb {
		@apply h-2.5 w-2.5 rounded-full border-0 bg-white;
	}

	/* While playing the controls stay out of the way until the pointer is over the video. */
	.controls {
		transition: opacity 0.3s;
	}

	.playing .controls {
		opacity: 0;
	}

	.playing:hover .controls,
	.playing:focus-within .controls {
		opacity: 1;
	}

	:fullscreen video {
		@apply max-h-screen w-full;
	}
</style>
