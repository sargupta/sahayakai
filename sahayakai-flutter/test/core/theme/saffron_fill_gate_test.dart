import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/data/inbox_transport.dart';
import 'package:sahayakai/features/inbox/data/messages_stream_provider.dart';
import 'package:sahayakai/features/quiz_generator/presentation/widgets/quiz_result_view.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_providers.dart';
import 'package:sahayakai/features/staffroom/data/staffroom_transport.dart';
import 'package:sahayakai/shared/widgets/app_segmented.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../features/onboarding/onboarding_fixtures.dart';
import '../../support/app_harness.dart';
import '../../support/fake_block_c_transports.dart';
import '../../support/home_day_fixtures.dart';
import '../../support/saffron_fill_audit.dart';

/// Class gate for the 26 Oct 2026 design decision: white text never sits on
/// saffron-500 (3.77:1); a saffron fill that carries a label is `accent-fill`
/// (saffron-600, 5.28:1).
///
/// The bug class is "a label painted on a saffron-500 fill", whatever widget
/// draws it. [labelsOnSaffron500] finds it in a rendered frame. The gallery
/// covers every label-carrying saffron fill the app has (buttons, segments);
/// the sweep renders every top-level route; the control proves the audit
/// catches the bug when it is there.
void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  Widget host(Widget child) => MaterialApp(
    theme: AppTheme.light(),
    home: Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: child,
      ),
    ),
  );

  testWidgets('control: a label on a saffron-500 fill is caught', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        Container(
          color: AppColors.saffron500,
          padding: const EdgeInsets.all(12),
          child: const Text('Generate', style: TextStyle(color: Colors.white)),
        ),
      ),
    );
    expect(labelsOnSaffron500(tester), ['Generate']);
  });

  testWidgets('control: an icon-only saffron-500 disc is allowed', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.saffron500,
          ),
          child: const Icon(Icons.mic, color: Colors.white),
        ),
      ),
    );
    expect(labelsOnSaffron500(tester), isEmpty);
  });

  testWidgets('the label-carrying saffron fills sit on accent-fill', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PrimaryButton(label: 'Generate', onPressed: () {}),
            const SizedBox(height: 12),
            FilledButton(onPressed: () {}, child: const Text('Deliver')),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: () {}, child: const Text('Open')),
            const SizedBox(height: 12),
            AppSegmented<int>(
              value: 0,
              onChanged: (_) {},
              segments: const [
                AppSegment(value: 0, label: 'Easy'),
                AppSegment(value: 1, label: 'Medium'),
                AppSegment(value: 2, label: 'Hard'),
              ],
            ),
            const SizedBox(height: 12),
            QuizDifficultySegmented(
              labels: const ['Easy', 'Medium', 'Hard'],
              selectedIndex: 1,
              onSelected: (_) {},
            ),
          ],
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(labelsOnSaffron500(tester), isEmpty);
  });

  const routes = <String>[
    '/', '/prep-desk', '/my-library', '/my-profile', '/settings',
    '/lesson-plan', '/quiz-generator', '/instant-answer', '/worksheet-wizard',
    '/rubric-generator', '/exam-paper', '/teacher-training',
    '/assess-assignment', '/assessment-scanner', '/visual-aid',
    '/video-storyteller', '/virtual-field-trip', '/content-creator',
    '/messages', '/parent-hotline', '/attendance', '/attendance/new',
    '/inbox', '/network', '/staffroom', '/onboarding',
  ];

  for (final route in routes) {
    testWidgets('no label on a saffron-500 fill at $route', (tester) async {
      await pumpSignedInApp(
        tester,
        extraOverrides: [
          fixedClock(),
          ...sampleDayOverrides(),
          staffroomTransportProvider.overrideWithValue(
            FakeStaffroomTransport(),
          ),
          currentStaffroomUserIdProvider.overrideWithValue('u-me'),
          inboxTransportProvider.overrideWithValue(FakeInboxTransport()),
          currentInboxUserIdProvider.overrideWithValue('u-me'),
        ],
        surface: const Size(360, 1600),
      );
      if (route != '/') {
        routerOf(tester).go(route);
        await tester.pumpAndSettle();
      }
      expect(labelsOnSaffron500(tester), isEmpty, reason: route);
    });
  }
}
