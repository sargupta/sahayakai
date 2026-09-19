import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';
import 'package:sahayakai/shared/widgets/tool_scaffold.dart';

/// The v3 screen 06 "working" affordance on the tool shell: while a generation
/// runs AND the tool offers a minimise, the busy button becomes
/// "Minimise to orb / Stop"; a tool that offers neither keeps the plain busy
/// button, so nothing changes for it.

AppLocalizations _en() => lookupAppLocalizations(const Locale('en'));

Future<AppLocalizations> _pump(
  WidgetTester tester, {
  required bool isBusy,
  VoidCallback? onSubmit,
  VoidCallback? onMinimise,
  VoidCallback? onStop,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: ToolScaffold(
        title: 'Tool',
        vidyaAction: false,
        isBusy: isBusy,
        submitLabel: 'Generate',
        onSubmit: onSubmit,
        onMinimise: onMinimise,
        onStop: onStop,
        child: const SizedBox(height: 40),
      ),
    ),
  );
  await tester.pump();
  return _en();
}

void main() {
  testWidgets('busy + minimisable shows Minimise to orb and Stop', (
    tester,
  ) async {
    final l10n = await _pump(
      tester,
      isBusy: true,
      onSubmit: null, // the screen withdraws submit while loading
      onMinimise: () {},
      onStop: () {},
    );

    expect(find.text(l10n.vidyaWorkingTitle), findsOneWidget);
    expect(find.text(l10n.vidyaWorkingMinimise), findsOneWidget);
    expect(find.text(l10n.vidyaWorkingStop), findsOneWidget);
  });

  testWidgets('Minimise and Stop fire their callbacks', (tester) async {
    var minimised = 0;
    var stopped = 0;
    final l10n = await _pump(
      tester,
      isBusy: true,
      onMinimise: () => minimised++,
      onStop: () => stopped++,
    );

    await tester.tap(find.text(l10n.vidyaWorkingMinimise));
    await tester.tap(find.text(l10n.vidyaWorkingStop));
    expect(minimised, 1);
    expect(stopped, 1);
  });

  testWidgets('a tool with no minimise keeps the plain busy button', (
    tester,
  ) async {
    final l10n = await _pump(
      tester,
      isBusy: true,
      onSubmit: () {},
      // no onMinimise
    );

    expect(find.byType(PrimaryButton), findsOneWidget);
    expect(find.text(l10n.vidyaWorkingMinimise), findsNothing);
  });

  testWidgets('idle + minimisable still shows the Generate button, not the bar', (
    tester,
  ) async {
    final l10n = await _pump(
      tester,
      isBusy: false,
      onSubmit: () {},
      onMinimise: () {},
      onStop: () {},
    );

    expect(find.text('Generate'), findsOneWidget);
    expect(find.text(l10n.vidyaWorkingMinimise), findsNothing);
  });
}
