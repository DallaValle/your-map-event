// Public maps live at /[teamSlug], so a team slug must never shadow an app
// route or a well-known file the browser requests from the root.
const RESERVED_SLUGS = new Set([
  "dashboard",
  "sign-in",
  "sign-up",
  "api",
  "~offline",
  "sw.js",
  "manifest.webmanifest",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "icons",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function validateSlug(slug: string): string | null {
  if (slug.length < 3 || slug.length > 48) {
    return "Slug must be between 3 and 48 characters.";
  }
  if (!SLUG_PATTERN.test(slug)) {
    return "Slug may only contain lowercase letters, numbers and hyphens.";
  }
  if (RESERVED_SLUGS.has(slug)) {
    return `"${slug}" is reserved. Please pick another slug.`;
  }
  return null;
}
