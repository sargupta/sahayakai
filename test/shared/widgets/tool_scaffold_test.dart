import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/vidya/domain/deliverable.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_presence.dart';
import 'package:sahayakai/shared/widgets/primary_button.dart';
import 'package:sahayakai/shared/widgets/tool_scaffold.dart';

/// The v3 screen 06 "working" affordance on the tool shell: while a generation
/// runs AND the tool offers a minimise, the busy button becomes
/// "Minimise to orb / Stop"; a tool that offers neither keeps the plain busy
/// button, so nothing changes for it. And the Output screen (UX map Flow 4):
/// a finished result replaces the form, with Edit back to it and Deliver as
/// the one primary action.

AppLocalizations _en() => lookupAppLocalizations(const Locale('en'));

Future<AppLocalizations> _pump(
  WidgetTester tester, {
  required bool isBusy,
  VoidCallback? onSubmit,
  VoidCallback? onMinimise,
  VoidCallback? onStop,
  bool hasResult = false,
  VoidCallback? onResubmit,
  Deliverable? deliverable,
  ProviderContainer? container,
}) async {
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container ?? ProviderContainer(),
      child: MaterialApp(
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
          hasResult: hasResult,
          onResubmit: onResubmit,
          deliverable: deliverable,
          result: const Text('the result'),
          child: const Text('the form'),
        ),
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

  testWidgets(
    'idle + minimisable still shows the Generate button, not the bar',
    (tester) async {
      final l10n = await _pump(
        tester,
        isBusy: false,
        onSubmit: () {},
        onMinimise: () {},
        onStop: () {},
      );

      expect(find.text('Generate'), findsOneWidget);
      expect(find.text(l10n.vidyaWorkingMinimise), findsNothing);
    },
  );

  group('Output screen', () {
    const plan = Deliverable(
      id: 'lesson-1',
      title: 'Fractions',
      text: 'Hook · Activity · Board work',
    );

    testWidgets('a finished result replaces the form', (tester) async {
      await _pump(tester, isBusy: false, hasResult: true, onResubmit: () {});

      expect(find.text('the result'), findsOneWidget);
      expect(find.text('the form'), findsNothing);
      expect(find.text('Generate'), findsNothing);
    });

    testWidgets('Edit brings the form back and keeps the result', (
      tester,
    ) async {
      var resubmits = 0;
      final l10n = await _pump(
        tester,
        isBusy: false,
        hasResult: true,
        onResubmit: () => resubmits++,
      );

      await tester.tap(find.text(l10n.outputEdit));
      await tester.pump();

      // The form is back with its own Generate; the result is only hidden.
      expect(find.text('the form'), findsOneWidget);
      expect(find.text('the result'), findsNothing);
      expect(
        find.text('the result', skipOffstage: false),
        findsOneWidget,
        reason: 'Edit must never throw the generated result away',
      );
      await tester.tap(find.text('Generate'));
      expect(resubmits, 1);

      // Back to result returns to it untouched, without regenerating.
      await tester.tap(find.text(l10n.outputBackToResult));
      await tester.pump();
      expect(find.text('the result'), findsOneWidget);
      expect(find.text('the form'), findsNothing);
      expect(resubmits, 1);
    });

    testWidgets('no resubmit means no Edit on the Output screen', (
      tester,
    ) async {
      final l10n = await _pump(tester, isBusy: false, hasResult: true);

      expect(find.text(l10n.outputEdit), findsNothing);
    });

    testWidgets('Deliver is the primary action and the orb counts the result', (
      tester,
    ) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final l10n = await _pump(
        tester,
        isBusy: false,
        hasResult: true,
        deliverable: plan,
        container: container,
      );
      await tester.pump();

      expect(find.text(l10n.deliverTrayTitle), findsOneWidget);
      expect(container.read(visibleDeliverableProvider)?.id, 'lesson-1');
      expect(container.read(vidyaReadyCountProvider), 1);

      // Leaving the screen clears it, so no stale badge rides on.
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(home: SizedBox()),
        ),
      );
      await tester.pump();
      expect(container.read(visibleDeliverableProvider), isNull);
    });

    testWidgets('a regeneration in flight shows the form, not the output', (
      tester,
    ) async {
      await _pump(
        tester,
        isBusy: true,
        hasResult: true,
        onSubmit: null,
        onMinimise: () {},
      );

      expect(find.text('the form'), findsOneWidget);
    });
  });
}
