/// <reference types="@sveltejs/kit" />
/// <reference types="@sveltejs/enhanced-img" />

declare global {
	namespace App {
		interface PageState {
			/** Slug of the day open in the journey map's side sheet (shallow routing). */
			daySheet?: string;
		}
	}
}

export {};
