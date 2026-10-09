import { NextResponse, type NextRequest } from "next/server";

// One Vercel project, three hosts (Sarp, 2026-10-08):
//   vicolo.space            — marketing index + /privacy
//   app.vicolo.space        — the product: the list (served from /app), /import
//   backoffice.vicolo.space — owner tooling: /usage
// pinsta-two.vercel.app keeps serving the list at / for older links.
// Any other host (localhost, previews) gets plain paths: / is the index, /app the list.
// The apex vs www choice is Vercel's domain setting (today vicolo.space → www); never redirect between them here, or it loops.
const ROOT = "https://www.vicolo.space";
const APP = "https://app.vicolo.space";
const BACKOFFICE = "https://backoffice.vicolo.space";
const OWNER_TOOLS = ["/usage", "/library", "/success"];
const APP_PAGES = ["/import"];

export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const { pathname, search } = req.nextUrl;
  const isTool = OWNER_TOOLS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isAppPage = APP_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const rewrite = (path: string) => NextResponse.rewrite(new URL(path + search, req.url));
  const go = (url: string) => NextResponse.redirect(url, 308);

  if (host === "app.vicolo.space" || host === "pinsta-two.vercel.app") {
    if (pathname === "/") return rewrite("/app");
    if (pathname === "/app") return go(APP + "/" + search);
    if (isTool && host === "app.vicolo.space") return go(BACKOFFICE + pathname + search);
  } else if (host === "backoffice.vicolo.space") {
    if (pathname === "/") return go(BACKOFFICE + "/usage");
    if (pathname === "/app") return go(APP + "/");
    if (isAppPage) return go(APP + pathname + search);
    if (!isTool) return go(ROOT + pathname + search);
  } else if (host === "vicolo.space" || host === "www.vicolo.space") {
    if (pathname === "/app") return go(APP + "/");
    if (isTool) return go(BACKOFFICE + pathname + search);
    if (isAppPage) return go(APP + pathname + search);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: the API, Next's assets and files with an extension pass straight through.
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
