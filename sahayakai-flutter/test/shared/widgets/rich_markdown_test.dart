import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/rich_markdown.dart';

/// WS2 — the shared math + markdown renderer. The worksheet flow is *instructed*
/// to emit all math as `$…$` / `$$…$$` LaTeX (worksheet-wizard rule 5), which the
/// old `AiText` printed raw. These pin that [RichMarkdown] TYPESETS it — the raw
/// dollar / caret / `\frac` source is consumed, not shown — that markdown emphasis
/// is consumed too, and that malformed input degrades to plain text rather than
/// crashing the result view.
Widget _host(String data) => MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(body: Center(child: RichMarkdown(data))),
    );

void main() {
  testWidgets(r'typesets inline $…$ math — the raw dollar markup never shows',
      (tester) async {
    await tester.pumpWidget(_host(r'The area is $x^2$ square units.'));
    await tester.pumpAndSettle();
    // The surrounding prose still renders...
    expect(find.textContaining('area'), findsWidgets);
    // ...but the math was parsed: neither the `$` delimiters nor the raw `^`
    // superscript operator survive as text (they exist only in un-typeset
    // LaTeX source — the exact markup the old plain-Text path leaked).
    expect(find.textContaining(r'$'), findsNothing);
    expect(find.textContaining('^'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(r'typesets block $$…$$ math', (tester) async {
    await tester.pumpWidget(_host(r'$$\frac{1}{2} + \frac{1}{3}$$'));
    await tester.pumpAndSettle();
    expect(find.textContaining(r'$'), findsNothing);
    // A typeset fraction has no literal "frac" text; raw markup would.
    expect(find.textContaining('frac'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('renders markdown prose (bold + list), emphasis markers consumed',
      (tester) async {
    await tester
        .pumpWidget(_host('**Photosynthesis** basics\n\n- leaf\n- root'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Photosynthesis'), findsWidgets);
    expect(find.textContaining('leaf'), findsWidgets);
    expect(find.textContaining('**'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('a malformed formula degrades to text, never crashes',
      (tester) async {
    await tester.pumpWidget(_host(r'Bad: $\notarealcommand{$ and more.'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.textContaining('more'), findsWidgets);
  });

  testWidgets('plain Indic prose renders unchanged, no crash', (tester) async {
    await tester.pumpWidget(_host('গাছপালা নিজের খাবার তৈরি করে।'));
    await tester.pumpAndSettle();
    expect(find.textContaining('গাছপালা'), findsWidgets);
    expect(tester.takeException(), isNull);
  });
}
