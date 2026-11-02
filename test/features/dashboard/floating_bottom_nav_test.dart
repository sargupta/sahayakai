import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/dashboard/presentation/floating_bottom_nav.dart';

/// The floating tab bar, drawn to the UX map's `tabbar`: four tabs, the active
/// one a saffron-600 pill carrying its name, VIDYA optionally docked (v2 9a).
///
/// Drives the widget in isolation so the pill, the 48dp touch cells, the
/// docked layout, the reduce-motion degradation and the camera (scanner) tone
/// are asserted directly. Tab routing through the shell is covered end-to-end
/// by the shell/home suites.

const _icons = <IconData>[
  LucideIcons.home,
  LucideIcons.folder,
  LucideIcons.users,
  LucideIcons.user,
];

/// Pumps a host that owns the selected index, mimicking the shell.
Future<void> _pumpNav(
  WidgetTester tester, {
  int initialIndex = 0,
  FloatingNavTone tone = FloatingNavTone.standard,
  bool reduceMotion = false,
  Widget? dock,
  Widget? prompt,
  bool showDock = true,
  ValueChanged<int>? onSelect,
}) async {
  var selected = initialIndex;
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      // The active tab draws its localized name, so the host installs the
      // app's delegates or `AppLocalizations.of` throws on the first build.
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      // Inherit the test surface's real size (the bar measures it to decide
      // whether the active name fits); only reduce-motion is overridden.
      home: Builder(
        builder: (context) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(disableAnimations: reduceMotion),
          child: StatefulBuilder(
            builder: (context, setState) => Scaffold(
              bottomNavigationBar: FloatingBottomNav(
                currentIndex: selected,
                dock: dock,
                prompt: prompt,
                showDock: showDock,
                tone: tone,
                onSelected: (i) {
                  onSelect?.call(i);
                  setState(() => selected = i);
                },
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// The AnimatedContainer drawing tab [index]'s button. The `tab_$i` key marks
/// the 48dp touch cell (the element owning the semantics node); the drawn
/// button is its decorated descendant.
AnimatedContainer _button(WidgetTester tester, int index) =>
    tester.widget<AnimatedContainer>(
      find.descendant(
        of: find.byKey(ValueKey('tab_$index')),
        matching: find.byType(AnimatedContainer),
      ),
    );

/// The fill painted behind tab [index], or null when it is bare.
Color? _fill(WidgetTester tester, int index) =>
    (_button(tester, index).decoration as ShapeDecoration?)?.color;

Size _drawnSize(WidgetTester tester, int index) => tester.getSize(
  find.descendant(
    of: find.byKey(ValueKey('tab_$index')),
    matching: find.byType(AnimatedContainer),
  ),
);

void main() {
  group('structure', () {
    testWidgets('four destination glyphs; only the active tab shows its name', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 1);

      for (final icon in _icons) {
        expect(find.byIcon(icon), findsOneWidget);
      }
      // The map's Library glyph is a folder.
      expect(find.byIcon(LucideIcons.library), findsNothing);
      // The active tab carries its name; the others are icon-only.
      expect(find.text('Library'), findsOneWidget);
      expect(find.text('Home'), findsNothing);
      expect(find.text('Profile'), findsNothing);
      // No fifth tab, no Create action.
      expect(find.byIcon(LucideIcons.sparkles), findsNothing);
    });

    testWidgets('the active tab is a saffron-600 pill with a white icon', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 1);

      expect(_fill(tester, 1), AppColors.accentFill);
      final active = tester.widget<Icon>(find.byIcon(LucideIcons.folder));
      expect(active.color, AppColors.textOnAccent);
      // Inactive tabs are bare, with muted icons.
      expect(_fill(tester, 0), isNull);
      expect(_fill(tester, 3), isNull);
      final inactive = tester.widget<Icon>(find.byIcon(LucideIcons.home));
      expect(inactive.color, AppColors.ink500);
    });

    testWidgets('the pill grows past a bare 42px button to fit its name', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 1);

      expect(_drawnSize(tester, 0), const Size(42, 42));
      final pill = _drawnSize(tester, 1);
      expect(pill.height, 42);
      expect(pill.width, greaterThan(42));
    });
  });

  group('selection', () {
    testWidgets('tapping a tab reports its index and moves the pill', (
      tester,
    ) async {
      int? tapped;
      await _pumpNav(tester, onSelect: (i) => tapped = i);

      await tester.tap(find.byIcon(LucideIcons.users));
      await tester.pumpAndSettle();

      expect(tapped, 2);
      expect(_fill(tester, 2), AppColors.accentFill);
      expect(_fill(tester, 0), isNull);
      expect(find.text('Community'), findsOneWidget);
    });
  });

  group('with VIDYA docked (v2 9a)', () {
    const dock = SizedBox.square(key: ValueKey('dock'), dimension: 44);

    testWidgets('the dock follows the tabs after a divider', (tester) async {
      await _pumpNav(tester, initialIndex: 2, dock: dock);

      expect(_fill(tester, 2), AppColors.accentFill);
      final lastTab = tester.getRect(find.byKey(const ValueKey('tab_3')));
      final dockRect = tester.getRect(find.byKey(const ValueKey('dock')));
      // 4 lead + 1 divider + 6 trail between the last touch cell and the dock.
      expect(dockRect.left - lastTab.right, 11);
      expect(dockRect.center.dy, lastTab.center.dy);
    });

    testWidgets('showDock false hides the dock', (tester) async {
      await _pumpNav(tester, dock: dock, showDock: false);

      expect(find.byKey(const ValueKey('dock')), findsNothing);
      expect(_fill(tester, 0), AppColors.accentFill);
    });

    testWidgets('the prompt sits above the capsule', (tester) async {
      await _pumpNav(
        tester,
        dock: dock,
        prompt: const SizedBox(key: ValueKey('prompt'), width: 120, height: 34),
      );

      final prompt = tester.getRect(find.byKey(const ValueKey('prompt')));
      final tab = tester.getRect(find.byKey(const ValueKey('tab_0')));
      expect(prompt.bottom, lessThanOrEqualTo(tab.top));
    });
  });

  group('accessibility', () {
    testWidgets('exposes a labelled, selected button per tab', (tester) async {
      await _pumpNav(tester, initialIndex: 2);

      final active = tester.getSemantics(find.byKey(const ValueKey('tab_2')));
      expect(active, isSemantics(isSelected: true, hasEnabledState: true));

      final inactive = tester.getSemantics(find.byKey(const ValueKey('tab_0')));
      expect(inactive, isSemantics(isSelected: false));
    });

    testWidgets('every tab is a 48dp touch cell around its drawn button', (
      tester,
    ) async {
      await _pumpNav(tester);

      for (var i = 0; i < 4; i++) {
        final cell = tester.getSize(find.byKey(ValueKey('tab_$i')));
        expect(cell.width, greaterThanOrEqualTo(48));
        expect(cell.height, greaterThanOrEqualTo(48));
        expect(_drawnSize(tester, i).height, 42);
      }
    });

    testWidgets('meets the Android tap-target and labelling guidelines', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await _pumpNav(tester);

      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      handle.dispose();
    });

    testWidgets('a long localized name still fits at 360dp x textScale 1.3', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          locale: const Locale('ta'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(360, 800),
              textScaler: TextScaler.linear(1.3),
            ),
            child: Scaffold(
              bottomNavigationBar: FloatingBottomNav(
                currentIndex: 3,
                onSelected: (_) {},
                dock: const SizedBox.square(dimension: 44),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('reduce-motion renders a static composed frame', () {
    testWidgets('the pill jumps instead of tweening', (tester) async {
      await _pumpNav(tester, initialIndex: 0, reduceMotion: true);

      expect(_button(tester, 0).duration, Duration.zero);

      // ...and a switch still lands on the new tab: final frame.
      await tester.tap(find.byIcon(LucideIcons.user));
      await tester.pump();
      expect(_fill(tester, 3), AppColors.accentFill);
    });

    testWidgets('with motion ON the pill tween carries the spec duration', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 0);

      expect(_button(tester, 0).duration, AppMotion.small);
    });
  });

  group('camera tone (scanner surface)', () {
    testWidgets('a 16% milk capsule with no shadow, saffron pill kept', (
      tester,
    ) async {
      await _pumpNav(tester, tone: FloatingNavTone.camera);

      expect(tester.takeException(), isNull);
      final capsule =
          tester
                  .widget<DecoratedBox>(
                    find
                        .descendant(
                          of: find.byType(FloatingBottomNav),
                          matching: find.byType(DecoratedBox),
                        )
                        .first,
                  )
                  .decoration
              as BoxDecoration;
      expect(capsule.color, AppColors.cameraGlass);
      expect(capsule.boxShadow, isNull);
      expect(_fill(tester, 0), AppColors.accentFill);
      final inactive = tester.widget<Icon>(find.byIcon(LucideIcons.folder));
      expect(inactive.color, AppColors.onCameraIcon);
    });
  });
}
