import { describe, expect, test } from "bun:test";
import { countryRoute, flagEmoji, postcards, formatStepDate, groupIntoChapters, summarize, weatherEmoji, type Journey, type JourneyStep } from "./journey";
import { nearestPhotoIndex, placeDropdown, routeHops, truncateRoute } from "./map";

describe("nearestPhotoIndex", () => {
	test("points photoless stops at the closest stop with a photo, preferring the earlier one", () => {
		const stops = [null, "a", null, null, null, "b", null].map((micro) => ({ micro }));
		expect(nearestPhotoIndex(stops)).toEqual([1, 1, 1, 1, 5, 5, 5]);
	});

	test("returns -1 everywhere when there are no photos", () => {
		expect(nearestPhotoIndex([{ micro: null }, { micro: null }])).toEqual([-1, -1]);
	});
});

function step(id: number, countryCode: string, time: string, photos = 0): JourneyStep {
	return {
		id,
		slug: `step-${id}`,
		name: `Step ${id}`,
		country: countryCode,
		countryCode,
		lat: 0,
		lon: 0,
		time,
		timezone: "UTC",
		description: "",
		weather: null,
		videos: [],
		photos: Array.from({ length: photos }, (_, index) => ({ src: `/${index}.webp`, thumb: `/${index}-thumb.webp`, micro: `/${index}-micro.webp`, width: 1, height: 1 })),
	};
}

describe("groupIntoChapters", () => {
	test("groups consecutive steps and starts a new chapter on revisits", () => {
		const chapters = groupIntoChapters([
			step(1, "DE", "2022-08-01T00:00:00Z"),
			step(2, "DE", "2022-08-02T00:00:00Z"),
			step(3, "AT", "2022-08-03T00:00:00Z"),
			step(4, "DE", "2022-08-04T00:00:00Z"),
		]);
		expect(chapters.map((chapter) => [chapter.countryCode, chapter.steps.length])).toEqual([
			["DE", 2],
			["AT", 1],
			["DE", 1],
		]);
	});
});

describe("summarize", () => {
	test("counts countries without the at-sea code and days up to the last step", () => {
		const journey: Journey = {
			name: "Trip",
			summary: "",
			startDate: "2022-08-01T00:00:00Z",
			endDate: "2030-01-01T00:00:00Z",
			totalKm: 1234,
			route: [],
			steps: [step(1, "DE", "2022-08-01T00:00:00Z", 2), step(2, "00", "2022-08-05T00:00:00Z"), step(3, "AT", "2022-08-11T00:00:00Z", 1)],
		};
		expect(summarize(journey)).toEqual({ kilometres: 1234, countries: 2, days: 10, steps: 3, photos: 3 });
	});
});

describe("postcards", () => {
	test("takes the first photographed stop of each country, skipping the sea", () => {
		const cards = postcards([
			step(1, "DE", "2022-08-01T00:00:00Z"),
			step(2, "DE", "2022-08-02T00:00:00Z", 2),
			step(3, "00", "2022-08-03T00:00:00Z", 1),
			step(4, "AT", "2022-08-04T00:00:00Z", 1),
			step(5, "DE", "2022-08-05T00:00:00Z", 1),
		]);
		expect(cards.map((card) => [card.countryCode, card.slug])).toEqual([
			["DE", "step-2"],
			["AT", "step-4"],
		]);
	});
});

describe("countryRoute", () => {
	test("lists countries once, in first-visit order, without the at-sea code", () => {
		const steps = [
			step(1, "DE", "2022-08-01T00:00:00Z"),
			step(2, "AT", "2022-08-02T00:00:00Z"),
			step(3, "00", "2022-08-03T00:00:00Z"),
			step(4, "DE", "2022-08-04T00:00:00Z"),
			step(5, "IT", "2022-08-05T00:00:00Z"),
		];
		expect(countryRoute(steps).map((country) => country.countryCode)).toEqual(["DE", "AT", "IT"]);
	});
});

describe("flagEmoji", () => {
	test("maps country codes to regional indicators", () => {
		expect(flagEmoji("DE")).toBe("🇩🇪");
		expect(flagEmoji("00")).toBe("🌊");
	});
});

describe("weatherEmoji", () => {
	test("maps Dark Sky conditions and falls back to a thermometer", () => {
		expect(weatherEmoji("rain")).toBe("🌧️");
		expect(weatherEmoji("hail")).toBe("🌡️");
	});
});

describe("formatStepDate", () => {
	test("uses the step's own timezone", () => {
		expect(formatStepDate({ time: "2023-01-01T20:00:00Z", timezone: "Asia/Kathmandu" })).toBe("2 Jan 2023");
		expect(formatStepDate({ time: "2023-01-01T20:00:00Z", timezone: "Europe/Berlin" })).toBe("1 Jan 2023");
	});
});

describe("map", () => {
	test("hops connect segment ends to the next segment start", () => {
		expect(routeHops([[[0, 0], [10, 0]], [[20, 5], [30, 5]]])).toEqual([[[10, 0], [20, 5]]]);
	});

	test("hops over the antimeridian take the short way", () => {
		expect(routeHops([[[170, 0], [175, -40]], [[-75, -12], [-70, -12]]])).toEqual([[[175, -40], [285, -12]]]);
		expect(routeHops([[[-75, -12], [-70, -12]], [[170, 0], [175, 0]]])).toEqual([[[-70, -12], [-190, 0]]]);
	});

	test("truncates the route across segments", () => {
		const route: [number, number][][] = [[[0, 0], [1, 0]], [[2, 0], [3, 0], [4, 0]]];
		expect(truncateRoute(route, 0)).toEqual([]);
		expect(truncateRoute(route, 0.8)).toEqual([[[0, 0], [1, 0]], [[2, 0], [3, 0]]]);
		expect(truncateRoute(route, 0.6)).toEqual([[[0, 0], [1, 0]]]);
		expect(truncateRoute(route, 1)).toEqual(route);
	});

	test("hangs dropdowns below nodes in the top half and above them in the bottom half", () => {
		expect(placeDropdown({ x: 400, y: 100 }, 320, { width: 800, height: 600 })).toEqual({ left: 240, offset: 128, below: true, caret: 160 });
		expect(placeDropdown({ x: 400, y: 500 }, 320, { width: 800, height: 600 })).toEqual({ left: 240, offset: 128, below: false, caret: 160 });
	});

	test("keeps dropdowns inside the map and points the caret at the node", () => {
		expect(placeDropdown({ x: 20, y: 100 }, 320, { width: 800, height: 600 })).toMatchObject({ left: 8, caret: 16 });
		expect(placeDropdown({ x: 790, y: 100 }, 320, { width: 800, height: 600 })).toMatchObject({ left: 472, caret: 304 });
	});
});
