import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/settings/presentation/widgets/delete_account_dialog.dart';

import 'settings_fixtures.dart';

/// The interlock, at the widget level: the confirm button must be physically
/// un-tappable until the exact word is typed. `settings_domain_test.dart` pins
/// the matching rule; this pins that the BUTTON is actually wired to it.

/// A realistic host: the dialog is opened through its own `show()` from a
/// button, so `Navigator.pop` has a route to pop and the returned value is the
/// real one.
class _Harness extends StatefulWidget {
  const _Harness();

  @override
  State<_Harness> createState() => _HarnessState();
}

class _HarnessState extends State<_Harness> {
  bool? result;
  bool opened = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ElevatedButton(
              onPressed: () async {
                final value = await DeleteAccountDialog.show(context);
                setState(() {
                  result = value;
                  opened = true;
                });
              },
              child: const Text('open'),
            ),
            if (opened) Text('result:$result'),
          ],
        ),
      ),
    );
  }
}

/// The confirm button, found by its label inside the dialog.
Finder _confirmButton() => find.ancestor(
      of: find.text('Delete account'),
      matching: find.byType(FilledButton),
    );

bool _isEnabled(WidgetTester tester) =>
    tester.widget<FilledButton>(_confirmButton()).onPressed != null;

Future<void> _openDialog(WidgetTester tester) async {
  await tester.pumpWidget(hostSettings(const _Harness()));
  await tester.pumpAndSettle();
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  group('confirm gating', () {
    testWidgets('confirm is disabled when the field is empty', (tester) async {
      await _openDialog(tester);
      expect(find.text('Delete your account?'), findsOneWidget);
      expect(_isEnabled(tester), isFalse);
    });

    testWidgets('typing exactly DELETE enables confirm', (tester) async {
      await _openDialog(tester);
      await tester.enterText(find.byType(TextField), 'DELETE');
      await tester.pumpAndSettle();
      expect(_isEnabled(tester), isTrue);
    });

    testWidgets('a wrong string does NOT enable confirm', (tester) async {
      // The core safety assertion. Each of these must leave the button locked.
      for (final wrong in <String>[
        'delete',
        'Delete',
        'DELET',
        'DELETES',
        'DELETE ME',
        'REMOVE',
        'x',
      ]) {
        await _openDialog(tester);
        await tester.enterText(find.byType(TextField), wrong);
        await tester.pumpAndSettle();
        expect(
          _isEnabled(tester),
          isFalse,
          reason: 'typing "$wrong" must not enable the confirm button',
        );
        // Close and rebuild for the next candidate.
        await tester.tap(find.text('Keep my account'));
        await tester.pumpAndSettle();
      }
    });

    testWidgets('correcting a wrong string re-locks the button', (tester) async {
      await _openDialog(tester);
      await tester.enterText(find.byType(TextField), 'DELETE');
      await tester.pumpAndSettle();
      expect(_isEnabled(tester), isTrue);

      // Backspacing past the word must lock it again, not latch open.
      await tester.enterText(find.byType(TextField), 'DELET');
      await tester.pumpAndSettle();
      expect(_isEnabled(tester), isFalse);
    });
  });

  group('outcomes', () {
    testWidgets('confirming returns true', (tester) async {
      await _openDialog(tester);
      await tester.enterText(find.byType(TextField), 'DELETE');
      await tester.pumpAndSettle();
      await tester.tap(_confirmButton());
      await tester.pumpAndSettle();
      expect(find.text('result:true'), findsOneWidget);
    });

    testWidgets('cancelling returns null, even with the word typed',
        (tester) async {
      await _openDialog(tester);
      await tester.enterText(find.byType(TextField), 'DELETE');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Keep my account'));
      await tester.pumpAndSettle();
      expect(find.text('result:null'), findsOneWidget);
    });

    testWidgets('the confirm button is error-coloured and >=48dp',
        (tester) async {
      await _openDialog(tester);
      await tester.enterText(find.byType(TextField), 'DELETE');
      await tester.pumpAndSettle();

      final scheme = AppThemeProbe.of(tester);
      final style = tester.widget<FilledButton>(_confirmButton()).style!;
      expect(
        style.backgroundColor!.resolve(<WidgetState>{}),
        scheme.error,
        reason: 'destructive confirm must read as destructive',
      );
      expect(tester.getSize(_confirmButton()).height, greaterThanOrEqualTo(48));
    });
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final scale in <double>[1.0, 1.3]) {
        testWidgets(
          'dialog renders at 360dp, textScale $scale, ${brightness.name}',
          (tester) async {
            tester.view.physicalSize = kNarrowPhone;
            tester.view.devicePixelRatio = 1.0;
            addTearDown(tester.view.reset);

            await tester.pumpWidget(
              hostSettings(
                const _Harness(),
                brightness: brightness,
                textScale: scale,
              ),
            );
            await tester.pumpAndSettle();
            await tester.tap(find.text('open'));
            await tester.pumpAndSettle();

            expect(tester.takeException(), isNull);
            expect(find.text('Delete your account?'), findsOneWidget);
            expect(_confirmButton(), findsOneWidget);
          },
        );
      }
    }

    testWidgets('renders in Bengali at textScale 1.3 without overflow',
        (tester) async {
      tester.view.physicalSize = kNarrowPhone;
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        hostSettings(
          const _Harness(),
          textScale: 1.3,
          locale: const Locale('bn'),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}

/// Reads the live ColorScheme out of the pumped tree, so colour assertions
/// track the theme instead of hardcoding hexes.
class AppThemeProbe {
  static ColorScheme of(WidgetTester tester) {
    final context = tester.element(find.byType(FilledButton).first);
    return Theme.of(context).colorScheme;
  }
}
