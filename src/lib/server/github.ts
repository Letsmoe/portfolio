import { assetPlatform, renderReadme, type Release, type Repository } from "#lib/github.ts";

/** Unauthenticated GitHub API calls are limited to 60 an hour per IP, so answers are kept for a while. */
const CACHE_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 4000;

const cache = new Map<string, { expires: number; value: unknown }>();

/** Fetches through the cache; a failed request yields `null` so the page still renders without GitHub. */
async function cached<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
	const hit = cache.get(key);
	if (hit && hit.expires > Date.now()) return hit.value as T | null;
	let value: T | null = null;
	try {
		value = await load();
	} catch (error) {
		console.warn(`[github] ${key}:`, (error as Error).message);
	}
	cache.set(key, { expires: Date.now() + CACHE_MS, value });
	return value;
}

export function readmeHtml(repository: Repository, fetch: typeof globalThis.fetch): Promise<string | null> {
	return cached(`readme:${repository.slug}`, async () => {
		const response = await fetch(`https://raw.githubusercontent.com/${repository.slug}/${repository.branch}/README.md`, {
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!response.ok) return null;
		return renderReadme(await response.text(), repository);
	});
}

interface GitHubRelease {
	tag_name: string;
	name: string | null;
	published_at: string;
	html_url: string;
	assets: { name: string; browser_download_url: string; size: number }[];
}

export function latestRelease(repository: Repository, fetch: typeof globalThis.fetch): Promise<Release | null> {
	return cached(`release:${repository.slug}`, async () => {
		const response = await fetch(`https://api.github.com/repos/${repository.slug}/releases/latest`, {
			headers: { accept: "application/vnd.github+json" },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		// 404 means the repository has no published release yet.
		if (!response.ok) return null;
		const release = (await response.json()) as GitHubRelease;
		return {
			tag: release.tag_name,
			name: release.name || release.tag_name,
			publishedAt: release.published_at,
			href: release.html_url,
			assets: release.assets.map((asset) => ({
				name: asset.name,
				href: asset.browser_download_url,
				size: asset.size,
				platform: assetPlatform(asset.name),
			})),
		};
	});
}
