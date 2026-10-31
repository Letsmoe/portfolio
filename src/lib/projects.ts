import type { Repository } from "#lib/github.ts";
import content from "../content/projects.json";

export type DownloadPlatform = "linux" | "macos" | "windows" | "android" | "docker" | "source" | "any";

export interface ProjectDownload {
	label: string;
	platform: DownloadPlatform;
	/** Absolute URL (e.g. a GitHub release asset) or a file under `static/downloads/`. */
	href: string;
	version?: string;
	size?: string;
	sha256?: string;
}

export interface Project {
	slug: string;
	name: string;
	tagline: string;
	description: string;
	icon: string;
	/** Large artwork for the home page feature; it sits on a near-black band. */
	cover?: string;
	/** Hand-highlighted HTML code sample the home page shows in place of a cover. */
	code?: string;
	stack: string[];
	features: string[];
	links: {
		github?: string;
		website?: string;
	};
	/** GitHub repository whose README and latest release assets show on the project page. */
	repository?: Repository;
	/** Fixed downloads, listed after the assets of the latest release. */
	downloads: ProjectDownload[];
}

type StoredProject = Partial<Omit<Project, "repository">> & { repository?: Partial<Repository> };

/**
 * Projects are edited in the CMS (static/admin/config.yml), which stores optional fields it
 * shows as empty inputs as "" or {}; those mean "not set".
 */
export const PROJECTS: Project[] = (content.projects as StoredProject[]).map((project) => ({
	slug: project.slug ?? "",
	name: project.name ?? "",
	tagline: project.tagline ?? "",
	description: project.description ?? "",
	icon: project.icon ?? "",
	cover: project.cover || undefined,
	code: project.code || undefined,
	stack: project.stack ?? [],
	features: project.features ?? [],
	links: {
		github: project.links?.github || undefined,
		website: project.links?.website || undefined,
	},
	repository: project.repository?.slug
		? { slug: project.repository.slug, branch: project.repository.branch || "main" }
		: undefined,
	downloads: (project.downloads ?? []).map((download) => ({
		...download,
		version: download.version || undefined,
		size: download.size || undefined,
		sha256: download.sha256 || undefined,
	})),
}));

export function getProject(slug: string): Project | undefined {
	return PROJECTS.find((project) => project.slug === slug);
}

/** A same-origin file gets the `download` attribute; external links open in a new tab. */
export function isLocalDownload(download: ProjectDownload): boolean {
	return download.href.startsWith("/downloads/");
}
