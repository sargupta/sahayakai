import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
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
  experimental: {
    serverComponentsExternalPackages: ["@genkit-ai/googleai", "genkit", "@opentelemetry/sdk-node", "firebase-admin", "@google-cloud/secret-manager", "@google-cloud/logging"],
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
