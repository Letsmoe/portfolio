<script lang="ts">
	import { BoidsCanvas } from "./Boids";
	import { onMount } from "svelte";
	import { Color, hslToHex } from "./ColorGenerator";
	import { Boid } from "./Boids/Boid";

	let canvas: HTMLCanvasElement;
	onMount(() => {
		// Generate six different colors.
		const colors = [];
		for (let i = 0; i < 12; i++) {
			let color = new Color(i * 20);
			colors.push(hslToHex(color.hsl))
		}

		const boidsCanvas = new BoidsCanvas(canvas, {
			background: "#fafafa",
			density: 10000,
			speed: 2,
			interactive: true,
			mixedSizes: true,
			boidColours: colors
		});
	})
</script>

<canvas class="w-full h-full" bind:this={canvas}></canvas>