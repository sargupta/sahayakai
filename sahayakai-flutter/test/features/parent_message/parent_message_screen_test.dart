import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/parent_message/domain/parent_message.dart';
import 'package:sahayakai/features/parent_message/presentation/parent_message_controller.dart';
import 'package:sahayakai/features/parent_message/presentation/parent_message_screen.dart';
import 'package:sahayakai/features/parent_message/presentation/widgets/parent_message_error_view.dart';
import 'package:sahayakai/features/parent_message/presentation/widgets/parent_message_result_view.dart';
import 'package:sahayakai/features/parent_message/presentation/widgets/parent_message_skeleton.dart';
import 'package:sahayakai/shared/widgets/labeled_field.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import 'parent_message_fixtures.dart';

/// Screen-layer gates: the four async states, the required-field validation the
/// endpoint depends on (esp. the parent-language select), the reason options
/// rendering and a full happy-path submit that pins the reason wire value, the
/// specific 400 message, and the DESIGN_RUBRIC §12 overflow checks. No test hits
/// the network: the ApiClient is faked and either stubs a response or is never
/// reached (validation blocks it).
Widget _host({
  Brightness brightness = Brightness.light,
  double textScale = 1.0,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context)
            .copyWith(textScaler: TextScaler.linear(textScale)),
        child: child!,
      ),
      home: const ParentMessageScreen(),
    ),
  );
}

/// The TextFormField inside the [LabeledField] carrying [label].
Finder _fieldFor(String label) => find.descendant(
      of: find.ancestor(
        of: find.text(label),
        matching: find.byType(LabeledField),
      ),
      matching: find.byType(TextFormField),
    );

/// Typed dropdown finders. Tapping the DropdownButtonFormField itself (not the
/// hint Text behind its decoration) is the hit target, so the tap never warns.
final Finder _subjectDropdown = find.byType(DropdownButtonFormField<String>);
final Finder _reasonDropdown =
    find.byType(DropdownButtonFormField<ParentMessageReason>);
final Finder _languageDropdown =
    find.byType(DropdownButtonFormField<AppLocale>);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  group('states', () {
    testWidgets('opens in the idle/empty state', (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      expect(find.textContaining('a caring message home will be drafted'),
          findsOneWidget);
    });

    testWidgets('loading shows the message-shaped skeleton', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            parentMessageControllerProvider.overrideWith(_StubController.loading),
          ],
        ),
      );
      await tester.pump(); // don't settle: the loading future never completes

      expect(find.byType(ParentMessageSkeleton), findsOneWidget);
    });

    testWidgets('data renders the message result', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            parentMessageControllerProvider
                .overrideWith(() => _StubController(data: buildMessage())),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ParentMessageResultView), findsOneWidget);
    });

    testWidgets('an error maps to the error view', (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            parentMessageControllerProvider.overrideWith(
              () => _StubController(
                error: const ApiException(
                  ApiErrorKind.server,
                  'x',
                  statusCode: 503,
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ParentMessageErrorView), findsOneWidget);
      expect(find.textContaining('busy right now'), findsOneWidget);
    });

    testWidgets('a 400 missing-required error surfaces the SPECIFIC message',
        (tester) async {
      await tester.pumpWidget(
        _host(
          overrides: [
            parentMessageControllerProvider.overrideWith(
              () => _StubController(
                error: const ApiException(
                  ApiErrorKind.badResponse,
                  'Missing required fields',
                  statusCode: 400,
                ),
              ),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(ParentMessageErrorView), findsOneWidget);
      expect(
        find.textContaining(
          "Please fill in the student, class, subject, reason and parent's language",
        ),
        findsOneWidget,
      );
    });
  });

  group('form', () {
    testWidgets('renders the required fields and the four reason options',
        (tester) async {
      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      expect(find.text('Student name'), findsOneWidget);
      expect(find.text('Class'), findsOneWidget);
      expect(find.text('Subject'), findsOneWidget);
      expect(find.text('Reason for the message'), findsOneWidget);
      expect(find.text("Parent's language"), findsOneWidget);

      // Open the reason dropdown; all four options must be present.
      await tester.ensureVisible(_reasonDropdown);
      await tester.tap(_reasonDropdown);
      await tester.pumpAndSettle();

      expect(find.text('Repeated absences'), findsOneWidget);
      expect(find.text('Academic support'), findsOneWidget);
      expect(find.text('Behaviour in class'), findsOneWidget);
      expect(find.text('Good news to share'), findsOneWidget);
    });

    testWidgets('the days-absent field appears only for an absence reason',
        (tester) async {
      await tester.pumpWidget(_host());
      await tester.pumpAndSettle();

      // Not shown until a reason is chosen.
      expect(find.text('Days absent'), findsNothing);

      await _selectDropdown(tester, _reasonDropdown, 'Repeated absences');

      expect(find.text('Days absent'), findsOneWidget);
    });
  });

  group('validation', () {
    testWidgets(
        'the parent-language select is required: a missing choice blocks submit',
        (tester) async {
      final fake = FakeApiClient();
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        _host(overrides: [apiClientProvider.overrideWithValue(fake)]),
      );
      await tester.pumpAndSettle();

      // Fill everything EXCEPT the parent's language.
      await tester.enterText(_fieldFor('Student name'), 'Ravi Kumar');
      await tester.enterText(_fieldFor('Class'), 'Class 6A');
      await _selectDropdown(tester, _subjectDropdown, 'Mathematics');
      await _selectDropdown(tester, _reasonDropdown, 'Academic support');

      await _tapSubmit(tester);

      // The validator surfaces its message and no request is fired.
      expect(find.text("Please choose the parent's language."), findsOneWidget);
      expect(fake.posts, isEmpty);
      expect(find.byType(ParentMessageResultView), findsNothing);
      expect(find.byType(ParentMessageSkeleton), findsNothing);
    });

    testWidgets('an empty student name blocks submit', (tester) async {
      final fake = FakeApiClient();
      await tester.pumpWidget(
        _host(overrides: [apiClientProvider.overrideWithValue(fake)]),
      );
      await tester.pumpAndSettle();

      await _tapSubmit(tester);

      expect(find.text("Please enter the student's name."), findsOneWidget);
      expect(fake.posts, isEmpty);
    });
  });

  group('submit', () {
    testWidgets(
        'a complete form submits, sends the reason wire + parentLanguage, and '
        'renders the result', (tester) async {
      // A tall viewport so the whole form (down to the parent-language select)
      // is on-screen and every dropdown tap lands cleanly, rather than
      // ensureVisible parking a field under the app bar.
      tester.view.physicalSize = const Size(360, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final fake = FakeApiClient(
        postResponse: <String, dynamic>{
          'message': 'Dear parent, thank you for your support.',
          'languageCode': 'hi-IN',
          'wordCount': 20,
        },
      );

      await tester.pumpWidget(
        _host(overrides: [apiClientProvider.overrideWithValue(fake)]),
      );
      await tester.pumpAndSettle();

      await tester.enterText(_fieldFor('Student name'), 'Ravi Kumar');
      await tester.enterText(_fieldFor('Class'), 'Class 6A');
      await _selectDropdown(tester, _subjectDropdown, 'Mathematics');
      await _selectDropdown(tester, _reasonDropdown, 'Academic support');
      await _selectDropdown(tester, _languageDropdown, 'हिन्दी');

      await _tapSubmit(tester);
      await tester.pumpAndSettle();

      // The request went out with the exact wire contract.
      expect(fake.posts, hasLength(1));
      expect(fake.posts.single.path, '/api/ai/parent-message');
      final body = fake.posts.single.data as Map<String, dynamic>;
      expect(body['studentName'], 'Ravi Kumar');
      expect(body['className'], 'Class 6A');
      expect(body['subject'], 'Mathematics');
      expect(body['reason'], 'poor_performance'); // enum -> wire token
      expect(body['parentLanguage'], 'Hindi'); // AppLocale.aiName

      // And the result renders.
      expect(find.byType(ParentMessageResultView), findsOneWidget);
      expect(find.textContaining('Dear parent'), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final scale in <double>[1.0, 1.3]) {
        testWidgets(
          'form renders at 360dp, textScale $scale, ${brightness.name}',
          (tester) async {
            tester.view.physicalSize = kNarrowPhone;
            tester.view.devicePixelRatio = 1.0;
            addTearDown(tester.view.reset);

            await tester.pumpWidget(
              _host(brightness: brightness, textScale: scale),
            );
            await tester.pumpAndSettle();
            expect(tester.takeException(), isNull);

            expect(find.text('Student name'), findsOneWidget);
            expect(find.text("Parent's language"), findsOneWidget);
          },
        );
      }
    }

    testWidgets('a long Indic student name does not overflow the field',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(_host(textScale: 1.3));
      await tester.pumpAndSettle();

      await tester.enterText(
        _fieldFor('Student name'),
        '$kBn $kTa $kMl $kLongWord',
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}

/// Opens [dropdown] and taps the option labelled [option]. ensureVisible first:
/// at 360dp the lower dropdowns sit below the fold and a bare tap only WARNS on
/// the missed hit-test. Tapping the dropdown widget (not the hint Text) is the
/// real hit target, so the open tap lands cleanly.
Future<void> _selectDropdown(
  WidgetTester tester,
  Finder dropdown,
  String option,
) async {
  await tester.ensureVisible(dropdown);
  await tester.tap(dropdown);
  await tester.pumpAndSettle();
  await tester.tap(find.text(option).last);
  await tester.pumpAndSettle();
}

/// Taps the sticky "Draft message" submit button (in the ToolScaffold bottom
/// bar, always visible).
Future<void> _tapSubmit(WidgetTester tester) async {
  final submit = find.text('Draft message');
  await tester.ensureVisible(submit);
  await tester.tap(submit);
  await tester.pumpAndSettle();
}

/// A controller with a fixed outcome, so the screen's four async states can be
/// rendered without a live request.
class _StubController extends ParentMessageController {
  _StubController({this.data, this.error, this.isLoading = false});

  factory _StubController.loading() => _StubController(isLoading: true);

  final ParentMessage? data;
  final Object? error;
  final bool isLoading;

  @override
  FutureOr<ParentMessage?> build() {
    if (isLoading) return Completer<ParentMessage?>().future;
    if (error != null) throw error!;
    return data;
  }
}
