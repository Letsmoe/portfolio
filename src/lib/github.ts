import { Marked, type Token } from "marked";
import type { DownloadPlatform } from "#lib/projects.ts";

export interface Repository {
	/** `owner/name` on GitHub. */
	slug: string;
	branch: string;
}

export interface ReleaseAsset {
	name: string;
	href: string;
	size: number;
	platform: DownloadPlatform;
}

export interface Release {
	tag: string;
	name: string;
	publishedAt: string;
	href: string;
	assets: ReleaseAsset[];
}

export function assetPlatform(fileName: string): DownloadPlatform {
	const name = fileName.toLowerCase();
	if (name.endsWith(".apk") || name.endsWith(".aab")) return "android";
	if (name.endsWith(".exe") || name.endsWith(".msi") || name.includes("windows")) return "windows";
	if (name.endsWith(".dmg") || name.includes("darwin") || name.includes("macos")) return "macos";
	if (name.endsWith(".appimage") || name.endsWith(".deb") || name.endsWith(".rpm") || name.includes("linux")) return "linux";
	return "any";
}

export function formatBytes(bytes: number): string {
	if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ABSOLUTE_URL = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

/**
 * GitHub-flavoured README to HTML. Relative links point back into the repository (images at the raw
 * file, everything else at the blob view), and the centred logo/tagline block GitHub READMEs open with
 * is dropped because the project page already has its own header.
 */
export function renderReadme(markdown: string, repository: Repository): string {
	const raw = `https://raw.githubusercontent.com/${repository.slug}/${repository.branch}/`;
	const blob = `https://github.com/${repository.slug}/blob/${repository.branch}/`;
	const resolve = (href: string, base: string) => (ABSOLUTE_URL.test(href) ? href : base + href.replace(/^\.?\//, ""));

	const marked = new Marked({ gfm: true });
	const tokens = marked.lexer(markdown);
	const firstHeading = tokens.findIndex((token) => token.type === "heading");
	const body = tokens.filter((token, index) => index >= firstHeading || !["html", "hr", "space"].includes(token.type));
	const lexed = Object.assign(body, { links: tokens.links });

	marked.walkTokens(lexed, (token: Token) => {
		if (token.type === "image") token.href = resolve(token.href, raw);
		if (token.type === "link") token.href = resolve(token.href, blob);
		if (token.type === "html") token.text = token.text.replace(/(src|href)="([^"]+)"/g, (_, attribute: string, href: string) => `${attribute}="${resolve(href, attribute === "src" ? raw : blob)}"`);
	});
	return marked.parser(lexed);
}
