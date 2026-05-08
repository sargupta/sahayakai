import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline.html',
  },
  runtimeCaching: [
    {
      urlPattern: /\/api\/(config|user|health)/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'api-config-cache',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60,
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.googleapis\.com/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
        expiration: {
          maxEntries: 4,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
      },
    },
    {
      urlPattern: /^https:\/\/fonts\.gstatic\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 60 * 60 * 24 * 365,
        },
      },
    },
    {
      urlPattern: /\/icons\/.+\.png$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'app-icons',
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  output: "standalone",
  // Reverse-proxy Firebase Auth helper paths through our domain so the OAuth
  // iframe (loaded by signInWithPopup / signInWithRedirect) is same-site with
  // the app. Required for iPhone Safari: ITP blocks third-party iframes to
  // *.firebaseapp.com, which made getRedirectResult() return null and left
  // teachers stranded back on the landing page after Google sign-in.
  // See: https://firebase.google.com/docs/auth/web/redirect-best-practices
  async rewrites() {
    return {
      beforeFiles: [
        // SEO: serve llms.txt, llms-full.txt, and Google verification via clean API routes
        // (Next.js route handlers with dots in the directory name don't resolve through Firebase SSR)
        { source: '/llms.txt', destination: '/api/seo/llms' },
        { source: '/llms-full.txt', destination: '/api/seo/llms-full' },
        { source: '/google8283f170c9f5e54d.html', destination: '/api/seo/google-verify' },
      ],
      afterFiles: [
        // Firebase Auth reverse-proxy for same-site OAuth (iPhone Safari ITP workaround)
        {
          source: '/__/auth/:path*',
          destination: 'https://sahayakai-b4248.firebaseapp.com/__/auth/:path*',
        },
        {
          source: '/__/firebase/:path*',
          destination: 'https://sahayakai-b4248.firebaseapp.com/__/firebase/:path*',
        },
      ],
    };
  },
  // Cache-Control headers — prevents stale deployment errors.
  // HTML pages: no-store so browsers always fetch fresh HTML with the current build ID.
  // Static chunks: immutable (content-addressed filenames change with every build).
  async headers() {
    return [
      {
        // All HTML pages — never cache, always get fresh build ID from server
        source: '/((?!_next/static|_next/image|favicon\\.ico).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
      {
        // Static JS/CSS chunks are content-addressed — safe to cache forever
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  serverExternalPackages: ["@genkit-ai/googleai", "@genkit-ai/firebase", "@genkit-ai/google-cloud", "genkit", "@opentelemetry/sdk-node", "@opentelemetry/api", "@opentelemetry/sdk-trace-base", "@opentelemetry/sdk-metrics", "firebase-admin", "@google-cloud/secret-manager", "@google-cloud/logging"],
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        child_process: false,
        net: false,
        tls: false,
        dns: false,
        events: false,
        util: false,
        stream: false,
        os: false,
        http: false,
        https: false,
        crypto: false,
      };
    }

    // Support the "node:" scheme (common in newer Google Cloud SDKs)
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:events': false,
        'node:stream': false,
        'node:util': false,
        'node:path': false,
        'node:fs': false,
        'node:os': false,
        'node:http': false,
        'node:https': false,
        'node:crypto': false,
        'node:zlib': false,
      };
    }

    if (isServer) {
      config.externals = [...(config.externals || []), 'node:events', 'node:stream', 'node:util', 'node:path', 'node:fs', 'node:os', 'node:http', 'node:https', 'node:crypto', 'node:zlib'];
    }

    return config;
  },
};

const { withSentryConfig } = require("@sentry/nextjs");

export default withSentryConfig(
  withPWA(nextConfig),
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    // Suppresses source map uploading logs during bundling
    silent: true,
    org: "sahayakai",
    project: "sahayakai-web",
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: true,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps: true,

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors.
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  }
);
