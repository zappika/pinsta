import assert from "node:assert/strict";
import { parseSourceUrl } from "../lib/sources";
import { readGoogleLink } from "../lib/google-link";
import { canonicalTikTokUrl } from "../lib/tiktok";

// Share sheets can supply a URL item or a caption containing a short URL.
assert.deepEqual(parseSourceUrl("Try this https://example.com/nope and https://vm.tiktok.com/ABC123/"), {
  kind: "tiktok", url: "https://vm.tiktok.com/ABC123/",
});
assert.equal(parseSourceUrl("https://maps.app.goo.gl/XYZ123")?.kind, "google");
assert.equal(parseSourceUrl("https://maps.app.goo.gl/XYZ123.")?.url, "https://maps.app.goo.gl/XYZ123");
assert.equal(parseSourceUrl("https://vt.tiktok.com/ABC123/")?.kind, "tiktok");
assert.equal(parseSourceUrl("See https://maps.app.goo.gl/XYZ123, it's great")?.url, "https://maps.app.goo.gl/XYZ123");
assert.equal(parseSourceUrl("https://"), null);

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const url = String(input);
  if (url.includes("maps.app.goo.gl/CONSENT")) {
    const target = "https://www.google.com/maps/place/Cal+Pep/@41.3800,2.1800,17z/data=!3d41.3810!4d2.1810";
    return { url: `https://consent.google.com/ml?continue=${encodeURIComponent(target)}` } as Response;
  }
  if (url.includes("maps.app.goo.gl")) {
    return { url: "https://www.google.com/maps/place/Cal+Pep/@41.3800,2.1800,17z/data=!3d41.3810!4d2.1810" } as Response;
  }
  if (url.includes("vm.tiktok.com")) {
    return { url: "https://www.tiktok.com/@someone/video/1234567890123456789?share=1" } as Response;
  }
  throw new Error(`Unexpected fetch: ${url}`);
};

try {
  assert.deepEqual(await readGoogleLink("https://maps.app.goo.gl/XYZ123"), {
    url: "https://www.google.com/maps/place/Cal+Pep/@41.3800,2.1800,17z/data=!3d41.3810!4d2.1810",
    name: "Cal Pep", lat: 41.381, lng: 2.181, placeId: null,
  });
  assert.equal((await readGoogleLink("https://maps.app.goo.gl/CONSENT")).name, "Cal Pep");
  assert.equal(await canonicalTikTokUrl("https://vm.tiktok.com/ABC123/"),
    "https://www.tiktok.com/@someone/video/1234567890123456789");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Link parsing and short-link redirect checks passed");
