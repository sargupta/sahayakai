import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/assess_assignment/presentation/assess_assignment_screen.dart';
import 'package:sahayakai/features/rubric_generator/presentation/rubric_generator_screen.dart';
import 'package:sahayakai/features/teacher_training/presentation/teacher_training_screen.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/inline_field_mic.dart';
import 'package:sahayakai/features/virtual_field_trip/presentation/virtual_field_trip_screen.dart';
import 'package:sahayakai/features/worksheet_wizard/presentation/worksheet_wizard_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// VOICE_FIRST_GAP field-mic sweep. Every form-driven tool with a free-text
/// CONTENT field must let a teacher DICTATE it, not only type it — the direct
/// answer to the "screen dependent, finger dependent" complaint. Instant Answer,
/// Lesson Plan, Quiz, Visual Aid, Video Storyteller and Parent Message already
/// carry the field mic and are pinned by their own suites; this pins the five
/// swept in this pass, each of which has exactly one free-text content field and
/// therefore exactly one [InlineFieldMic] (the closed pickers, numeric and
/// short-identifier fields deliberately have none).
Widget _host(Widget screen) => ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: screen,
      ),
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  // Screen name -> the tool screen. Each renders in its idle state with no
  // provider overrides (the controllers build to idle) and shows its single
  // free-text content field immediately, so the mic is asserted on the real
  // form, not a stub.
  final swept = <String, Widget>{
    'Worksheet Wizard': const WorksheetWizardScreen(),
    'Rubric Generator': const RubricGeneratorScreen(),
    'Teacher Training': const TeacherTrainingScreen(),
    'Virtual Field Trip': const VirtualFieldTripScreen(),
  };

  swept.forEach((name, screen) {
    testWidgets('$name carries a dictation mic on its free-text content field',
        (tester) async {
      await tester.pumpWidget(_host(screen));
      await tester.pumpAndSettle();
      expect(
        find.byType(InlineFieldMic),
        findsOneWidget,
        reason: '$name must let a teacher speak its free-text content, not only '
            'type it',
      );
    });
  });

  // Assess Assignment's only free-text field is the corrected transcript, which
  // appears solely in "Score a transcript" mode (the default "Grade" mode takes
  // just a photo). Enter that mode, then assert the mic is on it.
  testWidgets('Assess Assignment carries a dictation mic on the score-mode '
      'transcript field', (tester) async {
    await tester.pumpWidget(_host(const AssessAssignmentScreen()));
    await tester.pumpAndSettle();
    // Grade mode shows no free-text field, so no mic yet.
    expect(find.byType(InlineFieldMic), findsNothing);

    // The mode selector is a row of ChoiceChips below the fold; scroll it in
    // before tapping (mirrors the screen's own mode-selection test).
    final scoreChip = find.widgetWithText(ChoiceChip, 'Score a transcript');
    await tester.ensureVisible(scoreChip);
    await tester.tap(scoreChip);
    await tester.pumpAndSettle();

    expect(
      find.byType(InlineFieldMic),
      findsOneWidget,
      reason: 'a teacher must be able to speak the corrected transcript',
    );
  });
}
