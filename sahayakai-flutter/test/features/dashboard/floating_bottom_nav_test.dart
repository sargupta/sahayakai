import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/dashboard/presentation/floating_bottom_nav.dart';

/// U9 — the floating bottom navigation (PREMIUM_DESIGN_SPEC.md §5).
///
/// Drives the widget in isolation so the pill, the active-icon micro-scale, the
/// action-is-not-a-destination rule, and the reduce-motion degradation are all
/// asserted directly, without the whole signed-in app around it. The tab
/// routing / "Create opens the palette" behaviour is covered end-to-end by the
/// library and create-palette suites.

const _items = <FloatingNavItem>[
  FloatingNavItem(icon: LucideIcons.home, label: 'Home'),
  FloatingNavItem(icon: LucideIcons.sparkles, label: 'Create', isAction: true),
  FloatingNavItem(icon: LucideIcons.library, label: 'Library'),
  FloatingNavItem(icon: LucideIcons.user, label: 'Me'),
];

/// A host that owns the selected index and mimics the shell's rule: an action
/// item does NOT change the selection (it would open a palette instead), so the
/// pill stays on the current tab.
Future<int> _pumpNav(
  WidgetTester tester, {
  int initialIndex = 0,
  Brightness brightness = Brightness.light,
  bool reduceMotion = false,
}) async {
  var selected = initialIndex;
  await tester.pumpWidget(
    MaterialApp(
      theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: reduceMotion),
        child: StatefulBuilder(
          builder: (context, setState) => Scaffold(
            bottomNavigationBar: FloatingBottomNav(
              currentIndex: selected,
              items: _items,
              onSelected: (i) {
                if (_items[i].isAction) return; // action: don't switch tabs
                setState(() => selected = i);
              },
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return selected;
}

AlignmentGeometry _pillAlignment(WidgetTester tester) => tester
    .widget<AnimatedAlign>(find.byKey(const ValueKey('nav-pill-align')))
    .alignment;

void main() {
  setUp(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('structure', () {
    testWidgets('renders all four glyphs and labels', (tester) async {
      await _pumpNav(tester);

      for (final icon in const [
        LucideIcons.home,
        LucideIcons.sparkles,
        LucideIcons.library,
        LucideIcons.user,
      ]) {
        expect(find.byIcon(icon), findsOneWidget);
      }
      for (final label in const ['Home', 'Create', 'Library', 'Me']) {
        expect(find.text(label), findsOneWidget);
      }
    });

    testWidgets('the active pill sits behind the active destination', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 0);

      expect(find.byKey(const ValueKey('nav-active-pill')), findsOneWidget);
      expect(
        _pillAlignment(tester),
        AlignmentDirectional(FloatingBottomNav.pillAlignmentX(0, 4), -0.4),
      );
    });
  });

  group('the pill follows the selected tab', () {
    testWidgets('tapping Library slides the pill to Library', (tester) async {
      await _pumpNav(tester, initialIndex: 0);

      await tester.tap(find.text('Library'));
      await tester.pumpAndSettle();

      expect(
        _pillAlignment(tester),
        AlignmentDirectional(FloatingBottomNav.pillAlignmentX(2, 4), -0.4),
      );
    });
  });

  group('Create is an action, never a destination', () {
    testWidgets('tapping Create never moves the pill off the current tab', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 2); // start on Library

      final before = _pillAlignment(tester);
      expect(
        before,
        AlignmentDirectional(FloatingBottomNav.pillAlignmentX(2, 4), -0.4),
      );

      // Tapping the Create action must not steal the pill.
      await tester.tap(find.byIcon(LucideIcons.sparkles));
      await tester.pumpAndSettle();

      expect(_pillAlignment(tester), before);
      // And the Create slot is not styled as selected.
      expect(
        tester.getSemantics(find.text('Create')),
        isSemantics(isSelected: false),
      );
    });
  });

  group('accessibility', () {
    testWidgets('exposes selected state on the active destination', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 2);

      expect(
        tester.getSemantics(find.text('Library')),
        isSemantics(isSelected: true),
      );
      expect(
        tester.getSemantics(find.text('Home')),
        isSemantics(isSelected: false),
      );
    });

    testWidgets('every tab clears the 48dp tap-target floor', (tester) async {
      await _pumpNav(tester);

      for (final label in const ['Home', 'Create', 'Library', 'Me']) {
        final size = tester.getSize(
          find.ancestor(
            of: find.text(label),
            matching: find.byType(InkResponse),
          ),
        );
        expect(size.height, greaterThanOrEqualTo(48));
        expect(size.width, greaterThanOrEqualTo(48));
      }
    });
  });

  group('reduce-motion renders a static composed frame', () {
    AnimatedScale iconScale(WidgetTester tester, IconData icon) =>
        tester.widget<AnimatedScale>(
          find.ancestor(
            of: find.byIcon(icon),
            matching: find.byType(AnimatedScale),
          ),
        );

    testWidgets('every implicit tween collapses to Duration.zero', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 0, reduceMotion: true);

      // The sliding pill jumps.
      expect(
        tester
            .widget<AnimatedAlign>(find.byKey(const ValueKey('nav-pill-align')))
            .duration,
        Duration.zero,
      );
      // The active-icon micro-scale does not tween.
      expect(iconScale(tester, LucideIcons.home).duration, Duration.zero);

      // ...and a switch still lands the pill on the new tab — final frame.
      await tester.tap(find.text('Me'));
      await tester.pump();
      expect(
        _pillAlignment(tester),
        AlignmentDirectional(FloatingBottomNav.pillAlignmentX(3, 4), -0.4),
      );
    });

    testWidgets('with motion ON the tweens carry the spec durations', (
      tester,
    ) async {
      await _pumpNav(tester, initialIndex: 0);

      expect(
        tester
            .widget<AnimatedAlign>(find.byKey(const ValueKey('nav-pill-align')))
            .duration,
        AppMotion.small,
      );
      expect(iconScale(tester, LucideIcons.home).duration, AppMotion.micro);
    });
  });

  group('dark mode', () {
    testWidgets('renders on espresso without error', (tester) async {
      await _pumpNav(tester, brightness: Brightness.dark);

      expect(find.byType(FloatingBottomNav), findsOneWidget);
      expect(find.byKey(const ValueKey('nav-active-pill')), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
