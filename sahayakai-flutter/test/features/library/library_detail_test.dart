import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/library/presentation/library_detail_screen.dart';
import 'package:sahayakai/shared/data/library_repository.dart';
import 'package:sahayakai/shared/domain/library_item.dart';
import 'package:sahayakai/shared/widgets/error_view.dart';
import 'package:sahayakai/shared/widgets/offline_view.dart';
import 'package:sahayakai/shared/widgets/secondary_button.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../dashboard/dashboard_fixtures.dart';
import '../exam_paper/exam_paper_fixtures.dart' show examPaperJson;
import '../onboarding/onboarding_fixtures.dart' show pumpSignedInApp;

/// P1.7 — opening a saved item (`GET /api/content/get?id=<id>`).
///
/// The endpoint is real and now wired, but Firebase-gated exactly like the list
/// (stub auth 401s), so the screen is BUILT-PENDING-FIREBASE: it shows the item's
/// metadata plus a clear "sign in to open" state at runtime, and its data state
/// is reachable here (and once the token lands) through the fake client.

/// A 404 from the per-item read — the item was deleted or its soft-delete TTL
/// elapsed.
const ApiException _kNotFound = ApiException(
  ApiErrorKind.notFound,
  'Not found.',
  statusCode: 404,
);

/// Boots the library, then taps a row to open its detail. [client] holds the
/// list; [itemResponse] / [itemError] answer the per-item read that fires on the
/// tap.
Future<void> _openDetail(
  WidgetTester tester, {
  required FakeApiClient client,
  Object? itemResponse,
  Object? itemError,
  String rowText = 'Photosynthesis for Class 6',
  Brightness? brightness,
  double textScale = 1.0,
  Locale? locale,
  Size surface = kTallSurface,
}) async {
  // NEW IA (U-V5): reach the Library tab from the VIDYA-home shell, then open a
  // saved item's detail — the dashboard is no longer the landing.
  await pumpSignedInApp(
    tester,
    client: client,
    brightness: brightness,
    textScale: textScale,
    locale: locale,
    surface: surface,
  );
  // Tap the Library tab by its icon, not the English label: the app now honours
  // the device locale (LocaleController seeds from it), so in bn/ta/ml the nav
  // reads the translated `navLibrary` and a `find.text('Library')` would miss.
  await tester.tap(find.byIcon(LucideIcons.library));
  await tester.pumpAndSettle();

  // The list has loaded; now answer the per-item GET.
  if (itemError != null) client.error = itemError;
  if (itemResponse != null) client.getResponse = itemResponse;

  final row = find.text(rowText).first;
  await tester.ensureVisible(row);
  await tester.pumpAndSettle();
  await tester.tap(row);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('LibraryRepository.fetchItem', () {
    test('reads GET /api/content/get with the id', () async {
      final client = FakeApiClient(getResponse: contentItem());
      final item = await LibraryRepository(client).fetchItem('abc123');

      expect(client.gets.single.path, '/api/content/get');
      expect(client.gets.single.query, <String, dynamic>{'id': 'abc123'});
      expect(item.id, '3f2a1b4c-0000-4000-8000-000000000001');
      expect(item.type, ContentType.lessonPlan);
      expect(item.title, 'Photosynthesis for Class 6');
    });

    test('a 401 propagates as the typed exception the UI branches on', () {
      final client = FakeApiClient(error: kUnauthorized);
      expect(
        () => LibraryRepository(client).fetchItem('abc123'),
        throwsA(same(kUnauthorized)),
      );
    });

    test('a 404 propagates as notFound', () {
      final client = FakeApiClient(error: _kNotFound);
      expect(
        () => LibraryRepository(client).fetchItem('gone'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.kind,
            'kind',
            ApiErrorKind.notFound,
          ),
        ),
      );
    });

    test('a non-object body is a typed error, not an empty item', () {
      // A proxy or an error page on a 200: for a single item this is a failure
      // to open it, unlike the list where an empty list is the better answer.
      final client = FakeApiClient(getResponse: 'not json');
      expect(
        () => LibraryRepository(client).fetchItem('abc123'),
        throwsA(
          isA<ApiException>().having(
            (e) => e.kind,
            'kind',
            ApiErrorKind.badResponse,
          ),
        ),
      );
    });
  });

  group('detail screen', () {
    testWidgets('renders the item metadata from the tapped row', (
      tester,
    ) async {
      await _openDetail(
        tester,
        client: libraryClient(),
        itemResponse: contentItem(),
      );

      expect(find.byType(LibraryDetailScreen), findsOneWidget);
      // The type label, and the metadata the item carries.
      expect(find.text('Lesson plan'), findsOneWidget);
      expect(find.text('Class 6'), findsOneWidget);
      expect(find.text('Science'), findsOneWidget);
      expect(find.text('Photosynthesis'), findsOneWidget);
    });

    testWidgets('a successful read confirms the opened item', (tester) async {
      await _openDetail(
        tester,
        client: libraryClient(),
        itemResponse: contentItem(),
      );

      expect(
        find.text('You are viewing your saved Lesson plan.'),
        findsOneWidget,
      );
    });

    testWidgets(
      'T1-U2: a saved lesson plan renders through its own result view, '
      'not the bare "Ready" checkmark',
      (tester) async {
        await _openDetail(
          tester,
          client: libraryClient(),
          itemResponse: contentItem(
            overrides: {
              'data': {
                'title': 'Photosynthesis for Class 6',
                'gradeLevel': 'Class 6',
                'subject': 'Science',
                'objectives': ['Explain how plants make food'],
                'materials': ['Leaves', 'Sunlight'],
                'activities': [
                  {
                    'phase': 'Engage',
                    'name': 'Leaf walk',
                    'description': 'Collect leaves from the schoolyard.',
                    'duration': '10 minutes',
                  },
                ],
              },
            },
          ),
        );

        // The actual saved content is now on screen...
        expect(find.text('Explain how plants make food'), findsOneWidget);
        expect(find.text('Leaf walk'), findsOneWidget);
        // ...instead of the old placeholder.
        expect(
          find.text('You are viewing your saved Lesson plan.'),
          findsNothing,
        );
      },
    );

    testWidgets(
      'T1-U2: a saved worksheet dispatches on the fetched type, not the '
      "row's",
      (tester) async {
        final worksheetData = {
          'title': 'Fractions Worksheet',
          'gradeLevel': 'Class 5',
          'subject': 'Mathematics',
          'learningObjectives': ['Add fractions with unlike denominators'],
          'studentInstructions': 'Solve each problem and show your work.',
          'activities': [
            {
              'type': 'question',
              'content': 'What is 1/2 + 1/4?',
              'explanation': 'Find a common denominator first.',
            },
          ],
          'answerKey': [
            {'activityIndex': 0, 'answer': '3/4'},
          ],
          // A legacy markdown field real saved worksheets also carry — must be
          // ignored in favour of the structured fields above.
          'worksheetContent': '# Fractions Worksheet\n\nignored',
        };
        await _openDetail(
          tester,
          client: libraryClient(
            response: contentListResponse(
              items: [
                contentItem(
                  overrides: {
                    'type': 'worksheet',
                    'title': 'Fractions Worksheet',
                  },
                ),
              ],
            ),
          ),
          rowText: 'Fractions Worksheet',
          itemResponse: contentItem(
            overrides: {
              'type': 'worksheet',
              'title': 'Fractions Worksheet',
              'data': worksheetData,
            },
          ),
        );

        expect(find.text('What is 1/2 + 1/4?'), findsOneWidget);
        expect(find.textContaining('ignored'), findsNothing);
      },
    );

    testWidgets(
      'T1-U2: a saved item with no data payload keeps the honest "Ready" '
      'state',
      (tester) async {
        // A document that predates the `data` field, or a content type with no
        // mobile tool screen yet — either way this must never guess.
        await _openDetail(
          tester,
          client: libraryClient(),
          itemResponse: contentItem(),
        );

        expect(
          find.text('You are viewing your saved Lesson plan.'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'T1-U2: a saved item whose data cannot decode falls back to "Ready" '
      'rather than rendering garbage',
      (tester) async {
        await _openDetail(
          tester,
          client: libraryClient(),
          itemResponse: contentItem(
            overrides: {
              // A lesson-plan type whose `data` is structurally foreign (an
              // array, not an object) — must never crash or half-render.
              'data': ['not', 'an', 'object'],
            },
          ),
        );

        expect(
          find.text('You are viewing your saved Lesson plan.'),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'money bug: a saved exam paper opened from Library has no working '
      'Save button (re-saving would PUT a duplicate and burn quota)',
      (tester) async {
        await _openDetail(
          tester,
          client: libraryClient(
            response: contentListResponse(
              items: [
                contentItem(
                  overrides: {'type': 'exam-paper', 'title': 'CBSE Exam Paper'},
                ),
              ],
            ),
          ),
          rowText: 'CBSE Exam Paper',
          itemResponse: contentItem(
            overrides: {
              'type': 'exam-paper',
              'title': 'CBSE Exam Paper',
              'data': examPaperJson(),
            },
          ),
        );

        // The saved paper renders through its own result view (proof the
        // mapper + result view are wired) ...
        expect(find.text('Section A'), findsOneWidget);
        // ... but there must be no live Save action: a saved item re-opened
        // read-only from Library has no generate controller behind it, so
        // tapping Save here would PUT a byte-for-byte duplicate to the library
        // and burn a real quota unit for nothing.
        expect(find.text('Save to Library'), findsNothing);
        expect(find.text('Saving'), findsNothing);
      },
    );

    testWidgets('T2-U11: a saved assessment-submission renders through its own '
        'scanner result view, not the bare "Ready" checkmark', (tester) async {
      final assessmentData = {
        'assessmentId': 'a1b2c3d4-0000-4000-8000-000000000001',
        'status': 'graded',
        'pageCount': 1,
        'totalAwardedMarks': 8,
        'totalMaxMarks': 10,
        'scorePct': 80,
        'letterGrade': 'A',
        'questions': [
          {
            'questionId': 'p0-q1',
            'pageIndex': 0,
            'questionText': 'What is 2 + 2?',
            'studentAnswer': '4',
            'expectedAnswer': '4',
            'marksAwarded': 4,
            'marksMax': 4,
            'partialCreditBreakdown': [],
            'feedback': 'Correct.',
            'studentFacingFeedback': 'Well done!',
            'conceptTested': 'Addition',
            'ncertChapterId': null,
            'mistakePattern': 'none',
            'needsTeacherReview': false,
            'confidence': 0.95,
          },
        ],
        'recommendedNextSteps': ['Practice subtraction next.'],
        'studentRecommendations': ['Review addition facts.'],
        'needsReviewCount': 0,
        'imageQualityWarnings': [],
      };

      await _openDetail(
        tester,
        client: libraryClient(
          response: contentListResponse(
            items: [
              contentItem(
                overrides: {
                  'type': 'assessment-submission',
                  'title': 'Assessment: Mathematics Class 6 (80%)',
                },
              ),
            ],
          ),
        ),
        rowText: 'Assessment: Mathematics Class 6 (80%)',
        itemResponse: contentItem(
          overrides: {
            'type': 'assessment-submission',
            'title': 'Assessment: Mathematics Class 6 (80%)',
            'data': assessmentData,
          },
        ),
      );

      expect(find.text('What is 2 + 2?'), findsOneWidget);
      expect(
        find.text('You are viewing your saved Scanned assessment.'),
        findsNothing,
      );
    });

    testWidgets(
      'T2-U11: a saved visual-aid keeps the honest "Ready" state — the '
      'real saved shape has no imageDataUri to render',
      (tester) async {
        final visualAidData = {
          'pedagogicalContext': 'Use this to explain the water cycle.',
          'discussionSpark': 'Where does the rain go after it falls?',
          'subject': 'Science',
          'storageRef': 'users/u1/visual-aids/20260715_water_cycle.png',
        };

        await _openDetail(
          tester,
          client: libraryClient(
            response: contentListResponse(
              items: [
                contentItem(
                  overrides: {'type': 'visual-aid', 'title': 'The Water Cycle'},
                ),
              ],
            ),
          ),
          rowText: 'The Water Cycle',
          itemResponse: contentItem(
            overrides: {
              'type': 'visual-aid',
              'title': 'The Water Cycle',
              'data': visualAidData,
            },
          ),
        );

        expect(
          find.text('You are viewing your saved Visual aid.'),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'no identity asks for sign-in, with no retry that cannot work',
      (tester) async {
        await _openDetail(
          tester,
          client: libraryClient(),
          itemError: kUnauthorized,
        );

        expect(find.byType(LibraryDetailScreen), findsOneWidget);
        expect(find.text('Sign in to open your saved work.'), findsOneWidget);
        expect(find.text('Try again'), findsNothing);
        // Same dead-end fix as the list: the signed-out detail now offers a
        // working "Sign in" action rather than an actionless message.
        expect(find.widgetWithText(SecondaryButton, 'Sign in'), findsOneWidget);
      },
    );

    testWidgets('offline gets its own copy and a retry', (tester) async {
      await _openDetail(tester, client: libraryClient(), itemError: kOffline);

      expect(find.byType(OfflineView), findsOneWidget);
      expect(find.byType(ErrorView), findsNothing);
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('a retry re-reads and recovers', (tester) async {
      final client = libraryClient();
      await _openDetail(tester, client: client, itemError: kOffline);
      expect(find.byType(OfflineView), findsOneWidget);

      // The connection comes back between the failure and the retry.
      client.error = null;
      client.getResponse = contentItem();
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();

      expect(find.byType(OfflineView), findsNothing);
      expect(
        find.text('You are viewing your saved Lesson plan.'),
        findsOneWidget,
      );
    });

    testWidgets('a deleted item says so, and offers no dead retry', (
      tester,
    ) async {
      await _openDetail(tester, client: libraryClient(), itemError: _kNotFound);

      expect(
        find.text('This item is no longer in your library.'),
        findsOneWidget,
      );
      expect(find.text('Try again'), findsNothing);
    });

    testWidgets('a server error offers a retry, with no raw exception', (
      tester,
    ) async {
      await _openDetail(
        tester,
        client: libraryClient(),
        itemError: kServerError,
      );

      expect(find.byType(ErrorView), findsOneWidget);
      expect(
        find.text('We could not open this saved item. Please try again.'),
        findsOneWidget,
      );
      expect(find.textContaining('our side'), findsNothing);
    });
  });

  group('detail overflow gates (DESIGN_RUBRIC §12.9 / §12.10 / §12.11)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          await _openDetail(
            tester,
            brightness: brightness,
            textScale: 1.3,
            surface: kNarrowPhone,
            // A long compound word stresses the header title wrap.
            client: libraryClient(
              response: contentListResponse(
                items: [
                  contentItem(overrides: {'title': kLongWord}),
                ],
              ),
            ),
            rowText: kLongWord,
            itemResponse: contentItem(overrides: {'title': kLongWord}),
          );

          expect(tester.takeException(), isNull);
          expect(find.byType(LibraryDetailScreen), findsOneWidget);
        },
      );
    }

    for (final locale in const [Locale('bn'), Locale('ta'), Locale('ml')]) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${locale.languageCode}',
        (tester) async {
          await _openDetail(
            tester,
            locale: locale,
            textScale: 1.3,
            surface: kNarrowPhone,
            client: libraryClient(
              response: contentListResponse(
                items: [
                  contentItem(overrides: {'title': kTa}),
                ],
              ),
            ),
            rowText: kTa,
            itemResponse: contentItem(overrides: {'title': kTa}),
          );

          expect(tester.takeException(), isNull);
          expect(find.byType(LibraryDetailScreen), findsOneWidget);
        },
      );
    }
  });
}
