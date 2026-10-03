/**
 * Class gate for the 2026-09-01 PWA outage.
 *
 * Symptom: multiple unrelated features dead in the installed PWA while the
 * same account worked in a normal browser tab. Cause: the service worker
 * cached authenticated GET /api/** responses, so `/api/usage` was served
 * stale (or served across users, being keyed on URL with no
 * `Vary: Authorization`), and `use-subscription` degraded to `plan: 'free'`
 * with every capability flag off.
 *
 * This gate does not test "the apis rule is gone". It tests the CLASS: no
 * caching rule from ANY source may reach same-origin API traffic. A future
 * serwist release, or a well-meaning new rule of our own, is caught here.
 */
import {
    apiNetworkOnlyMatcher,
    buildRuntimeCaching,
    entryMatches,
    findApiCachingViolations,
    isNeverCacheableApi,
    reachesApiTraffic,
    type CachingEntryLike,
} from "@/lib/pwa/runtime-caching";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = (p: string, origin = "https://www.sahayakai.com") => new URL(p, origin);

/**
 * The rule that actually shipped, lifted verbatim from the deployed
 * public/sw.js on 2026-09-01. If `stripApiCachingRules` ever stops removing
 * this, the outage is back.
 */
const SHIPPED_SERWIST_APIS_RULE: CachingEntryLike = {
    matcher: ({ sameOrigin, url: u }) => sameOrigin && u.pathname.startsWith("/api/"),
    method: "GET",
    handler: { cacheName: "apis", networkTimeoutSeconds: 10 },
};

/** The over-matching custom rule that shipped alongside it. */
const SHIPPED_API_CONFIG_RULE: CachingEntryLike = {
    matcher: /\/api\/(config|user|health)/,
    handler: { cacheName: "api-config-cache" },
};

describe("isNeverCacheableApi", () => {
    it.each([
        "/api/usage",
        "/api/user/profile",
        "/api/content/list",
        "/api/ai/quiz",
        "/api/ai/exam-paper",
        "/api/jobs/abc123",
        "/api/health",
    ])("treats same-origin %s as never cacheable", (path) => {
        expect(isNeverCacheableApi(url(path), true)).toBe(true);
    });

    it("leaves page and static routes alone", () => {
        for (const p of ["/exam-paper", "/_next/static/chunks/x.js", "/offline.html", "/apitude"]) {
            expect(isNeverCacheableApi(url(p), true)).toBe(false);
        }
    });

    it("does not claim cross-origin API URLs", () => {
        expect(isNeverCacheableApi(url("/api/usage", "https://example.com"), false)).toBe(false);
    });
});

describe("the rules that caused the outage", () => {
    it("recognises serwist's shipped `apis` NetworkFirst rule as reaching API traffic", () => {
        expect(reachesApiTraffic(SHIPPED_SERWIST_APIS_RULE)).toBe(true);
    });

    it("recognises that the old api-config regex was unanchored and also swallowed /api/user/profile", () => {
        // This is the specific latent bug: the rule was written for
        // /api/user, but an unanchored regex matches the whole href.
        expect(entryMatches(SHIPPED_API_CONFIG_RULE, url("/api/user/profile"))).toBe(true);
        expect(reachesApiTraffic(SHIPPED_API_CONFIG_RULE)).toBe(true);
    });

    it("reports both as violations when they sit ahead of the network-only rule", () => {
        const bad = buildRuntimeCaching(
            API_RULE,
            [SHIPPED_API_CONFIG_RULE],          // our old rule, ahead of the API rule
            [SHIPPED_SERWIST_APIS_RULE],
        );
        // Simulate the pre-fix ordering: API rule not first.
        const preFix = [SHIPPED_API_CONFIG_RULE, ...bad.filter((e) => e !== SHIPPED_API_CONFIG_RULE)];
        expect(findApiCachingViolations(preFix)).toContain(SHIPPED_API_CONFIG_RULE);
    });

    it("reports nothing once the network-only rule is first", () => {
        const good = buildRuntimeCaching(API_RULE, [], [SHIPPED_API_CONFIG_RULE, SHIPPED_SERWIST_APIS_RULE]);
        expect(findApiCachingViolations(good)).toEqual([]);
    });
});

/** Stand-in for the worker's real entry; only the matcher identity matters. */
const API_RULE: CachingEntryLike = { matcher: apiNetworkOnlyMatcher, handler: { cacheName: "network-only" } };

describe("class gate — no future rule may cache API traffic", () => {
    // Shapes a future serwist release (or one of us) could plausibly add.
    const hostile: Array<[string, CachingEntryLike]> = [
        ["startsWith matcher", { matcher: ({ url: u }) => u.pathname.startsWith("/api/"), handler: {} }],
        ["regex on /api/", { matcher: /\/api\//, handler: {} }],
        ["anchored regex", { matcher: /^https:\/\/www\.sahayakai\.com\/api\/.*/, handler: {} }],
        ["narrow single route", { matcher: /\/api\/usage/, handler: {} }],
        ["ai routes only", { matcher: ({ url: u }) => u.pathname.includes("/api/ai/"), handler: {} }],
        ["job polling", { matcher: /\/api\/jobs\//, handler: {} }],
        ["explicit GET method", { matcher: /\/api\/content/, method: "GET", handler: {} }],
    ];

    it.each(hostile)("neutralises a %s rule placed below the API rule", (_label, entry) => {
        expect(reachesApiTraffic(entry)).toBe(true);
        expect(findApiCachingViolations(buildRuntimeCaching(API_RULE, [], [entry]))).toEqual([]);
    });

    it.each(hostile)("flags a %s rule placed ABOVE the API rule", (_label, entry) => {
        expect(findApiCachingViolations([entry, API_RULE])).toEqual([entry]);
    });

    it("flags everything when no network-only API rule is registered at all", () => {
        expect(findApiCachingViolations([SHIPPED_SERWIST_APIS_RULE])).toEqual([SHIPPED_SERWIST_APIS_RULE]);
    });

    it("leaves every non-API rule alone, wherever it sits", () => {
        const benign: CachingEntryLike[] = [
            { matcher: /^https:\/\/fonts\.googleapis\.com/, handler: {} },
            { matcher: /\/icons\/.+\.png$/, handler: {} },
            { matcher: /\.(?:json|xml|csv)$/i, handler: {} },
            { matcher: ({ url: u }: { url: URL }) => u.pathname.startsWith("/_next/static/"), handler: {} },
        ];
        expect(findApiCachingViolations([...benign, API_RULE])).toEqual([]);
        expect(buildRuntimeCaching(API_RULE, benign, [])).toHaveLength(benign.length + 1);
    });

    it("keeps serwist's NetworkOnly /api/auth rule — it never caches, so removing it was wrong", () => {
        // Regression guard for the first draft of this fix, which deleted it.
        const authRule: CachingEntryLike = { matcher: /\/api\/auth\/.*/, handler: { cacheName: "serwist-runtime" } };
        const list = buildRuntimeCaching(API_RULE, [], [authRule]);
        expect(list).toContain(authRule);
        expect(findApiCachingViolations(list)).toEqual([]);
    });

    it("does not strip a non-GET rule that never applies to our GET traffic", () => {
        // POST bodies are not cacheable by the Cache API anyway; the gate is
        // about GET responses being replayed.
        const postOnly: CachingEntryLike = { matcher: /\/api\//, method: "POST", handler: {} };
        expect(reachesApiTraffic(postOnly)).toBe(false);
    });
});

describe("the worker source itself", () => {
    const sw = readFileSync(join(process.cwd(), "src/app/sw.ts"), "utf8");

    it("builds its rule list through buildRuntimeCaching, with the API rule first", () => {
        expect(sw).toMatch(/buildRuntimeCaching\(\s*\{\s*matcher:\s*apiNetworkOnlyMatcher,\s*handler:\s*new NetworkOnly\(\)\s*\},/);
    });

    it("still passes defaultCache in, rather than dropping rules from it", () => {
        expect(sw).toMatch(/defaultCache,?\s*\);/);
    });

    it("no longer carries the unanchored api-config-cache rule", () => {
        expect(sw).not.toMatch(/cacheName:\s*"api-config-cache"/);
        expect(sw).not.toMatch(/\/\\\/api\\\/\(config\|user\|health\)\//);
    });

    it("purges the caches poisoned by the previous worker", () => {
        expect(sw).toMatch(/POISONED_CACHES\s*=\s*\["apis",\s*"api-config-cache"\]/);
        expect(sw).toMatch(/caches\.delete/);
    });
});
