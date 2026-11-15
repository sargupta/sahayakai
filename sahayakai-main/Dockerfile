FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# Expose build arguments
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ARG NEXT_PUBLIC_FIREBASE_VAPID_KEY=BPEp7c3e-25TvrFTSVjPFpN2rIAj5fKSLmID_wKtyZ_3zKNxmNdfh10yASCyAGdlRXiF1uF7hLnyS7OgwZzkIAk
ARG SENTRY_AUTH_TOKEN

# Build-time provenance. Injected by Cloud Build via --build-arg from
# the trigger's $SHORT_SHA / $COMMIT_SHA / $BUILD_ID substitutions.
# Surfaces in /api/health so we can answer "which SHA is live RIGHT
# NOW?" with one curl. Local builds (npm run build) get "local".
ARG GIT_SHA=local
ARG GIT_SHA_FULL=local
ARG BUILD_ID=local

# Make them available during build
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=$NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
ENV NEXT_PUBLIC_FIREBASE_VAPID_KEY=$NEXT_PUBLIC_FIREBASE_VAPID_KEY
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV GIT_SHA=$GIT_SHA
ENV GIT_SHA_FULL=$GIT_SHA_FULL
ENV BUILD_ID=$BUILD_ID

ENV NEXT_TELEMETRY_DISABLED 1

# Next.js + Genkit + Sentry + PWA + regional-examples seed pushes the build
# past the default ~1.5GB Node heap. Cloud Build OOM'd at 1869MB on
# 2026-05-19 (build 29c25ce0). 4GB is comfortable headroom.
ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

# Forward build-time provenance into the runtime stage so /api/health
# can read process.env.GIT_SHA / GIT_SHA_FULL / BUILD_ID.
ARG GIT_SHA=local
ARG GIT_SHA_FULL=local
ARG BUILD_ID=local
ENV GIT_SHA=$GIT_SHA
ENV GIT_SHA_FULL=$GIT_SHA_FULL
ENV BUILD_ID=$BUILD_ID

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Build-time assertion: standalone mode must produce server.js. If a
# future next.config drops `output: 'standalone'`, the COPY above
# silently copies an empty tree and CMD ["node","server.js"] fails at
# runtime instead of build time. This RUN turns the silent failure into
# a loud build failure.
RUN test -f server.js || { echo "ERROR: server.js missing — check next.config 'output: standalone'"; exit 1; }

USER nextjs

EXPOSE 3000

ENV PORT=3000
# set hostname to localhost
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
