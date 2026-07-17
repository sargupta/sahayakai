import 'package:flutter/material.dart';

/// Shared fixtures for the splash suites. Not a `_test.dart` file, so the
/// runner ignores it.
///
/// The app-level harness these suites run on lives in `test/support/` because
/// onboarding needs the same real router; see `test/support/app_harness.dart`.

/// The DESIGN_RUBRIC §11 Indic probe strings.
const String kBn = 'শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক';
const String kTa = 'ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்';
const String kMl = 'അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി';

/// The 360dp phone gate from DESIGN_RUBRIC §12.9.
const Size kNarrowPhone = Size(360, 900);

/// A deliberately short surface. The splash centres its brand mark when the
/// content fits and scrolls when it does not; at textScale 1.3 with the failure
/// state showing, a short screen is exactly where a Spacer-based layout would
/// overflow.
const Size kShortPhone = Size(360, 480);
