<script lang="ts">
	import PageHero from "#components/PageHero.svelte";
	import PrayerFlags from "#components/PrayerFlags.svelte";
	import { PROJECTS } from "#lib/projects.ts";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";
	import DownloadSimple from "phosphor-svelte/lib/DownloadSimple";
	import Globe from "phosphor-svelte/lib/Globe";
</script>

<svelte:head>
	<title>Projects - Moritz Utcke</title>
</svelte:head>

<PageHero
	title="Things I build"
	eyebrow="{PROJECTS.length} projects · Source code & downloads"
	description="A company, a programming language, an app for movie night and one for music. Each page links the source and every build that is ready to download."
>
	{#snippet strip()}
		{#each PROJECTS as project (project.slug)}
			<a href="/projects/{project.slug}" class="flex items-center gap-2 no-underline hover:text-[#fafaf8]">
				<img src={project.icon} alt="" class="m-0 h-5 w-5 rounded-md" />
				{project.name}
			</a>
		{/each}
	{/snippet}
</PageHero>

<div class="relative z-10 bg-paper">
<PrayerFlags height={200} />

<div class="mx-auto max-w-screen-2xl px-6 pb-24 pt-8">
	<ol class="m-0 list-none border-b border-line p-0">
		{#each PROJECTS as project, index (project.slug)}
			<li class="m-0 border-t border-line">
				<a href="/projects/{project.slug}" class="group grid grid-cols-6 gap-x-6 gap-y-6 py-12 no-underline lg:grid-cols-12">
					<span class="col-span-full font-mono text-[11px] uppercase tracking-[0.18em] text-muted lg:col-span-1 lg:pt-4">
						{String(index + 1).padStart(2, "0")}
					</span>
					<div class="col-span-full flex items-center gap-5 lg:col-span-5">
						<img src={project.icon} alt="" class="m-0 h-16 w-16 shrink-0 rounded-2xl transition-transform duration-500 group-hover:-rotate-6" />
						<h2 class="m-0 text-[clamp(3rem,6vw,5.5rem)] font-medium leading-[0.9] tracking-[-0.05em] transition-colors group-hover:text-accent">
							{project.name}
						</h2>
					</div>
					<div class="col-span-5 flex flex-col gap-4 lg:col-span-5">
						<p class="m-0 text-2xl leading-snug tracking-tight">{project.tagline}</p>
						<p class="m-0 text-lg leading-relaxed text-muted">{project.description}</p>
						<div class="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-rock">
							<span>{project.stack.join(" / ")}</span>
							{#if project.downloads.length > 0}
								<span class="flex items-center gap-1.5 text-accent">
									<DownloadSimple size={12} weight="bold" />
									{project.downloads.length} download{project.downloads.length === 1 ? "" : "s"}
								</span>
							{:else if project.links.website}
								<span class="flex items-center gap-1.5 text-accent">
									<Globe size={12} weight="bold" />
									{new URL(project.links.website).host}
								</span>
							{/if}
						</div>
					</div>
					<span class="col-span-1 flex justify-end lg:pt-4">
						<span class="flex h-12 w-12 items-center justify-center rounded-full border border-line transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-on-accent">
							<ArrowRight size={18} class="transition-transform group-hover:translate-x-0.5" />
						</span>
					</span>
				</a>
			</li>
		{/each}
	</ol>
</div>
</div>
