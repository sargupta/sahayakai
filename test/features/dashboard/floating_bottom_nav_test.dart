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
/// disc, the drag-tint fallback, the 42dp floor, the reduce-motion
/// degradation and the dark (scanner) rendering are asserted directly. Tab
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
  Brightness brightness = Brightness.light,
  bool reduceMotion = false,
  bool orbDragging = false,
  ValueChanged<int>? onSelect,
}) async {
  var selected = initialIndex;
  await tester.pumpWidget(
    MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
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
              orbDragging: orbDragging,
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
AnimatedContainer _tabContainer(WidgetTester tester, int index) => tester
    .widget<AnimatedContainer>(
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
      // Icon-only: no visible text in the bar.
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

  group('while the orb is dragged', () {
    testWidgets('the active tab shows only a 12% saffron tint', (tester) async {
      await _pumpNav(tester, initialIndex: 0, orbDragging: true);

      expect(_tabColor(tester, 0), AppColors.accentTint);
      expect(_tabColor(tester, 0), isNot(AppColors.saffron500));
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

    testWidgets('every tab clears the 42dp touch-target floor', (tester) async {
      await _pumpNav(tester);

      for (var i = 0; i < 4; i++) {
        final size = tester.getSize(find.byKey(ValueKey('tab_$i')));
        expect(size.width, greaterThanOrEqualTo(42));
        expect(size.height, greaterThanOrEqualTo(42));
      }
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

  group('dark mode (scanner surface)', () {
    testWidgets('renders on ink without error', (tester) async {
      await _pumpNav(tester, brightness: Brightness.dark);

      expect(find.byType(FloatingBottomNav), findsOneWidget);
      expect(tester.takeException(), isNull);
      // Active tab becomes translucent milk, not the saffron disc.
      expect(_tabColor(tester, 0), const Color(0x29FFFDF9));
    });
  });
}
