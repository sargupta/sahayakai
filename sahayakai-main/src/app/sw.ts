/// <reference lib="webworker" />
/**
 * Service worker source for @serwist/next (replaces the generated next-pwa
 * worker). Bundled at build time via `swSrc` in next.config.ts; output is
 * public/sw.js (gitignored). `self.__SW_MANIFEST` is the injected precache
 * manifest — Next build assets plus everything under public/ (default
 * globPublicPatterns "**\/*"), which is what precaches /offline.html for the
 * document fallback below.
 *
 * Semantics ported 1:1 from the old next-pwa config:
 *   - register: true (Serwist default), skipWaiting + clientsClaim
 *   - document offline fallback -> /offline.html
 *   - runtimeCaching: api-config SWR, Google Fonts, app icons
 */
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist, StaleWhileRevalidate } from "serwist";
import { defaultCache } from "@serwist/next/worker";
import { apiNetworkOnlyMatcher, buildRuntimeCaching } from "@/lib/pwa/runtime-caching";

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

// Custom entries come BEFORE defaultCache so they win route matching.
//
// The API rule is first and deliberately absolute: same-origin /api/** is
// never written to a cache. See src/lib/pwa/runtime-caching.ts for why the
// previous StaleWhileRevalidate "api-config-cache" rule (which, being an
// unanchored regex, also swallowed /api/user/profile) had to go.
const assetCaching: RuntimeCaching[] = [
    {
        matcher: /^https:\/\/fonts\.googleapis\.com/,
        handler: new StaleWhileRevalidate({
            cacheName: "google-fonts-stylesheets",
            plugins: [
                new ExpirationPlugin({
                    maxEntries: 4,
                    maxAgeSeconds: 60 * 60 * 24 * 365,
                }),
            ],
        }),
    },
    {
        matcher: /^https:\/\/fonts\.gstatic\.com/,
        handler: new CacheFirst({
            cacheName: "google-fonts-webfonts",
            plugins: [
                new ExpirationPlugin({
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365,
                }),
            ],
        }),
    },
    {
        matcher: /\/icons\/.+\.png$/,
        handler: new CacheFirst({
            cacheName: "app-icons",
            plugins: [
                new ExpirationPlugin({
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 30,
                }),
            ],
        }),
    },
];

// The API rule goes first and nothing may be inserted ahead of it. Serwist is
// first-match-wins, so this is what stops serwist's own NetworkFirst "apis"
// entry (further down defaultCache) from ever seeing an API request.
// `findApiCachingViolations` in the test suite enforces the ordering.
const runtimeCaching: RuntimeCaching[] = buildRuntimeCaching(
    { matcher: apiNetworkOnlyMatcher, handler: new NetworkOnly() },
    assetCaching,
    defaultCache,
);

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching,
    fallbacks: {
        entries: [
            {
                url: "/offline.html",
                matcher({ request }) {
                    return request.destination === "document";
                },
            },
        ],
    },
});

serwist.addEventListeners();

// Recovery for installs that already hold poisoned API responses. Clients
// running the old worker cached authenticated GET /api/** under these names,
// with a 24h expiry; without this they keep serving that data until it ages
// out. Deleting the caches is safe — every entry is re-fetchable, and the
// new rules never write to them again. Remove once the fleet has rolled over.
const POISONED_CACHES = ["apis", "api-config-cache"];

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            const names = await caches.keys();
            await Promise.all(
                names.filter((n) => POISONED_CACHES.includes(n)).map((n) => caches.delete(n)),
            );
        })(),
    );
});
