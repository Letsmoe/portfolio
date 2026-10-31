<script lang="ts">
    import Hero from "#components/Hero.svelte";
    import JourneyMap from "#components/JourneyMap.svelte";
    import PrayerFlags from "#components/PrayerFlags.svelte";
    import SectionHeading from "#components/SectionHeading.svelte";
    import { flagEmoji } from "#lib/journey.ts";
    import { isLocalDownload, PROJECTS } from "#lib/projects.ts";
    import ArrowRight from "phosphor-svelte/lib/ArrowRight";
    import ArrowUpRight from "phosphor-svelte/lib/ArrowUpRight";
    import type { PageData } from "./$types";

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();

    const languages = [
        "Python",
        "Go",
        "C++",
        "C",
        "x86-64 NASM",
        "Lisp",
        "Racket",
        "Lua",
        "PHP",
        "Ruby",
        "TypeScript",
        "META",
        "Gyro",
        "Bash",
    ];

    let routeFigures = $derived([
        [data.stats.kilometres.toLocaleString("en-US"), "Kilometres"],
        [String(data.stats.countries), "Countries"],
        [String(data.stats.days), "Days"],
        ["> 36000", "Photos"],
    ]);

    function postcardDate(time: string, timeZone: string) {
        return new Date(time).toLocaleDateString("en-GB", {
            month: "short",
            year: "numeric",
            timeZone,
        });
    }
</script>

<svelte:head>
    <title>Moritz Utcke</title>
</svelte:head>

<Hero stats={data.stats} countries={data.countries} />

<div class="relative z-10 bg-paper">
    <PrayerFlags height={200} />
    <section class="mx-auto max-w-screen-2xl px-6 pb-12 pt-8">
        <SectionHeading tag="h2" index="01" title="The long way round" />
        <div class="grid grid-cols-6 gap-x-6 lg:grid-cols-12">
            <p
                class="col-span-full m-0 text-[clamp(1.5rem,2.6vw,2.4rem)] leading-[1.15] tracking-tight lg:col-span-7 lg:col-start-6"
            >
                4 years ago I rode off on a bicycle and never quite stopped. I
                spent countless nights in my tent, met thousands of people and
                spent a significant part of my life on the road.
            </p>
        </div>
        <dl class="m-0 mt-16 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
            {#each routeFigures as [value, unit]}
                <div class="border-t border-line pt-3">
                    <dt class="label">{unit}</dt>
                    <dd
                        class="m-0 mt-3 text-[clamp(2.75rem,6vw,5.5rem)] font-medium leading-none tracking-[-0.05em]"
                    >
                        {value}
                    </dd>
                </div>
            {/each}
        </dl>
    </section>

    <section class="mx-auto max-w-screen-2xl px-3 sm:px-6">
        <div
            class="relative h-[80vh] min-h-[28rem] overflow-hidden rounded-[2rem] border border-line"
        >
            <JourneyMap data={data.map} embedded />
        </div>
        <a
            href="/journey"
            class="group mt-4 flex items-center justify-end gap-2 font-mono text-[11px] uppercase tracking-[0.18em] no-underline hover:text-accent"
        >
            Open the full map <ArrowRight
                size={14}
                class="transition-transform group-hover:translate-x-1"
            />
        </a>
    </section>

    <section class="py-24" aria-labelledby="postcards-title">
        <div
            class="mx-auto mb-8 flex max-w-screen-2xl items-end justify-between gap-6 px-6"
        >
            <h2
                id="postcards-title"
                class="m-0 font-hand text-4xl leading-none sm:text-5xl"
            >
                Postcards from every country
            </h2>
            <p class="label m-0 hidden sm:block">Scroll →</p>
        </div>
        <ol
            class="postcards m-0 flex list-none gap-6 overflow-x-auto px-6 pb-8 pt-4"
        >
            {#each data.postcards as card, index (card.slug)}
                <li
                    class="m-0 shrink-0 snap-start"
                    style="--tilt: {[-2.5, 1.5, -1, 2.5, -1.8, 0.8][
                        index % 6
                    ]}deg"
                >
                    <a
                        href="/journey/{card.slug}"
                        class="postcard group block w-56 bg-card p-2.5 pb-4 no-underline shadow-soft sm:w-64"
                    >
                        <img
                            src={card.photo.thumb}
                            alt="{card.name}, {card.country}"
                            width={card.photo.width}
                            height={card.photo.height}
                            loading="lazy"
                            class="m-0 aspect-[4/5] w-full object-cover"
                        />
                        <span
                            class="mt-3 flex items-baseline justify-between gap-2"
                        >
                            <span
                                class="truncate font-hand text-2xl leading-none group-hover:text-accent"
                                >{flagEmoji(card.countryCode)}
                                {card.country}</span
                            >
                            <span
                                class="shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted"
                                >{postcardDate(card.time, card.timezone)}</span
                            >
                        </span>
                    </a>
                </li>
            {/each}
        </ol>
    </section>

    <section class="band-dark bg-paper px-6 py-24 text-ink" id="projects">
        <div class="mx-auto max-w-screen-2xl">
            <SectionHeading
                tag="h2"
                index="02"
                title="Things I build"
                meta="Source code & downloads"
            />
            {#each PROJECTS as project, index (project.slug)}
                <article
                    class="grid grid-cols-6 gap-x-6 gap-y-10 lg:grid-cols-12 {index >
                    0
                        ? 'mt-24'
                        : ''}"
                >
                    <div
                        class="col-span-full flex flex-col lg:col-span-5 {index %
                            2 ===
                        1
                            ? 'lg:col-start-8 lg:row-start-1'
                            : ''}"
                    >
                        <div class="flex items-center gap-4">
                            <img
                                src={project.icon}
                                alt=""
                                class="m-0 h-14 w-14 rounded-2xl"
                            />
                            <span class="label"
                                >Project {String(index + 1).padStart(
                                    2,
                                    "0",
                                )}</span
                            >
                        </div>
                        <h3
                            class="m-0 mt-6 text-[clamp(4rem,9vw,8rem)] font-medium leading-[0.85] tracking-[-0.06em]"
                        >
                            {project.name}
                        </h3>
                        <p
                            class="m-0 mt-6 text-2xl leading-snug tracking-tight"
                        >
                            {project.tagline}
                        </p>
                        <p class="m-0 mt-4 leading-relaxed text-muted">
                            {project.description}
                        </p>
                        {#if project.stack.length > 0}
                            <p
                                class="m-0 mt-6 font-mono text-[11px] uppercase tracking-[0.18em] text-rock"
                            >
                                {project.stack.join(" / ")}
                            </p>
                        {/if}

                        {#if project.downloads.length > 0}
                            <ul
                                class="m-0 mt-10 list-none border-b border-line p-0"
                            >
                                {#each project.downloads as download}
                                    <li class="m-0 border-t border-line">
                                        <a
                                            href={download.href}
                                            class="group flex items-center gap-4 py-4 no-underline hover:text-accent"
                                            download={isLocalDownload(download)
                                                ? ""
                                                : undefined}
                                            target={isLocalDownload(download)
                                                ? undefined
                                                : "_blank"}
                                            rel={isLocalDownload(download)
                                                ? undefined
                                                : "noreferrer"}
                                        >
                                            <span
                                                class="w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted"
                                                >{download.platform}</span
                                            >
                                            <span
                                                class="flex-1 text-lg font-medium"
                                                >{download.label}</span
                                            >
                                            <ArrowUpRight
                                                size={18}
                                                class="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                            />
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        {/if}
                        <a
                            href="/projects/{project.slug}"
                            class="group mt-6 flex items-center gap-2 self-start font-mono text-[11px] uppercase tracking-[0.18em] no-underline hover:text-accent"
                        >
                            More about {project.name}
                            <ArrowRight
                                size={14}
                                class="transition-transform group-hover:translate-x-1"
                            />
                        </a>
                    </div>
                    <div
                        class="col-span-full self-center lg:col-span-6 lg:row-start-1 {index %
                            2 ===
                        1
                            ? 'lg:col-start-1'
                            : 'lg:col-start-7'}"
                    >
                    {#if project.cover}
                        <a
                            href="/projects/{project.slug}"
                            class="block"
                            tabindex="-1"
                        >
                            <img
                                src={project.cover}
                                alt=""
                                loading="lazy"
                                class="m-0 w-full rounded-3xl"
                            />
                        </a>
                    {:else if project.code}
                        <pre
                            class="m-0 overflow-x-auto rounded-3xl border border-line bg-sunken p-8 font-mono text-sm leading-relaxed"><code class="gyro">{@html project.code}</code></pre>
                    {:else if project.features.length > 0}
                        <ol
                            class="m-0 list-none border-b border-line p-0"
                        >
                            {#each project.features as feature, featureIndex}
                                <li
                                    class="m-0 flex gap-6 border-t border-line py-5 text-xl leading-snug tracking-tight"
                                >
                                    <span
                                        class="w-8 shrink-0 pt-1.5 font-mono text-[11px] tracking-[0.18em] text-muted"
                                        >{String(featureIndex + 1).padStart(
                                            2,
                                            "0",
                                        )}</span
                                    >
                                    {feature}
                                </li>
                            {/each}
                        </ol>
                    {/if}
                    </div>
                </article>
            {/each}
        </div>
    </section>

    <section class="mx-auto max-w-screen-2xl px-6 py-24">
        <SectionHeading
            tag="h2"
            index="03"
            title="About me"
            meta="Germany · on the road"
        />
        <div class="grid grid-cols-6 gap-x-6 gap-y-12 lg:grid-cols-12">
            <figure class="col-span-full m-0 lg:col-span-4">
                <img
                    src="/images/chile-3.jpg"
                    alt="Moritz on his loaded bike, looking down a mountain road"
                    loading="lazy"
                    class="m-0 aspect-[3/4] w-full rounded-3xl object-cover"
                />
            </figure>
            <div class="col-span-full lg:col-span-7 lg:col-start-6">
                <p
                    class="m-0 text-[clamp(1.5rem,2.6vw,2.4rem)] leading-[1.15] tracking-tight"
                >
                    I'm a self-taught software engineer from Germany. I mostly
                    do web things and compilers, and I most definitely spend too
                    much time in front of a computer.
                </p>
                <div
                    class="mt-10 gap-10 text-[1.05rem] leading-relaxed text-muted sm:columns-2"
                >
                    <p class="m-0 mb-4 break-inside-avoid">
                        I occasionally dip my toes into stuff that I don't know
                        yet. I know a decent amount of programming languages,
                        both object-oriented and functional, as well as a good
                        amount of x86 Assembly (I don't know how that happened
                        either).
                    </p>
                    <p class="m-0 mb-4 break-inside-avoid">
                        I love hiking, cycling, climbing and all things
                        outdoors. I've been to 56 countries so far, over 40 of
                        them by bicycle. I really enjoy street and nature
                        photography, although I'm kinda bad at it.
                    </p>
                    <p class="m-0 mb-4 break-inside-avoid">
                        I enjoy learning languages. I'm fluent in German and
                        English, speak a decent amount of Spanish, get by in
                        French and am working on my Mandarin.
                    </p>
                </div>

                <dl
                    class="m-0 mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4"
                >
                    {#each [["56", "Countries"], ["40+", "By bicycle"], ["4", "Languages spoken"], ["中文", "Learning"]] as [value, unit]}
                        <div class="border-t border-line pt-3">
                            <dt class="label">{unit}</dt>
                            <dd
                                class="m-0 mt-3 text-5xl font-medium leading-none tracking-[-0.04em]"
                            >
                                {value}
                            </dd>
                        </div>
                    {/each}
                </dl>

                <h3 class="label m-0 mt-16">Programming languages</h3>
                <p
                    class="m-0 mt-4 text-[clamp(1.5rem,2.4vw,2.25rem)] font-medium leading-snug tracking-tight"
                >
                    {#each languages as language, index}<span
                            class="transition-colors hover:text-accent"
                            >{language}</span
                        >{#if index < languages.length - 1}<span
                                class="mx-2 text-line"
                                aria-hidden="true">/</span
                            >{/if}{/each}
                </p>
            </div>
        </div>
    </section>
</div>

<style>
    .gyro :global(.k) {
        color: var(--color-accent);
    }

    .gyro :global(.t) {
        color: color-mix(in srgb, var(--color-flag-yellow) 75%, white);
    }

    .gyro :global(.f) {
        color: color-mix(in srgb, var(--color-flag-blue) 45%, white);
    }

    .gyro :global(.s) {
        color: color-mix(in srgb, var(--color-flag-green) 55%, white);
    }

    .gyro :global(.n) {
        color: color-mix(in srgb, var(--color-flag-yellow) 75%, white);
    }

    .gyro :global(.e) {
        color: var(--color-rock);
    }

    .gyro :global(.c) {
        color: var(--color-muted);
        font-style: italic;
    }

    .postcards {
        scroll-snap-type: x mandatory;
        scroll-padding-inline: 1.5rem;
        scrollbar-width: thin;
    }

    .postcard {
        rotate: var(--tilt);
        transition:
            rotate 0.3s ease,
            translate 0.3s ease,
            box-shadow 0.3s ease;
    }

    .postcard:hover,
    .postcard:focus-visible {
        rotate: 0deg;
        translate: 0 -0.375rem;
        box-shadow: var(--shadow-lift);
    }
</style>
