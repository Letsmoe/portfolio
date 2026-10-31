<script lang="ts">
	import { cellLight, createPrayerFlags, FLAG_COLUMNS, FLAG_ROWS, nearestFabric, STEP, stepCloth, type Cloth } from "#lib/cloth.ts";
	import { onMount } from "svelte";

	interface Props {
		/** Height of the strip in CSS pixels; the string sags into it and the flags hang below. */
		height?: number;
		class?: string;
	}

	let { height = 220, class: className = "" }: Props = $props();

	/** Oblique projection: cloth blown towards the viewer drifts a little right and down on screen. */
	const DEPTH_X = 0.22;
	const DEPTH_Y = 0.1;

	let canvas: HTMLCanvasElement;

	onMount(() => {
		const context = canvas.getContext("2d");
		if (!context) return;
		const styles = getComputedStyle(document.documentElement);
		const colour = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
		// Blue, white, red, green, yellow: sky, cloud, fire, water, earth.
		const palette = [colour("--color-flag-blue", "#225ea7"), "#fbfbf8", colour("--color-accent", "#c23b40"), colour("--color-flag-green", "#3f7f78"), colour("--color-flag-yellow", "#d9971f")];
		const ink = colour("--color-ink", "#1c1a1b");

		let cloth: Cloth;
		let width = 0;
		const pointer = { x: 0, y: 0, lastX: 0, lastY: 0, inside: false };

		function build() {
			width = canvas.clientWidth;
			const dpr = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			context!.setTransform(dpr, 0, 0, dpr, 0, 0);
			cloth = createPrayerFlags(width, height);
		}

		function step() {
			const input = pointer.inside ? { x: pointer.x, y: pointer.y, deltaX: pointer.x - pointer.lastX, deltaY: pointer.y - pointer.lastY } : null;
			stepCloth(cloth, input);
			pointer.lastX = pointer.x;
			pointer.lastY = pointer.y;
		}

		function draw() {
			const { x, y, z } = cloth;
			const screenX = (index: number) => x[index] + z[index] * DEPTH_X;
			const screenY = (index: number) => y[index] + z[index] * DEPTH_Y;
			context!.clearRect(0, 0, width, height);

			context!.beginPath();
			for (const index of cloth.rope) context!.lineTo(screenX(index), screenY(index));
			context!.globalAlpha = 0.55;
			context!.strokeStyle = ink;
			context!.lineWidth = 1.2;
			context!.stroke();

			for (const { grid, colour } of cloth.flags) {
				const fill = palette[colour % palette.length];
				for (let row = 1; row < FLAG_ROWS; row++) {
					for (let column = 1; column < FLAG_COLUMNS; column++) {
						const topLeft = grid[row - 1][column - 1];
						const topRight = grid[row - 1][column];
						const bottomRight = grid[row][column];
						const bottomLeft = grid[row][column - 1];
						context!.beginPath();
						context!.moveTo(screenX(topLeft), screenY(topLeft));
						context!.lineTo(screenX(topRight), screenY(topRight));
						context!.lineTo(screenX(bottomRight), screenY(bottomRight));
						context!.lineTo(screenX(bottomLeft), screenY(bottomLeft));
						context!.closePath();
						context!.globalAlpha = 1;
						context!.fillStyle = fill;
						context!.strokeStyle = fill;
						context!.lineWidth = 0.6;
						context!.fill();
						context!.stroke();
						const shade = 1 - cellLight(cloth, topLeft, topRight, bottomLeft);
						if (shade > 0.04) {
							context!.globalAlpha = Math.min(shade * 0.55, 0.45);
							context!.fillStyle = "#000";
							context!.fill();
						}
					}
				}

				// Faint printed lines, like the mantras on real flags.
				context!.globalAlpha = 0.16;
				context!.strokeStyle = "#000";
				context!.lineWidth = 1;
				context!.beginPath();
				for (let row = 2; row < FLAG_ROWS - 1; row++) {
					const left = grid[row][0];
					const right = grid[row][FLAG_COLUMNS - 1];
					const fromX = screenX(left);
					const fromY = screenY(left);
					const spanX = screenX(right) - fromX;
					const spanY = screenY(right) - fromY;
					context!.moveTo(fromX + spanX * 0.18, fromY + spanY * 0.18);
					context!.lineTo(fromX + spanX * 0.82, fromY + spanY * 0.82);
				}
				context!.stroke();
			}
			context!.globalAlpha = 1;
		}

		build();

		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			const still = () => {
				build();
				for (let index = 0; index < 240; index++) stepCloth(cloth);
				draw();
			};
			still();
			const observer = new ResizeObserver(still);
			observer.observe(canvas);
			return () => observer.disconnect();
		}

		let frame = 0;
		let last = 0;
		let accumulator = 0;
		let visible = false;
		const loop = (now: number) => {
			frame = requestAnimationFrame(loop);
			accumulator += Math.min((now - (last || now)) / 1000, 0.1);
			last = now;
			while (accumulator >= STEP) {
				step();
				accumulator -= STEP;
			}
			draw();
		};
		const start = () => {
			if (frame || !visible || document.hidden) return;
			last = 0;
			frame = requestAnimationFrame(loop);
		};
		const stop = () => {
			cancelAnimationFrame(frame);
			frame = 0;
		};

		const intersection = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting;
			if (visible) start();
			else stop();
		});
		intersection.observe(canvas);
		const onVisibility = () => (document.hidden ? stop() : start());
		document.addEventListener("visibilitychange", onVisibility);

		let lastWidth = canvas.clientWidth;
		const resize = new ResizeObserver(() => {
			if (canvas.clientWidth === lastWidth) return;
			lastWidth = canvas.clientWidth;
			build();
		});
		resize.observe(canvas);

		const localPoint = (event: PointerEvent) => {
			const bounds = canvas.getBoundingClientRect();
			return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
		};
		const onMove = (event: PointerEvent) => {
			const point = localPoint(event);
			if (!pointer.inside) {
				pointer.lastX = point.x;
				pointer.lastY = point.y;
			}
			pointer.x = point.x;
			pointer.y = point.y;
			pointer.inside = true;
		};
		const onLeave = () => {
			if (cloth.grabbed < 0) pointer.inside = false;
		};
		const onDown = (event: PointerEvent) => {
			// Touch keeps scrolling the page; only a mouse or pen picks a flag up.
			if (event.pointerType === "touch") return;
			const point = localPoint(event);
			cloth.grabbed = nearestFabric(cloth, point.x, point.y);
			if (cloth.grabbed < 0) return;
			canvas.setPointerCapture(event.pointerId);
			canvas.style.cursor = "grabbing";
		};
		const onUp = (event: PointerEvent) => {
			cloth.grabbed = -1;
			canvas.style.cursor = "";
			if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
		};
		canvas.addEventListener("pointermove", onMove);
		canvas.addEventListener("pointerleave", onLeave);
		canvas.addEventListener("pointerdown", onDown);
		canvas.addEventListener("pointerup", onUp);
		canvas.addEventListener("pointercancel", onUp);

		return () => {
			stop();
			intersection.disconnect();
			resize.disconnect();
			document.removeEventListener("visibilitychange", onVisibility);
			canvas.removeEventListener("pointermove", onMove);
			canvas.removeEventListener("pointerleave", onLeave);
			canvas.removeEventListener("pointerdown", onDown);
			canvas.removeEventListener("pointerup", onUp);
			canvas.removeEventListener("pointercancel", onUp);
		};
	});
</script>

<canvas bind:this={canvas} class="block w-full cursor-grab touch-pan-y {className}" style="height: {height}px" aria-hidden="true"></canvas>
