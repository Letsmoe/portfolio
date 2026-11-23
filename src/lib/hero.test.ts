import { expect, test } from "bun:test";
import { hasHero } from "./hero";

test("hasHero covers home, blog, gallery and projects, but not the journey map or about", () => {
	expect(["/", "/blog", "/blog/tag-5", "/gallery/2", "/projects", "/projects/drift"].map(hasHero)).toEqual([true, true, true, true, true, true]);
	expect(["/journey", "/journey/luneburg-44030941", "/about"].map(hasHero)).toEqual([false, false, false]);
});
