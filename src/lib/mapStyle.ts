import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

export type MapTheme = "light" | "dark";

interface Palette {
	land: string;
	water: string;
	waterLine: string;
	wood: string;
	grass: string;
	ice: string;
	residential: string;
	road: string;
	roadCasing: string;
	minorRoad: string;
	rail: string;
	border: string;
	label: string;
	labelHalo: string;
	countryLabel: string;
	sky: string;
	horizon: string;
	/** Elevation in metres -> ground colour, lowest first. */
	relief: [number, string][];
	shadow: string;
	highlight: string;
}

const PALETTES: Record<MapTheme, Palette> = {
	light: {
		land: "#efefec",
		water: "#a9c3df",
		waterLine: "#86a6c9",
		wood: "#cbd1c4",
		grass: "#dcdfd6",
		ice: "#fbfbfa",
		residential: "#e4e3df",
		road: "#fafaf8",
		roadCasing: "#cfccc6",
		minorRoad: "#f6f6f3",
		rail: "#aaa39d",
		border: "#7d736d",
		label: "#2e2a29",
		labelHalo: "#efefec",
		countryLabel: "#6f6863",
		sky: "#b9cfe8",
		horizon: "#eef1f4",
		relief: [
			[0, "#e6e8e1"],
			[300, "#e3e3db"],
			[900, "#dbd6cc"],
			[1800, "#cdc3b6"],
			[2800, "#b8aa9d"],
			[3800, "#a89a90"],
			[4600, "#e9ebee"],
			[5600, "#ffffff"],
		],
		shadow: "#3e3430",
		highlight: "#ffffff",
	},
	dark: {
		land: "#161516",
		water: "#12192a",
		waterLine: "#1d2a40",
		wood: "#1e211f",
		grass: "#212321",
		ice: "#2b2b2d",
		residential: "#1f1e1f",
		road: "#353334",
		roadCasing: "#161516",
		minorRoad: "#2a2829",
		rail: "#3f3b3a",
		border: "#6b625c",
		label: "#c9c3bd",
		labelHalo: "#161516",
		countryLabel: "#a39b95",
		sky: "#07080b",
		horizon: "#26314a",
		relief: [
			[0, "#1a1a1a"],
			[300, "#1c1c1b"],
			[900, "#22201e"],
			[1800, "#2a2623"],
			[2800, "#322c28"],
			[3800, "#3a3430"],
			[4600, "#4b4c50"],
			[5600, "#6d7075"],
		],
		shadow: "#000000",
		highlight: "#3d3a39",
	},
};

/** Names of the runtime-generated fill patterns; see `addPatterns` in JourneyMap. */
export const WATER_PATTERN = "water-dots";
export const WOOD_PATTERN = "wood-ticks";

const name: ExpressionSpecification = ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];
const font = ["Noto Sans Regular"];
const boldFont = ["Noto Sans Bold"];

function roadWidth(base: number): ExpressionSpecification {
	return ["interpolate", ["exponential", 1.6], ["zoom"], 5, base * 0.3, 10, base, 16, base * 8];
}

export function createMapStyle(theme: MapTheme): StyleSpecification {
	const palette = PALETTES[theme];
	return {
		version: 8,
		projection: { type: "globe" },
		sky: {
			"sky-color": palette.sky,
			"horizon-color": palette.horizon,
			"fog-color": palette.land,
			"atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
		},
		glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
		sources: {
			openmaptiles: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
			terrain: {
				type: "raster-dem",
				tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
				encoding: "terrarium",
				tileSize: 256,
				maxzoom: 13,
				attribution: "Elevation: AWS Terrain Tiles (NASA SRTM, GEBCO, USGS)",
			},
		},
		layers: [
			{ id: "land", type: "background", paint: { "background-color": palette.land } },
			{
				id: "relief",
				type: "color-relief",
				source: "terrain",
				paint: {
					"color-relief-color": ["interpolate", ["linear"], ["elevation"], ...palette.relief.flat()] as ExpressionSpecification,
					"color-relief-opacity": ["interpolate", ["linear"], ["zoom"], 0, 1, 10, 0.75, 14, 0.4],
				},
			},
			{
				id: "hillshade",
				type: "hillshade",
				source: "terrain",
				paint: {
					"hillshade-shadow-color": palette.shadow,
					"hillshade-highlight-color": palette.highlight,
					"hillshade-accent-color": palette.shadow,
					"hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 8, 0.4, 14, 0.25],
				},
			},
			{
				id: "residential",
				type: "fill",
				source: "openmaptiles",
				"source-layer": "landuse",
				filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood"]]],
				paint: { "fill-color": palette.residential, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0, 11, 1] },
			},
			{
				id: "grass",
				type: "fill",
				source: "openmaptiles",
				"source-layer": "landcover",
				filter: ["in", ["get", "class"], ["literal", ["grass", "farmland", "wetland"]]],
				paint: { "fill-color": palette.grass, "fill-opacity": 0.45 },
			},
			{
				id: "park",
				type: "fill",
				source: "openmaptiles",
				"source-layer": "park",
				paint: { "fill-color": palette.wood, "fill-opacity": 0.6 },
			},
			{
				id: "wood",
				type: "fill",
				source: "openmaptiles",
				"source-layer": "landcover",
				filter: ["==", ["get", "class"], "wood"],
				paint: { "fill-color": palette.wood, "fill-opacity": 0.75 },
			},
			{
				id: "wood-texture",
				type: "fill",
				source: "openmaptiles",
				"source-layer": "landcover",
				filter: ["==", ["get", "class"], "wood"],
				minzoom: 7,
				paint: { "fill-pattern": WOOD_PATTERN, "fill-opacity": 0.5 },
			},
			{
				id: "ice",
				type: "fill",
				source: "openmaptiles",
				"source-layer": "landcover",
				filter: ["==", ["get", "class"], "ice"],
				paint: { "fill-color": palette.ice },
			},
			{
				id: "water",
				type: "fill",
				source: "openmaptiles",
				"source-layer": "water",
				paint: { "fill-color": palette.water },
			},
			{
				id: "water-texture",
				type: "fill",
				source: "openmaptiles",
				"source-layer": "water",
				paint: { "fill-pattern": WATER_PATTERN, "fill-opacity": 0.6 },
			},
			{
				id: "water-outline",
				type: "line",
				source: "openmaptiles",
				"source-layer": "water",
				minzoom: 4,
				paint: { "line-color": palette.waterLine, "line-width": 0.8 },
			},
			{
				id: "waterway",
				type: "line",
				source: "openmaptiles",
				"source-layer": "waterway",
				paint: { "line-color": palette.waterLine, "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 14, 2.5] },
			},
			{
				id: "road-minor",
				type: "line",
				source: "openmaptiles",
				"source-layer": "transportation",
				minzoom: 11,
				filter: ["in", ["get", "class"], ["literal", ["minor", "service", "track", "path"]]],
				layout: { "line-cap": "round", "line-join": "round" },
				paint: { "line-color": palette.minorRoad, "line-width": roadWidth(0.8) },
			},
			{
				id: "road-major-casing",
				type: "line",
				source: "openmaptiles",
				"source-layer": "transportation",
				minzoom: 5,
				filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]]],
				layout: { "line-cap": "round", "line-join": "round" },
				paint: { "line-color": palette.roadCasing, "line-width": roadWidth(1.8) },
			},
			{
				id: "road-major",
				type: "line",
				source: "openmaptiles",
				"source-layer": "transportation",
				minzoom: 5,
				filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]]],
				layout: { "line-cap": "round", "line-join": "round" },
				paint: { "line-color": palette.road, "line-width": roadWidth(1.1) },
			},
			{
				id: "rail",
				type: "line",
				source: "openmaptiles",
				"source-layer": "transportation",
				minzoom: 9,
				filter: ["==", ["get", "class"], "rail"],
				paint: { "line-color": palette.rail, "line-width": 1, "line-dasharray": [3, 3] },
			},
			{
				id: "border",
				type: "line",
				source: "openmaptiles",
				"source-layer": "boundary",
				filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
				paint: { "line-color": palette.border, "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.6, 8, 1.4], "line-dasharray": [4, 3] },
			},
			{
				id: "water-label",
				type: "symbol",
				source: "openmaptiles",
				"source-layer": "water_name",
				filter: ["==", ["geometry-type"], "Point"],
				layout: { "text-field": name, "text-font": ["Noto Sans Italic"], "text-size": 11, "text-letter-spacing": 0.15 },
				paint: { "text-color": palette.waterLine, "text-halo-color": palette.water, "text-halo-width": 1 },
			},
			{
				id: "place-town",
				type: "symbol",
				source: "openmaptiles",
				"source-layer": "place",
				minzoom: 7,
				filter: ["in", ["get", "class"], ["literal", ["town", "village"]]],
				layout: { "text-field": name, "text-font": font, "text-size": 11 },
				paint: { "text-color": palette.label, "text-halo-color": palette.labelHalo, "text-halo-width": 1.5 },
			},
			{
				id: "place-city",
				type: "symbol",
				source: "openmaptiles",
				"source-layer": "place",
				minzoom: 4,
				filter: ["==", ["get", "class"], "city"],
				layout: { "text-field": name, "text-font": font, "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 15] },
				paint: { "text-color": palette.label, "text-halo-color": palette.labelHalo, "text-halo-width": 1.5 },
			},
			{
				id: "place-country",
				type: "symbol",
				source: "openmaptiles",
				"source-layer": "place",
				maxzoom: 8,
				filter: ["==", ["get", "class"], "country"],
				layout: {
					"text-field": name,
					"text-font": boldFont,
					"text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 6, 13],
					"text-transform": "uppercase",
					"text-letter-spacing": 0.25,
					"text-max-width": 8,
				},
				paint: { "text-color": palette.countryLabel, "text-halo-color": palette.labelHalo, "text-halo-width": 1.5 },
			},
		],
	};
}
