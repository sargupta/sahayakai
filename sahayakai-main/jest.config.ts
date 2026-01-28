import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: './',
})

// Add any custom config to be passed to Jest
const config: Config = {
    coverageProvider: 'v8',
    testEnvironment: 'jsdom',
    // Add more setup options before each test is run
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^jose$': '<rootDir>/node_modules/jose/dist/node/cjs/index.js',
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
    ],
    transformIgnorePatterns: [
        '/node_modules/(?!(jose|firebase-admin|@genkit-ai|@google-cloud|lucide-react)/)',
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config)
