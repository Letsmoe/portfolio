<script lang="ts">
	let isOpen = false;

	function toggleMenu() {
		isOpen = !isOpen;
	}
</script>

<header class="py-5 px-20 border-b-2 h-[80px] w-screen bg-base-200 border-b-base-200 fixed z-10 top-0">
	<div class="flex flex-row mx-auto items-center justify-between max-w-[1200px] w-full">
		<a href="/" class="header-logo">🌈</a>
		<div class="header-links bg-base-200 {isOpen ? 'open' : 'closed'}">
			<a href="/about">About</a>
			<a href="/blog">Blog</a>
			<a href="/#projects">Projects</a>
			<a href="/gallery">Gallery</a>
		</div>
		<div
			class="hamburger {isOpen ? 'open' : 'closed'}"
			on:click={toggleMenu}
			on:keydown={toggleMenu}
		>
			<span />
			<span />
			<span />
		</div>
	</div>
</header>

<style lang="scss">
	.header-links {
		display: flex;
		flex-direction: row;
		gap: 24px;
	}

	a {
		@apply text-base-content text-xl font-bold transition-colors;
	}

	a:hover {
		@apply underline;
	}

	.header-logo {
		font-size: 38px;
		line-height: 38px;
		text-decoration: none;
	}

	.hamburger {
		position: relative;
		width: 20px;
		display: none;
		cursor: pointer;

		& span:nth-child(1) {
			transform-origin: 0% 0%;
		}

		& span:nth-child(3) {
			transform-origin: 0% 100%;
		}

		&.open span:nth-child(1) {
			transform: rotate(45deg) translate(-2px, -1px);
		}

		&.open span:nth-child(3) {
			transform: rotate(-45deg) translate(0, -1px);
		}

		&.open span:nth-child(2) {
			opacity: 0;
			transform: rotate(0deg) scale(0.2, 0.2);
		}

		& span {
			display: block;
			width: 28px;
			height: 4px;
			margin-bottom: 5px;
			position: relative;

			background: #333;
			border-radius: 3px;

			z-index: 1;

			transform-origin: 4px 0px;

			transition: transform 0.5s cubic-bezier(0.77, 0.2, 0.05, 1),
				background 0.5s cubic-bezier(0.77, 0.2, 0.05, 1),
				opacity 0.55s ease;
		}
	}

	@media only screen and (max-width: 960px) {
		.header-links {
			display: none;
			position: absolute;
			flex-direction: column;
			top: 80px;
			width: 100%;
			left: 0;
			padding: 20px 40px;
			border-bottom: 2px solid #eee;

			&.open {
				display: flex;
				z-index: 1;
			}
		}

		.hamburger {
			display: block;
		}

		header {
			padding: 20px 40px;
		}
	}
</style>
