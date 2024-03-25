/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		extend: {},
	},
	plugins: [require("daisyui"), require("@tailwindcss/typography")],
	daisyui: {
		themes: [
			{
				forest: {
					primary: "#7c3aed",
					"primary-focus": "#5b21b6",
					"primary-content": "#ffffff",

					secondary: "#4f46e5",
					"secondary-focus": "#3730a3",
					"secondary-content": "#ffffff",

					accent: "#a21caf",
					"accent-focus": "#b57721",
					"accent-content": "#ffffff",

					neutral: "#110e0e",
					"neutral-focus": "#060404",
					"neutral-content": "#ffffff",

					"base-100": "#171212",
					"base-200": "#110e0e",
					"base-300": "#060404",
					"base-content": "#ffffff",

					info: "#66c7ff",
					success: "#87cf3a",
					warning: "#e1d460",
					error: "#ff6b6b",

					"--rounded-box": "1rem",
					"--rounded-btn": "1rem",
					"--rounded-badge": "1.9rem",

					"--animation-btn": ".25s",
					"--animation-input": ".2s",

					"--btn-text-case": "uppercase",
					"--navbar-padding": ".5rem",
					"--border-btn": "1px",
				},
			},
		],
	},
};
