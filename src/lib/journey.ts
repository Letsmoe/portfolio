export interface JourneyPhoto {
	src: string;
	thumb: string;
	/** 96px square, for map nodes. */
	micro: string;
	width: number;
	height: number;
}

export interface JourneyVideo {
	src: string;
	poster: string;
	width: number;
	height: number;
	/** Seconds. */
	duration: number;
}

export interface JourneyStep {
	id: number;
	slug: string;
	name: string;
	country: string;
	countryCode: string;
	lat: number;
	lon: number;
	/** ISO timestamp. */
	time: string;
	timezone: string;
	description: string;
	weather: { condition: string; temperature: number | null } | null;
	photos: JourneyPhoto[];
	videos: JourneyVideo[];
}

export interface Journey {
	name: string;
	summary: string;
	startDate: string;
	endDate: string;
	totalKm: number;
	steps: JourneyStep[];
	/** GPS track as `[lon, lat]` segments; a new segment starts after every long hop. */
	route: [number, number][][];
}

/** A run of consecutive steps in the same country. Revisits start a new chapter. */
export interface JourneyChapter {
	country: string;
	countryCode: string;
	steps: JourneyStep[];
}

export function groupIntoChapters(steps: JourneyStep[]): JourneyChapter[] {
	const chapters: JourneyChapter[] = [];
	for (const step of steps) {
		const current = chapters.at(-1);
		if (current?.countryCode === step.countryCode) {
			current.steps.push(step);
			continue;
		}
		chapters.push({ country: step.country, countryCode: step.countryCode, steps: [step] });
	}
	return chapters;
}

/** `DE` -> 🇩🇪. Non-country codes (Polarsteps uses `00` at sea) get a wave. */
export function flagEmoji(countryCode: string): string {
	if (!/^[A-Z]{2}$/.test(countryCode)) return "🌊";
	return String.fromCodePoint(...[...countryCode].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65));
}

/** `1.3521, 103.8198` -> `01.35°N 103.82°E` */
export function formatCoordinates(lat: number, lon: number): string {
	const latitude = `${Math.abs(lat).toFixed(2).padStart(5, "0")}°${lat < 0 ? "S" : "N"}`;
	const longitude = `${Math.abs(lon).toFixed(2).padStart(6, "0")}°${lon < 0 ? "W" : "E"}`;
	return `${latitude} ${longitude}`;
}

export interface JourneyStats {
	kilometres: number;
	countries: number;
	days: number;
	steps: number;
	photos: number;
}

export function summarize(journey: Journey): JourneyStats {
	const lastStep = journey.steps.at(-1);
	const end = lastStep ? Date.parse(lastStep.time) : Date.parse(journey.endDate);
	return {
		kilometres: journey.totalKm,
		countries: new Set(journey.steps.map((step) => step.countryCode).filter((code) => code !== "00")).size,
		days: Math.round((end - Date.parse(journey.startDate)) / 86_400_000),
		steps: journey.steps.length,
		photos: journey.steps.reduce((sum, step) => sum + step.photos.length, 0),
	};
}

/** Country names in the order they were first entered, without the at-sea code. */
export interface RouteCountry {
	name: string;
	countryCode: string;
}

export function countryRoute(steps: JourneyStep[]): RouteCountry[] {
	const countries = new Map<string, RouteCountry>();
	for (const step of steps) {
		if (step.countryCode === "00" || countries.has(step.countryCode)) continue;
		countries.set(step.countryCode, { name: step.country, countryCode: step.countryCode });
	}
	return [...countries.values()];
}

export interface Postcard {
	slug: string;
	name: string;
	country: string;
	countryCode: string;
	time: string;
	timezone: string;
	photo: JourneyPhoto;
}

/** One photo per country: the first photographed stop, in the order the countries were entered. */
export function postcards(steps: JourneyStep[]): Postcard[] {
	const byCountry = new Map<string, Postcard>();
	for (const step of steps) {
		if (step.countryCode === "00" || byCountry.has(step.countryCode) || !step.photos[0]) continue;
		const { slug, name, country, countryCode, time, timezone } = step;
		byCountry.set(countryCode, { slug, name, country, countryCode, time, timezone, photo: step.photos[0] });
	}
	return [...byCountry.values()];
}

/** Response of `/api/steps/[slug].json`. */
export interface StepDetail {
	step: JourneyStep;
	previous: string | null;
	next: string | null;
}

const WEATHER_EMOJI: Record<string, string> = {
	"clear-day": "☀️",
	"clear-night": "🌙",
	"partly-cloudy-day": "⛅",
	"partly-cloudy-night": "☁️",
	cloudy: "☁️",
	rain: "🌧️",
	sleet: "🌨️",
	snow: "❄️",
	wind: "💨",
	fog: "🌫️",
};

/** Polarsteps uses Dark Sky's condition names. */
export function weatherEmoji(condition: string): string {
	return WEATHER_EMOJI[condition] ?? "🌡️";
}

export function formatStepDate(step: Pick<JourneyStep, "time" | "timezone">): string {
	return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: step.timezone }).format(
		new Date(step.time),
	);
}
