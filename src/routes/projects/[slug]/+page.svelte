<script lang="ts">
	import { formatBytes } from "#lib/github.ts";
	import { isLocalDownload, type DownloadPlatform } from "#lib/projects.ts";
	import AndroidLogo from "phosphor-svelte/lib/AndroidLogo";
	import ArrowLeft from "phosphor-svelte/lib/ArrowLeft";
	import ArrowUpRight from "phosphor-svelte/lib/ArrowUpRight";
	import DownloadSimple from "phosphor-svelte/lib/DownloadSimple";
	import GithubLogo from "phosphor-svelte/lib/GithubLogo";
	import Globe from "phosphor-svelte/lib/Globe";
	import type { PageData } from "./$types";

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	const PLATFORM_NAMES: Record<DownloadPlatform, string> = {
		android: "Android",
		docker: "Docker",
		linux: "Linux",
		macos: "macOS",
		windows: "Windows",
		source: "Source",
		any: "File",
	};

	let project = $derived(data.project);
	let release = $derived(data.release);
	let android = $derived(release?.assets.find((asset) => asset.platform === "android"));
	let downloads = $derived([
		...(release?.assets ?? []).map((asset) => ({
			label: asset.name,
			platform: asset.platform,
			href: asset.href,
			detail: `${release?.tag} · ${formatBytes(asset.size)}`,
		})),
		...project.downloads.map((download) => ({ ...download, detail: [download.version, download.size].filter(Boolean).join(" · ") })),
	]);
	let releasedOn = $derived(release ? new Date(release.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null);
</script>

<svelte:head>
	<title>{project.name} - Moritz Utcke</title>
	<meta name="description" content={project.description} />
</svelte:head>

<section class="band-dark -mt-[88px] bg-paper px-6 pb-16 pt-[120px] text-ink">
	<div class="mx-auto grid max-w-screen-2xl grid-cols-6 gap-x-6 gap-y-12 lg:grid-cols-12">
		<div class="col-span-full flex flex-col lg:col-span-6">
			<a href="/projects" class="group flex items-center gap-2 self-start font-mono text-[11px] uppercase tracking-[0.18em] no-underline hover:text-accent">
				<ArrowLeft size={14} class="transition-transform group-hover:-translate-x-1" /> All projects
			</a>
			<div class="mt-12 flex items-center gap-4">
				<img src={project.icon} alt="" class="m-0 h-14 w-14 rounded-2xl" />
				<span class="label">Project {String(data.index + 1).padStart(2, "0")}</span>
			</div>
			<h1 class="m-0 mt-6 text-[clamp(4.5rem,12vw,11rem)] font-medium leading-[0.82] tracking-[-0.06em]">{project.name}</h1>
			<p class="m-0 mt-8 max-w-xl text-[clamp(1.4rem,2.2vw,2rem)] leading-tight tracking-tight">{project.tagline}</p>

			<div class="mt-10 flex flex-wrap items-center gap-3">
				{#if android}
					<a href={android.href} class="btn btn-accent px-6 py-3.5 text-base">
						<AndroidLogo size={20} weight="fill" /> Download for Android
						<span class="font-mono text-[11px] opacity-80">{release?.tag} · {formatBytes(android.size)}</span>
					</a>
				{:else if downloads.length > 0}
					<a href="#downloads" class="btn btn-accent px-6 py-3.5 text-base"><DownloadSimple size={20} weight="bold" /> Downloads</a>
				{/if}
				{#if project.links.website}
					<a href={project.links.website} target="_blank" rel="noreferrer" class="btn btn-accent px-6 py-3.5 text-base">
						<Globe size={20} weight="bold" /> {new URL(project.links.website).host}
					</a>
				{/if}
				{#if project.links.github}
					<a href={project.links.github} target="_blank" rel="noreferrer" class="btn px-6 py-3.5 text-base">
						<GithubLogo size={20} weight="bold" /> GitHub
					</a>
				{/if}
			</div>
			{#if project.stack.length > 0}
				<p class="m-0 mt-10 font-mono text-[11px] uppercase tracking-[0.18em] text-rock">{project.stack.join(" / ")}</p>
			{/if}
		</div>
		{#if project.cover}
			<img src={project.cover} alt="" class="col-span-full m-0 w-full self-end rounded-3xl lg:col-span-6" />
		{/if}
	</div>
</section>

<div class="mx-auto grid max-w-screen-2xl grid-cols-6 gap-x-6 gap-y-16 px-6 py-20 lg:grid-cols-12">
	{#if downloads.length > 0 || project.repository}
	<aside class="col-span-full lg:sticky lg:top-[100px] lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:self-start" id="downloads">
		<h2 class="label m-0 border-t border-ink pt-3">Downloads</h2>
		{#if downloads.length > 0}
			<ul class="m-0 mt-4 list-none border-b border-line p-0">
				{#each downloads as download}
					<li class="m-0 border-t border-line">
						<a
							href={download.href}
							class="group flex items-center gap-4 py-4 no-underline hover:text-accent"
							download={isLocalDownload(download) ? "" : undefined}
							target={isLocalDownload(download) ? undefined : "_blank"}
							rel={isLocalDownload(download) ? undefined : "noreferrer"}
						>
							<span class="w-16 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{PLATFORM_NAMES[download.platform]}</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-medium">{download.label}</span>
								{#if download.detail}<span class="block font-mono text-[11px] text-muted">{download.detail}</span>{/if}
							</span>
							<ArrowUpRight size={18} class="shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="m-0 mt-4 text-muted">No builds yet.</p>
		{/if}
		{#if release}
			<p class="m-0 mt-4 text-sm text-muted">
				{release.name}, released {releasedOn}.
				<a href={release.href} target="_blank" rel="noreferrer" class="text-ink underline decoration-accent decoration-2 underline-offset-2">Release notes ↗</a>
			</p>
		{:else if project.repository}
			<p class="m-0 mt-4 text-sm text-muted">No release published yet; the app builds from source in the meantime.</p>
		{/if}
	</aside>
	{/if}

	<article class="col-span-full lg:col-span-7 lg:row-start-1">
		{#if data.readme}
			<p class="label m-0 border-t border-ink pt-3">README.md</p>
			<div class="readme prose prose-lg mt-8 max-w-none">
				<!-- The README comes from the project's own repository, rendered by marked on the server. -->
				{@html data.readme}
			</div>
		{:else}
			<p class="m-0 text-[clamp(1.4rem,2.2vw,2rem)] leading-tight tracking-tight">{project.description}</p>
			{#if project.features.length > 0}
				<ul class="m-0 mt-10 list-none border-b border-line p-0">
					{#each project.features as feature}
						<li class="m-0 border-t border-line py-3 text-lg">{feature}</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</article>
</div>

<style>
	@reference "../../../style/main.css";

	.readme :global(h2) {
		@apply mt-16 text-4xl font-medium tracking-[-0.03em];
	}

	.readme :global(h2:first-child) {
		@apply mt-0;
	}

	.readme :global(pre) {
		@apply rounded-2xl;
	}

	.readme :global(blockquote) {
		@apply font-normal not-italic text-muted;
	}
</style>
