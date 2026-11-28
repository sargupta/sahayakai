/**
 * Class gate: every public marketing page is reachable by a visitor who is
 * not signed in, and renders without the teacher app's chrome.
 *
 * WHAT NEARLY HAPPENED (2026-11-27, homepage v1 + /features)
 * /features was added under src/app/(marketing). Two separate allow-lists
 * decide how such a page behaves, and neither knows about the folder:
 *   - PUBLIC_PAGE_PREFIXES (src/lib/access/access-state.ts): without an entry,
 *     the access gate sends signed-out visitors away from the page.
 *   - MARKETING_PATHS (src/app/app-shell.tsx): without an entry, the page
 *     renders inside the teacher sidebar and VIDYA chrome, whose API calls
 *     fail for signed-out visitors.
 *
 * WHAT THIS GATE CATCHES
 * Not "/features" but the class: any top-level route folder in
 * src/app/(marketing) that is missing from either list. A future marketing
 * page added without both entries fails here.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { isPublicPage } from "@/lib/access/access-state";
import { MARKETING_PATHS } from "@/app/app-shell";

const SRC = path.resolve(__dirname, "..", "..");
const MARKETING = path.join(SRC, "app", "(marketing)");

/**
 * Pre-existing exceptions (2026-11-27): these were already missing from
 * MARKETING_PATHS before this gate existed, so they render inside the app
 * shell. Kept as an explicit list so the gap is visible; remove an entry when
 * its page is moved onto the marketing layout. Do not add new entries.
 */
const KNOWN_SHELL_EXCEPTIONS = new Set(["/blog", "/bn", "/kn", "/ta"]);

const routes = readdirSync(MARKETING, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("(") && !e.name.startsWith("_"))
  .map((e) => `/${e.name}`);


describe("marketing pages are public", () => {
  it.each([...MARKETING_PATHS])("%s (a marketing-layout page) is also open to signed-out visitors", (p) => {
    expect(isPublicPage(p)).toBe(true);
  });

  it("finds the marketing routes", () => {
    expect(routes).toEqual(expect.arrayContaining(["/about", "/features", "/for-schools"]));
  });

  it.each(routes)("%s is open to signed-out visitors (PUBLIC_PAGE_PREFIXES)", (route) => {
    expect(isPublicPage(route)).toBe(true);
  });

  it.each(routes.filter((r) => !KNOWN_SHELL_EXCEPTIONS.has(r)))(
    "%s renders without the teacher app chrome (MARKETING_PATHS)",
    (route) => {
      expect(MARKETING_PATHS).toContain(route);
    },
  );
});
