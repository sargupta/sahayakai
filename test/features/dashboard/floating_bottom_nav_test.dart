import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/dashboard/presentation/floating_bottom_nav.dart';

/// v3 floating tab bar — Design System v3 ("icons only, four tabs, saffron
/// disc on the active one").
///
/// Drives the widget in isolation so the icon-only structure, the saffron
/// disc, the 48dp touch area, the docked-VIDYA layout (v2 9a), the
/// reduce-motion degradation and the camera (scanner) tone are asserted
/// directly. Tab
/// routing through the shell is covered end-to-end by the shell/home suites.

const _icons = <IconData>[
  LucideIcons.home,
  LucideIcons.library,
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
      // The bar is icon-only visually but carries localized screen-reader
      // labels (v3), so it resolves `context.l10n` — the host must install the
      // app's delegates or `AppLocalizations.of` throws on the first build.
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: reduceMotion),
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
  );
  await tester.pumpAndSettle();
}

/// The AnimatedContainer carrying tab [index]'s disc/background.
///
/// The `tab_$i` key marks the tab BUTTON (the keyed element must own the
/// semantics node the a11y assertions read); the disc container is its
/// decorated descendant.
AnimatedContainer _tabContainer(WidgetTester tester, int index) =>
    tester.widget<AnimatedContainer>(
      find.descendant(
        of: find.byKey(ValueKey('tab_$index')),
        matching: find.byType(AnimatedContainer),
      ),
    );

/// The background colour currently painted behind tab [index].
Color? _tabColor(WidgetTester tester, int index) =>
    (_tabContainer(tester, index).decoration as BoxDecoration).color;

void main() {
  group('structure', () {
    testWidgets('renders exactly the four destination glyphs, no labels', (
      tester,
    ) async {
      await _pumpNav(tester);

      for (final icon in _icons) {
        expect(find.byIcon(icon), findsOneWidget);
      }
      // Icon-only: labels are accessible names, never drawn.
      expect(find.byType(Text), findsNothing);
      // No fifth tab, no Create action.
      expect(find.byIcon(LucideIcons.sparkles), findsNothing);
    });

    testWidgets('the active tab wears the saffron disc', (tester) async {
      await _pumpNav(tester, initialIndex: 1);

      expect(_tabColor(tester, 1), AppColors.saffron500);
      // Inactive tabs are bare (transparent) — ink icons only.
      expect(_tabColor(tester, 0), isNull);
      expect(_tabColor(tester, 2), isNull);
      expect(_tabColor(tester, 3), isNull);
    });
  });

  group('selection', () {
    testWidgets('tapping a tab reports its index to the shell', (tester) async {
      int? tapped;
      await _pumpNav(tester, onSelect: (i) => tapped = i);

      await tester.tap(find.byIcon(LucideIcons.users));
      await tester.pumpAndSettle();

      expect(tapped, 2);
      // And the disc follows: index 2 now carries it.
      expect(_tabColor(tester, 2), AppColors.saffron500);
      expect(_tabColor(tester, 0), isNull);
    });
  });

  group('with VIDYA docked (v2 9a)', () {
    const dock = SizedBox.square(key: ValueKey('dock'), dimension: 44);

    testWidgets('the active tab is a 12% saffron tint, not the disc', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 2, dock: dock);

      expect(_tabColor(tester, 2), AppColors.accentTintStrong);
      expect(_tabColor(tester, 0), isNull);
      final active = tester.widget<Icon>(find.byIcon(LucideIcons.users));
      expect(active.color, AppColors.saffron600);
    });

    testWidgets('40dp discs in 44dp touch cells, the dock after the tabs', (
      tester,
    ) async {
      await _pumpNav(tester, dock: dock);

      for (var i = 0; i < 4; i++) {
        expect(
          tester.getSize(find.byKey(ValueKey('tab_$i'))),
          const Size(44, 44),
        );
        final disc = _tabContainer(tester, i).constraints!;
        expect(disc.maxWidth, 40);
      }
      final lastTab = tester.getRect(find.byKey(const ValueKey('tab_3')));
      final dockRect = tester.getRect(find.byKey(const ValueKey('dock')));
      // 5 lead + 1 divider + 6 trail between the last tab cell and the dock.
      expect(dockRect.left - lastTab.right, 12);
      expect(dockRect.center.dy, lastTab.center.dy);
    });

    testWidgets('showDock false hides the dock but keeps the docked tabs', (
      tester,
    ) async {
      await _pumpNav(tester, dock: dock, showDock: false);

      expect(find.byKey(const ValueKey('dock')), findsNothing);
      expect(_tabContainer(tester, 0).constraints!.maxWidth, 40);
      expect(_tabColor(tester, 0), AppColors.accentTintStrong);
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

    testWidgets('every tab draws a 42dp disc inside a 48dp touch area', (
      tester,
    ) async {
      await _pumpNav(tester);

      for (var i = 0; i < 4; i++) {
        final size = tester.getSize(find.byKey(ValueKey('tab_$i')));
        expect(size.width, greaterThanOrEqualTo(48));
        expect(size.height, greaterThanOrEqualTo(48));
        final disc = _tabContainer(tester, i).constraints!;
        expect(disc.maxWidth, 42);
        expect(disc.maxHeight, 42);
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
  });

  group('reduce-motion renders a static composed frame', () {
    testWidgets('the disc jumps instead of tweening', (tester) async {
      await _pumpNav(tester, initialIndex: 0, reduceMotion: true);

      expect(_tabContainer(tester, 0).duration, Duration.zero);

      // ...and a switch still lands on the new tab — final frame.
      await tester.tap(find.byIcon(LucideIcons.user));
      await tester.pump();
      expect(_tabColor(tester, 3), AppColors.saffron500);
    });

    testWidgets('with motion ON the disc tween carries the spec duration', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 0);

      expect(_tabContainer(tester, 0).duration, AppMotion.small);
    });
  });

  group('camera tone (scanner surface)', () {
    testWidgets('a 16% milk capsule with no shadow, saffron disc kept', (
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
      // The active tab keeps its saffron disc; inactive icons are on-camera.
      expect(_tabColor(tester, 0), AppColors.saffron500);
      final inactive = tester.widget<Icon>(find.byIcon(LucideIcons.library));
      expect(inactive.color, AppColors.onCameraIcon);
    });
  });
}
