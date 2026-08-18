import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/platform/share_service.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/lesson_planner/domain/lesson_plan.dart';
import 'package:sahayakai/features/lesson_planner/presentation/widgets/lesson_plan_result_view.dart';
import 'package:sahayakai/shared/widgets/document_sheet.dart';

import '../../support/app_harness.dart';
import '../../support/fake_api_client.dart';
import '../../support/fake_clipboard.dart';

/// U8 — the reference DocumentSheet result. A generated 5E plan reads as a
/// printed document, not a chat dump: a masthead, ticked section headers,
/// numbered activity medallions, and a Regenerate / Copy action bar. These
/// render a plain plan object — no network, no controller.
LessonPlan _plan() => const LessonPlan(
  title: 'Photosynthesis for Class 6',
  language: 'English',
  gradeLevel: 'Class 6',
  subject: 'Science',
  duration: '40 min',
  objectives: ['Explain how plants make food', 'Name the inputs and outputs'],
  keyVocabulary: [
    VocabularyTerm(term: 'Chlorophyll', meaning: 'The green pigment in leaves'),
  ],
  materials: ['Fresh leaves', 'Chart paper'],
  activities: [
    LessonActivity(
      phase: 'Engage',
      name: 'Observe a leaf',
      description: 'Look closely at a leaf held to the light.',
      duration: '5 min',
      teacherTips: 'Bring a few different leaves.',
      understandingCheck: 'Ask what colour the leaf is and why.',
    ),
    LessonActivity(
      phase: 'Explore',
      name: 'The sunlight test',
      description: 'Compare a shaded leaf with a sunlit one.',
    ),
  ],
  assessment: 'A short oral quiz on the process.',
  homework: 'Draw and label the photosynthesis cycle.',
  validationWarning: ValidationWarning(message: 'Simplified for the grade.'),
);

/// The same plan, plus the verbatim response body a live generation carries.
/// `LessonPlan.raw` is what a Save persists, so only a plan that has one offers
/// the Save action at all.
LessonPlan _generatedPlan() => LessonPlan(
  title: _plan().title,
  language: _plan().language,
  gradeLevel: _plan().gradeLevel,
  subject: _plan().subject,
  duration: _plan().duration,
  objectives: _plan().objectives,
  materials: _plan().materials,
  activities: _plan().activities,
  raw: const <String, dynamic>{
    'title': 'Photosynthesis for Class 6',
    'subject': 'Science',
    'objectives': ['Explain how plants make food'],
  },
);

const _request = LessonPlanRequest(
  topic: 'Photosynthesis',
  language: 'English',
  gradeLevels: ['Class 6'],
  subject: 'Science',
);

/// A [ShareService] that records instead of popping the real OS sheet, which a
/// widget test can neither drive nor dismiss.
class _FakeShareService extends ShareService {
  const _FakeShareService(this.calls);

  final List<({String text, String? subject})> calls;

  @override
  Future<void> shareText(String text, {String? subject}) async {
    calls.add((text: text, subject: subject));
  }
}

Widget _host(
  Widget child, {
  bool reduceMotion = false,
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (context) {
          final view = Scaffold(body: SingleChildScrollView(child: child));
          if (!reduceMotion) return view;
          return MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: true),
            child: view,
          );
        },
      ),
    ),
  );
}

void main() {
  setUp(() {});

  testWidgets('wraps the 5E plan in a DocumentSheet with masthead + sections', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(LessonPlanResultView(plan: _plan(), onRegenerate: () {})),
    );
    await tester.pumpAndSettle();

    expect(find.byType(DocumentSheet), findsOneWidget);
    // The masthead doc-type eyebrow (uppercased Latin) and the Fraunces title.
    expect(find.text('LESSON PLAN · 5E'), findsOneWidget);
    expect(find.text('Photosynthesis for Class 6'), findsOneWidget);
    // objectives, vocabulary, materials, activities, assessment, homework.
    expect(find.byType(DocumentSheetSection), findsNWidgets(6));
    // The activity medallions number the 5E steps.
    expect(find.text('1'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    // The model's prose is preserved verbatim.
    expect(
      find.text('Look closely at a leaf held to the light.'),
      findsOneWidget,
    );
  });

  testWidgets('the action bar offers Regenerate and Copy', (tester) async {
    var regenerated = false;
    await tester.pumpWidget(
      _host(
        LessonPlanResultView(
          plan: _plan(),
          onRegenerate: () => regenerated = true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Regenerate'), findsOneWidget);
    expect(find.text('Copy'), findsOneWidget);

    // The action bar is the foot of a long document; bring it into view first.
    await tester.ensureVisible(find.text('Regenerate'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Regenerate'));
    await tester.pump();
    expect(regenerated, isTrue, reason: 'Regenerate re-runs generation');
  });

  testWidgets('Copy writes the plan to the clipboard and confirms', (
    tester,
  ) async {
    // The platform clipboard channel is intercepted, so nothing reaches the
    // real pasteboard and what Copy wrote is assertable.
    final copied = interceptClipboard(tester);

    await tester.pumpWidget(
      _host(LessonPlanResultView(plan: _plan(), onRegenerate: () {})),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Copy'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Copy'));
    await tester.pumpAndSettle();

    expect(copied, hasLength(1));
    expect(
      (copied.single.arguments as Map)['text'],
      contains('Photosynthesis for Class 6'),
    );
    expect(find.text('Copied to clipboard'), findsOneWidget);
  });

  testWidgets('Share hands the plan text to the OS share sheet', (
    tester,
  ) async {
    // The dead end this unit exists to fix: a teacher who has just generated a
    // plan could copy it and nothing else. Share is what gets it to a colleague
    // on WhatsApp.
    final calls = <({String text, String? subject})>[];

    await tester.pumpWidget(
      _host(
        LessonPlanResultView(plan: _plan(), onRegenerate: () {}),
        overrides: [
          shareServiceProvider.overrideWithValue(_FakeShareService(calls)),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Share'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Share'));
    await tester.pumpAndSettle();

    expect(calls, hasLength(1));
    // The shared text is the plan as a document, not a widget dump.
    expect(calls.single.text, contains('Photosynthesis for Class 6'));
    expect(calls.single.text, contains('Explain how plants make food'));
    expect(calls.single.subject, 'Photosynthesis for Class 6');
  });

  group('save to library', () {
    testWidgets('a save request surfaces a Save that POSTs to content/save', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 2600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final client = FakeApiClient(
        postResponse: <String, dynamic>{'success': true, 'id': 'lp-9'},
      );

      await tester.pumpWidget(
        _host(
          LessonPlanResultView(
            plan: _generatedPlan(),
            onRegenerate: () {},
            saveRequest: _request,
          ),
          overrides: [apiClientOverride(client)],
        ),
      );
      await tester.pumpAndSettle();

      final save = find.text('Save to Library');
      expect(save, findsOneWidget);

      await tester.ensureVisible(save);
      await tester.pumpAndSettle();
      await tester.tap(save);
      await tester.pumpAndSettle();

      expect(client.posts.single.path, '/api/content/save');
      final body = client.posts.single.data! as Map;
      expect(body['type'], 'lesson-plan');
      expect(body['topic'], 'Photosynthesis');
      expect(body['gradeLevel'], 'Class 6');
      expect(body['language'], 'English');
      // The client mints the id the schema requires (`z.string().uuid()`).
      expect(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-'
          r'[0-9a-f]{12}$',
        ).hasMatch(body['id'] as String),
        isTrue,
        reason: 'a non-UUID id is rejected by the route with a 400',
      );
      // The stored payload is the model's own object, verbatim.
      expect((body['data'] as Map)['title'], 'Photosynthesis for Class 6');

      expect(find.text('Saved to your Library'), findsOneWidget);
    });

    testWidgets('a failed save reports the failure, never a saved tick', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 2600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      final client = FakeApiClient(postError: StateError('offline'));

      await tester.pumpWidget(
        _host(
          LessonPlanResultView(
            plan: _generatedPlan(),
            onRegenerate: () {},
            saveRequest: _request,
          ),
          overrides: [apiClientOverride(client)],
        ),
      );
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.text('Save to Library'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save to Library'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Could not save'), findsOneWidget);
      expect(find.text('Saved to your Library'), findsNothing);
    });

    testWidgets('no save request means no Save action', (tester) async {
      await tester.pumpWidget(
        _host(LessonPlanResultView(plan: _plan(), onRegenerate: () {})),
      );
      await tester.pumpAndSettle();

      expect(find.text('Save to Library'), findsNothing);
      expect(find.text('Copy'), findsOneWidget);
      expect(find.text('Share'), findsOneWidget);
    });

    testWidgets('a plan with no verbatim body offers no Save', (tester) async {
      // A plan re-rendered from the Library carries no `raw`. Saving it would
      // POST `data: null` — a row that looks saved and holds nothing.
      await tester.pumpWidget(
        _host(
          LessonPlanResultView(
            plan: _plan(),
            onRegenerate: () {},
            saveRequest: _request,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Save to Library'), findsNothing);
    });
  });

  testWidgets('reduce-motion renders the composed frame, no exception', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        LessonPlanResultView(plan: _plan(), onRegenerate: () {}),
        reduceMotion: true,
      ),
    );
    // No pumpAndSettle needed: with animations disabled the ink-settle blocks
    // are static, so the document is fully composed on the first frame.
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(find.byType(DocumentSheet), findsOneWidget);
    expect(find.text('Photosynthesis for Class 6'), findsOneWidget);
  });
}
