<script lang="ts">
    interface Props {
        index: string;
        title: string;
        meta?: string;
        id?: string | undefined;
        /** Pages use it as their main heading; on the home page it sits under the hero's h1. */
        tag?: "h1" | "h2";
    }

    let {
        index,
        title,
        meta = "",
        id = undefined,
        tag = "h1",
    }: Props = $props();
</script>

<header
    class="mb-12 grid grid-cols-6 gap-x-6 border-t border-ink pt-3 lg:grid-cols-12"
    {id}
>
    <svelte:element
        this={tag}
        class="col-span-full m-0 mt-8 text-[clamp(3rem,9vw,8.5rem)] font-medium leading-[0.85] tracking-[-0.055em]"
        >{title}</svelte:element
    >
</header>
