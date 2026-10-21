import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/note_banner.dart';

/// The ONE tinted "note" panel. Pins its contract after the three divergent
/// implementations (bordered banner, borderless sub-note, rLg assess variant)
/// were folded into it: a single tinted, rounded, bordered container carrying
/// an optional glyph, an optional label, and a body.
void main() {
  Widget host(Widget child, {Brightness brightness = Brightness.light}) {
    return MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      home: Scaffold(
        body: SingleChildScrollView(
          padding: AppSpacing.pagePadding,
          child: child,
        ),
      ),
    );
  }

  /// The single tinted-panel container the widget must resolve to.
  BoxDecoration decorationOf(WidgetTester tester) {
    final container = tester.widget<Container>(
      find
          .ancestor(of: find.text('Tip'), matching: find.byType(Container))
          .first,
    );
    return container.decoration! as BoxDecoration;
  }

  testWidgets('renders the label, body and leading glyph', (tester) async {
    await tester.pumpWidget(
      host(
        const NoteBanner(
          icon: LucideIcons.lightbulb,
          label: 'Tip',
          body: 'Read the question aloud first.',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Tip'), findsOneWidget);
    expect(find.text('Read the question aloud first.'), findsOneWidget);
    expect(find.byIcon(LucideIcons.lightbulb), findsOneWidget);

    // The one panel grammar: tinted fill, rounded, single 1dp outline.
    final decoration = decorationOf(tester);
    expect(decoration.borderRadius, AppRadius.rMd);
    expect(decoration.border, isA<Border>());
  });

  testWidgets('omits the glyph when no icon is given', (tester) async {
    await tester.pumpWidget(
      host(const NoteBanner(label: 'Tip', body: 'No glyph here.')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Tip'), findsOneWidget);
    expect(find.byType(Icon), findsNothing);
  });

  testWidgets('custom renders an arbitrary body child under the label', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        const NoteBanner.custom(
          icon: LucideIcons.alertTriangle,
          label: 'Tip',
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [Text('one'), Text('two')],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Tip'), findsOneWidget);
    expect(find.text('one'), findsOneWidget);
    expect(find.text('two'), findsOneWidget);
    expect(find.byIcon(LucideIcons.alertTriangle), findsOneWidget);
  });

  testWidgets(
    'renders at 360dp, textScale 1.3, light and dark without overflow',
    (tester) async {
      for (final brightness in Brightness.values) {
        tester.view.physicalSize = const Size(360, 900);
        tester.view.devicePixelRatio = 1.0;
        addTearDown(tester.view.reset);

        await tester.pumpWidget(
          MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(1.3)),
            child: host(
              const NoteBanner(
                icon: LucideIcons.lightbulb,
                label:
                    'A deliberately long note label that should wrap cleanly',
                body:
                    'Supercalifragilisticexpialidociousphotosynthesisword body.',
              ),
              brightness: brightness,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull, reason: brightness.name);
      }
    },
  );
}
