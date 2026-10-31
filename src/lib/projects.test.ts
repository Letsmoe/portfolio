import { describe, expect, test } from "bun:test";
import { formatCoordinates } from "./journey";
import { getProject, isLocalDownload, PROJECTS } from "./projects";

describe("PROJECTS", () => {
	test("slugs are unique and URL-safe", () => {
		const slugs = PROJECTS.map((project) => project.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
		for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9-]+$/);
	});

	test("every project from the CMS file has a name, an icon and a usable repository", () => {
		expect(PROJECTS.length).toBeGreaterThan(0);
		for (const project of PROJECTS) {
			expect(project.name).not.toBe("");
			expect(project.icon).toMatch(/^\//);
			if (project.repository) expect(project.repository.slug).toMatch(/^[\w.-]+\/[\w.-]+$/);
			if (project.repository) expect(project.repository.branch).not.toBe("");
		}
	});

	test("downloads point at an absolute URL or static/downloads", () => {
		for (const project of PROJECTS) {
			for (const download of project.downloads) {
				expect(download.href).toMatch(/^(https:\/\/|\/downloads\/)/);
			}
		}
	});
});

describe("getProject", () => {
	test("finds a project by slug", () => {
		expect(getProject("otter")?.name).toBe("Otter");
	});

	test("returns undefined for unknown slugs", () => {
		expect(getProject("does-not-exist")).toBeUndefined();
	});
});

describe("isLocalDownload", () => {
	test("distinguishes hosted files from external links", () => {
		expect(isLocalDownload({ label: "CLI", platform: "linux", href: "/downloads/meta/meta.tar.gz" })).toBe(true);
		expect(isLocalDownload({ label: "CLI", platform: "linux", href: "https://github.com/x/y/releases/download/v1/y" })).toBe(false);
	});
});

describe("formatCoordinates", () => {
	test("pads and labels hemispheres", () => {
		expect(formatCoordinates(1.3521, 103.8198)).toBe("01.35°N 103.82°E");
		expect(formatCoordinates(-33.8688, -70.6693)).toBe("33.87°S 070.67°W");
	});
});
