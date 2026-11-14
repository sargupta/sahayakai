import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'dio_config.dart';

/// Whether this build may send teachers to the web pricing page.
///
/// Plans are sold on the web (Razorpay). Google Play requires Play Billing for
/// digital subscriptions in an Android app and does not allow an app to lead
/// users to another way to pay; the App Store has the same rule. So the
/// "See plans and pricing" link is OFF in Android and iOS builds and ON in the
/// web build.
///
/// Override per build with `--dart-define=WEB_PRICING_LINKS=true` (or `false`).
const String _webPricingFlag = String.fromEnvironment('WEB_PRICING_LINKS');

bool get webPricingLinksByDefault =>
    _webPricingFlag.isEmpty ? kIsWeb : _webPricingFlag == 'true';

/// The web pricing page, or null when this build must not link to it. Every
/// "See plans and pricing" action reads this one value, so no surface can
/// disagree about it. Tests override it.
final webPricingUriProvider = Provider<Uri?>(
  (ref) => webPricingLinksByDefault ? Uri.parse('$kApiBaseUrl/pricing') : null,
);
