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
import { CacheFirst, ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";
import { defaultCache } from "@serwist/next/worker";

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

// Custom entries come BEFORE defaultCache so they win route matching.
const runtimeCaching: RuntimeCaching[] = [
    {
        matcher: /\/api\/(config|user|health)/,
        handler: new StaleWhileRevalidate({
            cacheName: "api-config-cache",
            plugins: [
                new ExpirationPlugin({
                    maxEntries: 32,
                    maxAgeSeconds: 24 * 60 * 60,
                }),
            ],
        }),
    },
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
    ...defaultCache,
];

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
