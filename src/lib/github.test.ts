import { describe, expect, test } from "bun:test";
import { assetPlatform, formatBytes, renderReadme } from "./github";

const repository = { slug: "me/app", branch: "main" };

describe("assetPlatform", () => {
	test("recognises release files by name", () => {
		expect(assetPlatform("otter-1.2.0.apk")).toBe("android");
		expect(assetPlatform("Otter-Setup.exe")).toBe("windows");
		expect(assetPlatform("otter_darwin_arm64.tar.gz")).toBe("macos");
		expect(assetPlatform("otter-x86_64.AppImage")).toBe("linux");
		expect(assetPlatform("checksums.txt")).toBe("any");
	});
});

describe("formatBytes", () => {
	test("uses KB below a megabyte and one decimal above", () => {
		expect(formatBytes(2048)).toBe("2 KB");
		expect(formatBytes(31.46 * 1024 * 1024)).toBe("31.5 MB");
	});
});

describe("renderReadme", () => {
	test("drops the centred intro block before the first heading", () => {
		const html = renderReadme('<p align="center"><img src="logo.svg"></p>\n\n---\n\n## What is it?\n\nAn app.', repository);
		expect(html).not.toContain("logo.svg");
		expect(html).toContain("<h2");
		expect(html).toContain("An app.");
	});

	test("points relative links and images back into the repository", () => {
		const html = renderReadme("# App\n\nSee [the docs](docs/setup.md) and ![shot](./shot.png) or [web](https://x.dev).", repository);
		expect(html).toContain('href="https://github.com/me/app/blob/main/docs/setup.md"');
		expect(html).toContain('src="https://raw.githubusercontent.com/me/app/main/shot.png"');
		expect(html).toContain('href="https://x.dev"');
	});
});
