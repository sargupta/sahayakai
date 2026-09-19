import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/vidya/domain/deliverable.dart';
import 'package:sahayakai/features/vidya/presentation/deliver_tray.dart';
import 'package:sahayakai/features/vidya/presentation/deliverables_controller.dart';

/// The one deliver tray (v3 screen 08): the six destinations, the privacy
/// promise and Send all render; the Save destination runs the result's own
/// save seam and clears the deliverable from the orb's ready count.

Widget _host(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: AppTheme.light(),
      locale: const Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  testWidgets('renders the header, all six destinations, the note and Send', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        const DeliverTray(
          deliverable: Deliverable(
            id: 'x',
            title: 'Fractions in everyday cooking',
            text: 'the lesson text',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Header + six tiles.
    expect(find.text('Deliver'), findsOneWidget);
    expect(find.text('Parent group'), findsOneWidget);
    expect(find.text('Print'), findsOneWidget);
    expect(find.text('Save to class'), findsOneWidget);
    expect(find.text('Post to Community'), findsOneWidget);
    expect(find.text('Download PDF'), findsOneWidget);
    expect(find.text('Read aloud'), findsOneWidget);

    // The privacy promise and the Send CTA.
    expect(
      find.text('Nothing leaves the phone until you tap send.'),
      findsOneWidget,
    );
    expect(find.text('Send'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Save to class is disabled when the result cannot be saved', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        const DeliverTray(
          deliverable: Deliverable(id: 'x', title: 'T', text: 'body'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // No onSave → the Save tile renders but its InkWell is not tappable.
    final inkWell = tester.widget<InkWell>(
      find.ancestor(
        of: find.text('Save to class'),
        matching: find.byType(InkWell),
      ),
    );
    expect(inkWell.onTap, isNull);
  });

  testWidgets('Save to class runs the save seam and clears the deliverable', (
    tester,
  ) async {
    var saved = false;
    final deliverable = Deliverable(
      id: 'x',
      title: 'T',
      text: 'body',
      onSave: () async {
        saved = true;
        return 'content-1';
      },
    );

    late ProviderContainer container;
    await tester.pumpWidget(
      _host(
        Consumer(
          builder: (context, ref, _) {
            container = ProviderScope.containerOf(context);
            return DeliverTray(deliverable: deliverable);
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Seed the controller so the clear-on-deliver is observable.
    container.read(deliverablesControllerProvider.notifier).add(deliverable);
    expect(container.read(deliverablesControllerProvider), hasLength(1));

    await tester.tap(find.text('Save to class'));
    await tester.pumpAndSettle();

    expect(saved, isTrue);
    expect(container.read(deliverablesControllerProvider), isEmpty);
  });
}
