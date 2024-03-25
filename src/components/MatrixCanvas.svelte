<script lang="ts">
	import { onMount } from "svelte";

	let canvas: HTMLCanvasElement;

	onMount(() => {
		// Initialising the canvas
		let ctx = canvas.getContext("2d");

		// Setting the width and height of the canvas
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		// Setting up the letters
		let letters =
			"ABCDEFGHIJKLMNOPQRSTUVXYZABCDEFGHIJKLMNOPQRSTUVXYZABCDEFGHIJKLMNOPQRSTUVXYZABCDEFGHIJKLMNOPQRSTUVXYZABCDEFGHIJKLMNOPQRSTUVXYZABCDEFGHIJKLMNOPQRSTUVXYZ".split(
				""
			);

		// Setting up the columns
		let fontSize = 10,
			columns = canvas.width / fontSize;

		// Setting up the drops
		let drops = [];
		for (let i = 0; i < columns; i++) {
			drops[i] = 1;
		}

		// Setting up the draw function
		function draw() {
			ctx.fillStyle = "rgba(236, 227, 202, .1)";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			for (let i = 0; i < drops.length; i++) {
				let text = letters[Math.floor(Math.random() * letters.length)];
				ctx.fillStyle = "#ef9995";
				ctx.fillText(text, i * fontSize, drops[i] * fontSize);
				drops[i]++;
				if (
					drops[i] * fontSize > canvas.height &&
					Math.random() > 0.95
				) {
					drops[i] = 0;
				}
			}
		}

		// Loop the animation
		setInterval(draw, 33);
	});
</script>

<canvas bind:this={canvas}></canvas>
