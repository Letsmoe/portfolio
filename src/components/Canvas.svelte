<script lang="ts">
	import { animate } from "./main";
	import { onMount } from "svelte";

	let canvas: HTMLCanvasElement;
	onMount(() => {
		animate(canvas);
	})
</script>

<canvas bind:this={canvas}></canvas>

<style lang="scss">
	canvas {
		width: 100%;
		height: 100%;
	}
</style>