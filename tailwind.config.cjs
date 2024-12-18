/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		extend: {},
	},
	darkMode: "media",
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
				'bumblebee': {
           'primary' : '#f9d72f',
           'primary-focus' : '#e9c307',
           'primary-content' : '#18182f',

           'secondary' : '#dfa62a',
           'secondary-focus' : '#be8b1e',
           'secondary-content' : '#ffffff',

           'accent' : '#18182f',
           'accent-focus' : '#111122',
           'accent-content' : '#ffffff',

           'neutral' : '#18182f',
           'neutral-focus' : '#111122',
           'neutral-content' : '#ffffff',

           'base-100' : '#ffffff',
           'base-200' : '#f5f5f5',
           'base-300' : '#e3e3e3',
           'base-content' : '#000000',

           'info' : '#1c92f2',
           'success' : '#009485',
           'warning' : '#ff9900',
           'error' : '#ff5724',

          '--rounded-box': '1rem',          
          '--rounded-btn': '.5rem',        
          '--rounded-badge': '1.9rem',      

          '--animation-btn': '.25s',       
          '--animation-input': '.2s',       

          '--btn-text-case': 'uppercase',   
          '--navbar-padding': '.5rem',      
          '--border-btn': '1px',            
        },
			},
		],
	},
};
