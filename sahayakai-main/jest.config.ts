import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
    dir: './',
})

const config: Config = {
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
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
    ],
    transformIgnorePatterns: [
        '/node_modules/(?!(jose|firebase-admin|jwks-rsa|@genkit-ai|@google-cloud|lucide-react|uuid|date-fns)/)',
    ],

    testMatch: [
        '<rootDir>/src/__tests__/**/*.test.{ts,tsx}',
    ],

    coverageThreshold: {
        global: {
            branches: 40,
            functions: 40,
            lines: 40,
            statements: 40,
        },
    },
}

export default createJestConfig(config)
