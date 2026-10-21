import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/platform/share_service.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/result_actions_bar.dart';

import '../../support/fake_clipboard.dart';

/// Gates for the shared result action bar — the one surface that turns a
/// generated document from something a teacher can only look at into something
/// they can send to a colleague or keep.
///
/// The three actions are tested for the paths that actually hurt: a share sheet
/// that cannot open must not throw over the document, and a save that did not
/// land must never read as one that did.

/// Records what it was asked to share instead of popping the real OS sheet,
/// which a widget test can neither drive nor dismiss. [throws] models the sheet
/// failing to open at all (no handler, an unsupported platform, a channel
/// error).
class _FakeShareService extends ShareService {
  const _FakeShareService(this.calls, {this.throws = false});

  final List<({String text, String? subject})> calls;
  final bool throws;

  @override
  Future<void> shareText(String text, {String? subject}) async {
    calls.add((text: text, subject: subject));
    if (throws) throw StateError('no share handler');
  }
}

Widget _host(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: SingleChildScrollView(
          padding: AppSpacing.pagePadding,
          child: child,
        ),
      ),
    ),
  );
}

void main() {
  group('copy', () {
    testWidgets('writes the text and confirms', (tester) async {
      final copied = interceptClipboard(tester);

      await tester.pumpWidget(
        _host(const ResultActionsBar(text: 'The lesson plan, as text.')),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Copy'));
      await tester.pumpAndSettle();

      expect(copied, hasLength(1));
      expect(
        (copied.single.arguments as Map)['text'],
        'The lesson plan, as text.',
      );
      expect(find.text('Copied to clipboard'), findsOneWidget);
    });
  });

  group('share', () {
    testWidgets('hands the exact text and subject to the share service', (
      tester,
    ) async {
      final calls = <({String text, String? subject})>[];

      await tester.pumpWidget(
        _host(
          const ResultActionsBar(
            text: 'The lesson plan, as text.',
            shareSubject: 'Photosynthesis for Class 6',
          ),
          overrides: [
            shareServiceProvider.overrideWithValue(_FakeShareService(calls)),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Share'));
      await tester.pumpAndSettle();

      expect(calls, hasLength(1));
      expect(calls.single.text, 'The lesson plan, as text.');
      expect(calls.single.subject, 'Photosynthesis for Class 6');
    });

    testWidgets(
      'a sheet that cannot open degrades to the clipboard and says so, '
      'rather than throwing over the document',
      (tester) async {
        final calls = <({String text, String? subject})>[];
        final copied = interceptClipboard(tester);

        await tester.pumpWidget(
          _host(
            const ResultActionsBar(text: 'The lesson plan, as text.'),
            overrides: [
              shareServiceProvider.overrideWithValue(
                _FakeShareService(calls, throws: true),
              ),
            ],
          ),
        );
        await tester.pumpAndSettle();

        await tester.tap(find.text('Share'));
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        // The text is not lost: it lands on the clipboard instead.
        expect(copied, hasLength(1));
        expect(
          find.text(
            'Could not share. The text has been copied to your clipboard '
            'instead.',
          ),
          findsOneWidget,
        );
      },
    );
  });

  group('save to library', () {
    testWidgets('no onSave means no Save action at all', (tester) async {
      await tester.pumpWidget(
        _host(const ResultActionsBar(text: 'The lesson plan, as text.')),
      );
      await tester.pumpAndSettle();

      expect(find.text('Save to Library'), findsNothing);
      expect(find.text('Copy'), findsOneWidget);
      expect(find.text('Share'), findsOneWidget);
    });

    testWidgets('a returned content id confirms the save', (tester) async {
      var calls = 0;

      await tester.pumpWidget(
        _host(
          ResultActionsBar(
            text: 'The lesson plan, as text.',
            onSave: () async {
              calls += 1;
              return 'content-1';
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Save to Library'));
      await tester.pumpAndSettle();

      expect(calls, 1);
      expect(find.text('Saved to your Library'), findsOneWidget);
      expect(find.text('Save to Library'), findsNothing);
    });

    testWidgets('a thrown save shows the failure and a retry, never the tick', (
      tester,
    ) async {
      var fail = true;

      await tester.pumpWidget(
        _host(
          ResultActionsBar(
            text: 'The lesson plan, as text.',
            onSave: () async {
              if (fail) throw StateError('offline');
              return 'content-1';
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Save to Library'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Could not save'), findsOneWidget);
      expect(find.text('Try saving again'), findsOneWidget);
      expect(find.text('Saved to your Library'), findsNothing);

      // The retry is real: a save that works the second time lands.
      fail = false;
      await tester.tap(find.text('Try saving again'));
      await tester.pumpAndSettle();

      expect(find.text('Saved to your Library'), findsOneWidget);
    });

    testWidgets('a 200 carrying no id is a failure, not a success', (
      tester,
    ) async {
      // The route echoes the id it stored. Nothing back means nothing stored —
      // the money bug this bar exists to avoid is a green tick over an empty
      // library.
      await tester.pumpWidget(
        _host(
          ResultActionsBar(
            text: 'The lesson plan, as text.',
            onSave: () async => '   ',
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Save to Library'));
      await tester.pumpAndSettle();

      expect(find.text('Could not save'), findsOneWidget);
      expect(find.text('Saved to your Library'), findsNothing);
    });

    testWidgets('a new result clears the previous "Saved" confirmation', (
      tester,
    ) async {
      Widget bar(Object key) => _host(
        ResultActionsBar(
          text: 'The lesson plan, as text.',
          saveResetKey: key,
          onSave: () async => 'content-1',
        ),
      );

      await tester.pumpWidget(bar('plan-1'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Save to Library'));
      await tester.pumpAndSettle();
      expect(find.text('Saved to your Library'), findsOneWidget);

      // A regeneration replaces the rendered result. The new plan has NOT been
      // saved, so the badge must not carry over onto it.
      await tester.pumpWidget(bar('plan-2'));
      await tester.pumpAndSettle();

      expect(find.text('Saved to your Library'), findsNothing);
      expect(find.text('Save to Library'), findsOneWidget);
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10)', () {
    for (final brightness in Brightness.values) {
      testWidgets(
        'no overflow at 360dp x textScale 1.3 in ${brightness.name}',
        (tester) async {
          tester.view.physicalSize = const Size(360, 900);
          tester.view.devicePixelRatio = 1.0;
          addTearDown(tester.view.reset);

          await tester.pumpWidget(
            ProviderScope(
              child: MaterialApp(
                theme: brightness == Brightness.dark
                    ? AppTheme.dark()
                    : AppTheme.light(),
                locale: const Locale('en'),
                localizationsDelegates: AppLocalizations.localizationsDelegates,
                supportedLocales: AppLocalizations.supportedLocales,
                home: MediaQuery(
                  data: const MediaQueryData(
                    textScaler: TextScaler.linear(1.3),
                  ),
                  child: Scaffold(
                    body: SingleChildScrollView(
                      padding: AppSpacing.pagePadding,
                      child: ResultActionsBar(
                        text: 'The lesson plan, as text.',
                        onSave: () async => 'content-1',
                      ),
                    ),
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();

          expect(tester.takeException(), isNull);
        },
      );
    }
  });
}
