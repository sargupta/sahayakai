import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/presentation/providers/user_profile_provider.dart';

/// Handles the Razorpay billing callback deep link.
///
/// After Razorpay checkout completes, the user is redirected back to:
///   sahayakai://billing/callback?razorpay_payment_id=xxx&razorpay_subscription_id=xxx
///
/// The backend GET /billing/callback verifies the signature server-side.
/// On the mobile side, we just need to refresh the user's plan.
///
/// Integration:
/// 1. Register deep link scheme `sahayakai` in AndroidManifest.xml and Info.plist
/// 2. Listen for incoming links in main.dart
/// 3. When `billing/callback` is received, call [handleBillingCallback]
class BillingDeepLinkHandler {
  BillingDeepLinkHandler._();

  /// Called when the app receives a `sahayakai://billing/callback` deep link.
  ///
  /// Refreshes the user profile to pick up the new plan type.
  static void handleBillingCallback(WidgetRef ref) {
    debugPrint('[Billing] Callback received — refreshing user profile');
    ref.invalidate(fullUserProfileProvider);
  }
}

// ─── Server-to-Server Endpoints (documented, not called from mobile) ─────────
//
// The following endpoints are server-to-server and are NOT called by the mobile
// app. They're documented here for completeness:
//
// POST /webhooks/razorpay
//   - HMAC-SHA256 verified webhook from Razorpay
//   - Handles: subscription.charged, .cancelled, .halted, .pending, .paused, .resumed
//   - Updates Firestore subscription docs + user plan
//   - Mobile effect: fullUserProfileProvider picks up plan changes on next fetch
//
// POST /attendance/twiml
//   - Twilio IVR callback — generates TwiML for parent call flow
//   - Called by Twilio servers, not by the mobile app
//   - Mobile initiates calls via POST /attendance/call (already wired)
//
// POST /attendance/twiml-status
//   - Twilio status callback for call state changes
//   - Updates outreach record in Firestore
//   - Mobile reads call summary via GET /attendance/call-summary (already wired)
//
// POST /jobs/ai-community-agent
//   - Cloud Scheduler: AI teacher persona participates in community (every 3h)
//
// POST /jobs/ai-reactive-reply
//   - Internal: AI replies to community chat messages
//
// POST /jobs/billing-reconciliation
//   - Cloud Scheduler: Reconciles Razorpay vs Firestore subscription state (4-hourly)
//
// POST /jobs/community-chat-cleanup
//   - Cloud Scheduler: Deletes community messages older than 90 days (daily)
//
// POST /jobs/edu-news
//   - Cloud Scheduler: Scrapes CBSE circulars, posts to education_updates group (6AM IST)
//
// POST /jobs/export-reminder
//   - Cloud Scheduler: Reminds cancelling users to export data (daily)
//
// POST /jobs/storage-cleanup
//   - Pub/Sub: Deletes GCS files after soft content deletion
//
// GET /migrate-ncert
//   - One-time admin migration: seeds NCERT curriculum data
//   - Run manually, never from mobile
