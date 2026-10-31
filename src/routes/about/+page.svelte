<script lang="ts">
    import PrayerFlags from "#components/PrayerFlags.svelte";
    import ArrowRight from "phosphor-svelte/lib/ArrowRight";
    import ArrowUpRight from "phosphor-svelte/lib/ArrowUpRight";
    import type { PageData } from "./$types";

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();

    let now = $derived([
        {
            label: "Founder",
            title: "NeoWorks",
            text: "Think Google, minus the part where Google reads everything. Photos, calendar and contacts, encrypted on your device, so your data stays yours: no ads, no AI training, no prying eyes. Not even mine.",
            href: "/projects/neoworks",
        },
        {
            label: "Language",
            title: "Gyro",
            text: "My own programming language, because using someone else's was apparently too easy. Manual memory, explicit effects and a compiler that says no a lot.",
            href: "/projects/gyro",
        },
        {
            label: "On the road",
            title: `${data.stats.kilometres.toLocaleString("en-US")} km`,
            text: `${data.stats.countries} countries and ${data.stats.days} days on the big trip. I'm back home for now, but I'm moving to Australia soon, so the bike shouldn't get too comfortable.`,
            href: "/journey",
        },
    ]);

    const contacts = [
        {
            label: "Email",
            value: "moritz.utcke@gmx.de",
            href: "mailto:moritz.utcke@gmx.de",
        },
        {
            label: "GitHub",
            value: "Letsmoe",
            href: "https://github.com/Letsmoe",
        },
        {
            label: "LinkedIn",
            value: "Moritz Utcke",
            href: "https://www.linkedin.com/in/moritz-utcke-5677a3184/",
        },
    ];
</script>

<svelte:head>
    <title>About - Moritz Utcke</title>
    <meta
        name="description"
        content="Moritz Utcke: self-taught software engineer, founder of NeoWorks and the guy who cycled through 40 countries following Komoot."
    />
</svelte:head>

<section
    class="mx-auto grid max-w-screen-2xl grid-cols-6 gap-x-6 gap-y-12 px-6 pt-12 lg:grid-cols-12"
>
    <div class="col-span-full flex flex-col lg:col-span-7">
        <p class="label m-0 border-t border-ink pt-3">About</p>
        <h1
            class="m-0 mt-10 text-[clamp(3rem,7vw,6.5rem)] font-medium leading-[0.9] tracking-[-0.055em]"
        >
            Hej, how you doin'? 👋
        </h1>
        <p
            class="m-0 mt-10 max-w-2xl text-[clamp(1.25rem,1.8vw,1.6rem)] leading-snug tracking-tight"
        >
            I'm Moritz, a self-taught software engineer from Germany. I mostly
            do web things and compilers, and for the last few years I did them
            from a tent, somewhere along a Komoot route that looked like a good
            idea at the time.
        </p>
    </div>
    <figure class="col-span-full m-0 lg:col-span-4 lg:col-start-9">
        <img
            src="/images/chile.jpg"
            alt="Moritz on his loaded bike, looking down a mountain road"
            width="1963"
            height="1472"
            class="m-0 aspect-[3/4] w-full rounded-3xl object-cover"
        />
        <figcaption
            class="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted"
        >
            Chile
        </figcaption>
    </figure>
</section>

<PrayerFlags height={200} class="mt-16" />

<div class="mx-auto max-w-screen-2xl px-6 pb-24">
    <section class="mt-16">
        <h2 class="label m-0 border-t border-ink pt-3">Right now</h2>
        <ul class="m-0 mt-6 list-none border-b border-line p-0">
            {#each now as item (item.href)}
                <li class="m-0 border-t border-line">
                    <a
                        href={item.href}
                        class="group grid grid-cols-6 items-baseline gap-x-6 gap-y-2 py-8 no-underline lg:grid-cols-12"
                    >
                        <span
                            class="col-span-full font-mono text-[11px] uppercase tracking-[0.18em] text-muted lg:col-span-2"
                            >{item.label}</span
                        >
                        <span
                            class="col-span-full text-[clamp(2rem,4vw,3.5rem)] font-medium leading-none tracking-[-0.04em] transition-colors group-hover:text-accent lg:col-span-4"
                        >
                            {item.title}
                        </span>
                        <span
                            class="col-span-5 text-lg leading-relaxed text-muted lg:col-span-5"
                            >{item.text}</span
                        >
                        <ArrowRight
                            size={20}
                            class="col-span-1 justify-self-end transition-transform group-hover:translate-x-1"
                        />
                    </a>
                </li>
            {/each}
        </ul>
    </section>

    <section class="mt-32 grid grid-cols-6 gap-x-6 gap-y-10 lg:grid-cols-12">
        <h2 class="label col-span-full m-0 border-t border-ink pt-3">
            Background
        </h2>
        <p
            class="col-span-full m-0 text-[clamp(1.5rem,2.6vw,2.4rem)] leading-[1.15] tracking-tight lg:col-span-7 lg:col-start-6"
        >
            I taught myself to code and never really stopped poking at things I
            don't understand yet. That's how I ended up knowing a good amount of
            x86 assembly. I'm still not sure how that happened.
        </p>
        <div
            class="col-span-full gap-10 text-[1.05rem] leading-relaxed text-muted sm:columns-2 lg:col-span-7 lg:col-start-6"
        >
            <p class="m-0 mb-4 break-inside-avoid">
                I know a decent pile of programming languages, object-oriented
                and functional, but the fun part is underneath: parsers, type
                checkers and code generators. Building them, not just using
                them.
            </p>
            <p class="m-0 mb-4 break-inside-avoid">
                When I'm not at a keyboard I'm hiking, climbing or on the bike.
                56 countries so far, 40+ of them by bicycle. I take a lot of
                photos along the way, and some of them are even in focus.
            </p>
            <p class="m-0 mb-4 break-inside-avoid">
                I also collect the human kind of languages: fluent German and
                English, decent Spanish, survival French, and Mandarin that is
                very much a work in progress.
            </p>
        </div>
    </section>

    <figure class="mx-0 mb-0 mt-32">
        <img
            src="/images/about/cappadocia-cat.webp"
            alt="A white cat on a rooftop watching hot air balloons rise over Cappadocia at dawn"
            width="2000"
            height="1333"
            loading="lazy"
            class="m-0 w-full rounded-3xl"
        />
        <figcaption
            class="mt-3 flex justify-between gap-6 font-mono text-[11px] uppercase tracking-[0.18em] text-muted"
        >
            <span
                >My favourite shot · Cappadocia, Turkey · the cat was not staged</span
            >
            <span>Panasonic FZ1000 II</span>
        </figcaption>
    </figure>

    <section class="mt-32">
        <h2 class="label m-0 border-t border-ink pt-3">Say hello</h2>
        <p
            class="m-0 mt-10 max-w-3xl text-[clamp(2rem,4vw,3.5rem)] font-medium leading-[1.05] tracking-[-0.04em]"
        >
            Got a question, an idea or a job you think I'd like? Let's have a
            chat.
        </p>
        <ul class="m-0 mt-12 list-none border-b border-line p-0">
            {#each contacts as contact (contact.label)}
                <li class="m-0 border-t border-line">
                    <a
                        href={contact.href}
                        target={contact.href.startsWith("mailto:")
                            ? undefined
                            : "_blank"}
                        rel={contact.href.startsWith("mailto:")
                            ? undefined
                            : "noreferrer"}
                        class="group flex items-center gap-6 py-5 no-underline hover:text-accent"
                    >
                        <span
                            class="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-muted"
                            >{contact.label}</span
                        >
                        <span
                            class="min-w-0 flex-1 truncate text-xl font-medium"
                            >{contact.value}</span
                        >
                        <ArrowUpRight
                            size={20}
                            class="shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        />
                    </a>
                </li>
            {/each}
        </ul>
    </section>
</div>
