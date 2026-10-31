<script lang="ts">
	import { page } from "$app/state";
	import { PROJECTS } from "#lib/projects.ts";
	import ArrowRight from "phosphor-svelte/lib/ArrowRight";
	import CaretDown from "phosphor-svelte/lib/CaretDown";
	import List from "phosphor-svelte/lib/List";
	import Moon from "phosphor-svelte/lib/Moon";
	import Sun from "phosphor-svelte/lib/Sun";
	import X from "phosphor-svelte/lib/X";
	import { onMount } from "svelte";

	const links = [
		{ href: "/journey", label: "Journey" },
		{ href: "/blog", label: "Blog" },
		{ href: "/gallery", label: "Gallery" },
		{ href: "/about", label: "About" },
	];

	let isOpen = $state(false);
	let projectsOpen = $state(false);
	let theme = $state("light");
	let closeTimer: ReturnType<typeof setTimeout> | undefined;

	let scrollY = $state(0);
	let innerHeight = $state(800);

	/** On the home hero the header dissolves into plain text over the photo. */
	let overHero = $derived(page.url.pathname === "/" && scrollY < innerHeight - 120);

	function isActive(href: string, pathname: string) {
		return href === "/" ? pathname === "/" : pathname.startsWith(href);
	}

	function toggleTheme() {
		theme = theme === "dark" ? "light" : "dark";
		document.documentElement.dataset.theme = theme;
		localStorage.setItem("theme", theme);
	}

	/** Hovering from the trigger into the panel crosses a gap; a short delay keeps the menu open. */
	function openProjects() {
		clearTimeout(closeTimer);
		projectsOpen = true;
	}

	function closeProjectsSoon() {
		clearTimeout(closeTimer);
		closeTimer = setTimeout(() => (projectsOpen = false), 150);
	}

	onMount(() => {
		theme = document.documentElement.dataset.theme ?? "light";
	});

	$effect(() => {
		void page.url.pathname;
		isOpen = false;
		projectsOpen = false;
	});
</script>

<svelte:window
	bind:scrollY
	bind:innerHeight
	onkeydown={(event) => event.key === "Escape" && ((projectsOpen = false), (isOpen = false))}
/>

<header class="header" class:over-hero={overHero}>
	<div class="bar relative flex h-14 items-center gap-1 rounded-full border px-2">
		<a
			href="/"
			class="nav-link mr-auto"
			class:active={isActive("/", page.url.pathname)}
			aria-current={isActive("/", page.url.pathname) ? "page" : undefined}
		>
			Home
		</a>
		<nav class="hidden items-center gap-1 lg:flex">
			<div class="contents" role="presentation" onmouseenter={openProjects} onmouseleave={closeProjectsSoon}>
				<button
					class="nav-link flex items-center gap-1"
					class:active={isActive("/projects", page.url.pathname) || projectsOpen}
					aria-expanded={projectsOpen}
					aria-controls="projects-menu"
					onclick={() => (projectsOpen = !projectsOpen)}
				>
					Projects <CaretDown size={12} weight="bold" class="transition-transform {projectsOpen ? 'rotate-180' : ''}" />
				</button>
			</div>
			{#each links as link}
				<a
					href={link.href}
					class="nav-link"
					class:active={isActive(link.href, page.url.pathname)}
					aria-current={isActive(link.href, page.url.pathname) ? "page" : undefined}
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<button class="btn btn-ghost btn-square" onclick={toggleTheme} aria-label="Toggle colour theme">
			{#if theme === "dark"}<Sun size={18} />{:else}<Moon size={18} />{/if}
		</button>
		<button
			class="btn btn-square lg:hidden"
			onclick={() => (isOpen = !isOpen)}
			aria-expanded={isOpen}
			aria-controls="mobile-nav"
			aria-label={isOpen ? "Close menu" : "Open menu"}
		>
			{#if isOpen}<X size={18} />{:else}<List size={18} />{/if}
		</button>

		{#if projectsOpen}
			<div
				id="projects-menu"
				class="megamenu absolute right-0 top-full mt-2 hidden overflow-hidden rounded-[2rem] border border-line bg-card text-ink shadow-lift lg:block"
				role="region"
				aria-label="Projects"
				onmouseenter={openProjects}
				onmouseleave={closeProjectsSoon}
			>
				<ul class="m-0 grid list-none gap-2 p-3" style="grid-template-columns: repeat({PROJECTS.length}, minmax(0, 1fr))">
					{#each PROJECTS as project (project.slug)}
						<li class="m-0">
							<a href="/projects/{project.slug}" class="group flex h-full flex-col rounded-3xl p-3 no-underline hover:bg-sunken">
								<span class="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-sunken">
									{#if project.cover}
										<img src={project.cover} alt="" class="m-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
									{:else}
										<img src={project.icon} alt="" class="m-0 h-1/2 transition-transform duration-500 group-hover:scale-110" />
									{/if}
								</span>
								<span class="mt-4 flex items-center gap-2.5">
									<img src={project.icon} alt="" class="m-0 h-6 w-6 rounded-md" />
									<span class="text-lg font-semibold tracking-tight group-hover:text-accent">{project.name}</span>
								</span>
								<span class="mt-1.5 text-sm leading-snug text-muted">{project.tagline}</span>
							</a>
						</li>
					{/each}
				</ul>
				<a href="/projects" class="group flex items-center justify-end gap-2 border-t border-line px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted no-underline hover:text-ink">
					All projects <ArrowRight size={14} class="transition-transform group-hover:translate-x-1" />
				</a>
			</div>
		{/if}

		{#if isOpen}
			<nav id="mobile-nav" class="panel absolute right-0 top-full mt-2 flex text-ink w-[min(22rem,calc(100vw-1.5rem))] flex-col rounded-3xl p-2 lg:hidden">
				<p class="label m-0 px-4 pb-1 pt-3">Projects</p>
				{#each PROJECTS as project (project.slug)}
					<a href="/projects/{project.slug}" class="flex items-center gap-3 rounded-2xl px-4 py-2 no-underline hover:bg-sunken">
						<img src={project.icon} alt="" class="m-0 h-7 w-7" />
						<span class="font-medium">{project.name}</span>
					</a>
				{/each}
				<a href="/projects" class="rounded-2xl px-4 py-2 text-sm text-muted no-underline hover:bg-sunken">All projects →</a>
				<hr class="mx-4 my-2 border-line" />
				{#each links as link}
					<a
						href={link.href}
						class="rounded-2xl px-4 py-3 text-lg font-medium no-underline hover:bg-sunken"
						class:active={isActive(link.href, page.url.pathname)}
						aria-current={isActive(link.href, page.url.pathname) ? "page" : undefined}
					>
						{link.label}
					</a>
				{/each}
			</nav>
		{/if}
	</div>
</header>

<style>
	@reference "../style/main.css";

	.nav-link {
		@apply rounded-full px-4 py-2 text-sm font-medium no-underline transition-colors hover:bg-sunken;
	}

	.active {
		@apply bg-ink text-paper hover:bg-ink;
	}

	/* Wide centred bar by default; over the home hero it shrinks to its links and sits
	   transparent in the top right corner. `left` and `translate` together animate the move.
	   `interpolate-size` lets browsers that support it animate to and from `fit-content`. */
	.header {
		position: fixed;
		top: 0.75rem;
		left: 50%;
		z-index: 30;
		translate: -50% 0;
		interpolate-size: allow-keywords;
		transition:
			left 0.7s cubic-bezier(0.22, 1, 0.36, 1),
			translate 0.7s cubic-bezier(0.22, 1, 0.36, 1);
	}

	.header.over-hero {
		left: calc(100% - 0.75rem);
		translate: -100% 0;
	}

	/* The mega menu always spans the wide bar's width, also when the bar has shrunk into the hero's corner. */
	.bar,
	.megamenu {
		width: min(80rem, calc(100vw - 1.5rem));
	}

	.bar {
		@apply border-line bg-card/80 shadow-soft backdrop-blur-xl;
		transition:
			width 0.7s cubic-bezier(0.22, 1, 0.36, 1),
			background-color 0.4s,
			border-color 0.4s,
			box-shadow 0.4s,
			color 0.4s;
	}

	.over-hero .bar {
		@apply border-transparent bg-transparent shadow-none backdrop-blur-none;
		width: fit-content;
		color: #fafaf8;
	}

	.over-hero .nav-link {
		@apply bg-transparent underline-offset-4 hover:bg-transparent hover:underline;
	}

	.over-hero .btn-ghost {
		@apply text-inherit hover:bg-white/15;
	}
</style>
