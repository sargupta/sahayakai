import { NextRequest, NextResponse } from 'next/server';
import { isSubscriptionEnabled, isFeatureEnabled, getMaintenanceInfo, readConfig } from '@/lib/feature-flags';

/**
 * GET /api/config/flags
 *
 * Returns the evaluated flag state for the authenticated user.
 * The x-user-id header is injected by middleware from the Firebase ID token.
 */
export async function GET(req: NextRequest) {
  const uid = req.headers.get('x-user-id') || 'anonymous';

  try {
    const [sub, maintenance, cfg] = await Promise.all([
      isSubscriptionEnabled(uid),
      getMaintenanceInfo(),
      readConfig(),
    ]);

    // Evaluate all per-feature toggles for this user
    const featureResults: Record<string, boolean> = {};
    for (const featureName of Object.keys(cfg.features)) {
      const result = await isFeatureEnabled(featureName, uid);
      featureResults[featureName] = result.enabled;
    }

    // Log for debugging (server logs only)
    console.log(`[FeatureFlags] uid=${uid} subscription=${sub.enabled} (${sub.reason}) maintenance=${maintenance.active}`);

    return NextResponse.json({
      subscriptionEnabled: sub.enabled,
      subscriptionReason: sub.reason,
      maintenanceMode: maintenance.active,
      maintenanceMessage: maintenance.message,
      features: featureResults,
    });
  } catch (err) {
    console.error('[FeatureFlags] API error:', err);
    // Safe fallback: no paywall, no maintenance
    return NextResponse.json({
      subscriptionEnabled: false,
      subscriptionReason: 'api_error',
      maintenanceMode: false,
      maintenanceMessage: '',
      features: {},
    });
  }
}
