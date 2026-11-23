<script lang="ts">
	interface Props {
		/** [kilometres, metres above sea level] */
		profile: [number, number][];
		/** Top of the vertical scale. Sharing one across chapters keeps the Himalaya taller than the Netherlands. */
		ceiling: number;
		class?: string;
	}

	let { profile, ceiling, class: className = "" }: Props = $props();

	const WIDTH = 200;
	const HEIGHT = 48;

	let area = $derived.by(() => {
		if (profile.length < 2) return "";
		const length = profile[profile.length - 1][0] || 1;
		const points = profile.map(([km, metres]) => `${((km / length) * WIDTH).toFixed(1)},${(HEIGHT - (Math.max(metres, 0) / ceiling) * HEIGHT).toFixed(1)}`);
		return `M0,${HEIGHT} L${points.join(" L")} L${WIDTH},${HEIGHT} Z`;
	});
</script>

{#if area}
	<svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="none" class={className} aria-hidden="true">
		<path d={area} fill="currentColor" />
	</svg>
{/if}
