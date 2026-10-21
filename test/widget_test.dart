// Foundation smoke test: the app boots to the themed splash screen.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/app.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  testWidgets('App boots to the splash brand mark', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const ProviderScope(child: SahayakApp()));
    // One frame is enough to render the splash.
    await tester.pump();
    expect(find.text('SahayakAI'), findsWidgets);

    // Drain the 600ms bootstrap timer so no timers remain pending, then let
    // the router redirect off the splash.
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pump();
  });
}
