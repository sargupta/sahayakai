import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
    dir: './',
})

const config: Config = {
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
    // Force jsdom to resolve the `node` exports condition (CJS) instead of
    // the `browser` condition (ESM). Several transitive deps (jose, firebase-
    // admin's jwks-rsa) ship browser ESM bundles that Jest's CommonJS
    // transform can't parse. Routing through Node resolution picks the CJS
    // variants which Jest handles natively.
    testEnvironmentOptions: {
        customExportConditions: ['node', 'node-addons'],
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^lucide-react$': '<rootDir>/src/__mocks__/lucide-react.ts',
        '^lucide-react/(.*)$': '<rootDir>/src/__mocks__/lucide-react.ts',
        '^uuid$': '<rootDir>/src/__mocks__/uuid.ts',
    },

    collectCoverage: true,
    collectCoverageFrom: [
        'src/lib/safety.ts',
        'src/lib/logger.ts',
        'src/lib/indian-context.ts',
        'src/components/lesson-plan/lesson-plan-input-section.tsx',
        'src/components/feedback-dialog.tsx',
        'src/data/ncert/**/*.ts',
        'src/features/lesson-planner/hooks/use-lesson-plan.ts',
        'src/hooks/use-toast.ts',
        'src/app/page.tsx',
        'src/app/actions/messages.ts',
        'src/app/actions/connections.ts',
        'src/app/actions/community.ts',
        'src/components/messages/**/*.tsx',
        'src/components/community/**/*.tsx',
        'src/lib/server-safety.ts',
        'src/lib/usage-tracker.ts',
        'src/lib/tts.ts',
        'src/lib/db/adapter.ts',
        'src/types/messages.ts',
        // Money/auth/security-critical modules (post-API-migration).
        // Guarded by per-path coverageThreshold entries below.
        'src/server/payments.ts',
        'src/server/auth.ts',
        'src/server/moderation.ts',
        'src/lib/billing-reconciliation.ts',
        'src/lib/organization.ts',
    ],
    transformIgnorePatterns: [
        '/node_modules/(?!(jose|firebase-admin|jwks-rsa|@genkit-ai|@google-cloud|lucide-react|uuid|date-fns)/)',
    ],

    testMatch: [
        '<rootDir>/src/__tests__/**/*.test.{ts,tsx}',
        // Co-located test folders, e.g. `src/ai/data/__tests__/*.test.ts`.
        '<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}',
    ],

    // Avoid jest-haste-map collisions when sibling Claude worktrees exist on
    // disk. Each worktree is a full checkout with the same `__mocks__` files,
    // and Jest panics on duplicate manual mocks unless they're explicitly
    // ignored.
    modulePathIgnorePatterns: [
        '<rootDir>/.claude/worktrees/',
        '<rootDir>/.next/',
    ],
    watchPathIgnorePatterns: [
        '<rootDir>/.claude/worktrees/',
    ],

    coverageThreshold: {
        global: {
            branches: 40,
            functions: 40,
            lines: 40,
            statements: 40,
        },
        // Per-path bars for money/auth/security-critical modules (post-API
        // migration). Target is 80% everywhere; where a file is currently
        // below 80 the bar is pinned to its current floor (rounded down) so
        // the gate protects against regression WITHOUT failing on the current
        // tree. Files/metrics below 80 need more tests later — see notes.
        //
        // At-target (all metrics >= 80): payments, auth, usage-tracker,
        // moderation, billing-reconciliation.
        'src/server/payments.ts': {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
        'src/server/auth.ts': {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
        'src/lib/usage-tracker.ts': {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
        'src/server/moderation.ts': {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
        'src/lib/billing-reconciliation.ts': {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
        // organization: all metrics below 80, pinned to floors.
        // TODO: raise to 80 — needs function coverage on write paths.
        'src/lib/organization.ts': {
            branches: 75,
            functions: 42,
            lines: 58,
            statements: 58,
        },
    },
}

export default createJestConfig(config)
