import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/** The CMS is a static page; static files only match their exact path, so /admin needs a hop. */
export const GET: RequestHandler = () => {
	redirect(307, "/admin/index.html");
};
