/** Pages that open with a full-screen hero, which runs under the floating header. */
export function hasHero(pathname: string): boolean {
	return pathname === "/" || pathname.startsWith("/projects") || pathname.startsWith("/blog") || pathname.startsWith("/gallery");
}
