/**
 * Regression tests for `isFeatureEnabled` when the Firestore
 * `system_config/feature_flags` doc has no `features` field.
 *
 * P0 bug (QA Lane A6): preview/legacy Firestore docs seeded only the
 * sidecar flag fields. `isFeatureEnabled` read `cfg.features[name]`
 * and threw "Cannot read properties of undefined (reading '...')" at
 * /api/assistant and /api/community/persona-pulse.
 *
 * Fix: optional-chaining (`cfg.features?.[name]`) so the "feature not
 * configured → default-on" branch is taken when the map itself is
 * absent. These tests pin that behavior.
 */

// Mock firebase-admin BEFORE importing the module under test.
const mockGet = jest.fn();
const mockDoc = jest.fn(() => ({ get: mockGet }));

jest.mock('@/lib/firebase-admin', () => ({
    getDb: jest.fn(async () => ({
        doc: mockDoc,
    })),
}));

import {
    isFeatureEnabled,
    invalidateConfigCache,
    type FeatureFlagsConfig,
} from '@/lib/feature-flags';

function snapshot(data: Partial<FeatureFlagsConfig> | null) {
    return {
        exists: data !== null,
        data: () => data,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    invalidateConfigCache();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
    invalidateConfigCache();
});

describe('isFeatureEnabled — defensive handling of undefined features map', () => {
    it('returns default-on without throwing when features field is missing entirely', async () => {
        // Doc exists, sidecar flags seeded, but NO `features` field.
        // This is the exact shape that crashes /api/assistant in preview.
        mockGet.mockResolvedValueOnce(
            snapshot({
                billingKillSwitch: false,
                maintenanceMode: false,
                vidyaSidecarMode: 'off',
                vidyaSidecarPercent: 0,
                // features: undefined  ← the bug trigger
            } as Partial<FeatureFlagsConfig>),
        );

        const result = await isFeatureEnabled('vidyaIntentCacheGate', 'user-1');

        expect(result).toEqual({
            enabled: true,
            reason: 'not_configured_default_on',
        });
    });

    it('returns default-on when features is explicitly an empty map', async () => {
        mockGet.mockResolvedValueOnce(
            snapshot({
                billingKillSwitch: false,
                maintenanceMode: false,
                features: {},
            } as Partial<FeatureFlagsConfig>),
        );

        const result = await isFeatureEnabled('anyFeature', 'user-2');

        expect(result).toEqual({
            enabled: true,
            reason: 'not_configured_default_on',
        });
    });

    it('returns kill-switch reason when billingKillSwitch is true even with no features map', async () => {
        mockGet.mockResolvedValueOnce(
            snapshot({
                billingKillSwitch: true,
                maintenanceMode: false,
            } as Partial<FeatureFlagsConfig>),
        );

        const result = await isFeatureEnabled('someFeature', 'user-3');

        expect(result.enabled).toBe(true);
        expect(result.reason).toBe('billing_kill_switch_all_free');
    });

    it('honors a configured toggle when features map IS present', async () => {
        mockGet.mockResolvedValueOnce(
            snapshot({
                billingKillSwitch: false,
                maintenanceMode: false,
                features: {
                    disabledFeature: { enabled: false },
                },
            } as Partial<FeatureFlagsConfig>),
        );

        const result = await isFeatureEnabled('disabledFeature', 'user-4');

        expect(result.enabled).toBe(false);
        expect(result.reason).toBe('feature_disabled');
    });
});
