import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/dashboard/presentation/app_tab_bar.dart';

/// The design-system-v2 TabBar (`TabBar` component, guide 09 "Platforms and
/// code"): four icon discs in a floating capsule, never five, no labels.
///
/// This is also the class gate for the founder's v1 rejection ("doesn't
/// match the mobile design"): the bar's geometry, materials and states are
/// asserted against the v2 token values, so a drift back to a labelled bar, a
/// fifth slot or off-token sizes fails here, not in a design review.

const _labels = {
  AppTab.home: 'Home',
  AppTab.library: 'Library',
  AppTab.community: 'Community',
  AppTab.profile: 'Profile',
};

Future<List<AppTab>> _pumpBar(
  WidgetTester tester, {
  AppTab initial = AppTab.home,
  bool dimmed = false,
}) async {
  var current = initial;
  final taps = <AppTab>[];
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: StatefulBuilder(
        builder: (context, setState) => Scaffold(
          bottomNavigationBar: AppTabBar(
            current: current,
            labels: _labels,
            dimmed: dimmed,
            onSelected: (t) {
              taps.add(t);
              setState(() => current = t);
            },
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return taps;
}

Finder _tab(AppTab t) => find.byKey(ValueKey('tab-${t.name}'));

/// The capsule: the DecoratedBox carrying the pill decoration.
Finder get _capsule => find.descendant(
  of: find.byType(AppTabBar),
  matching: find.byWidgetPredicate(
    (w) =>
        w is DecoratedBox &&
        w.decoration is BoxDecoration &&
        (w.decoration as BoxDecoration).borderRadius == AppRadius.rPill,
  ),
);

/// The disc of [t]: the 42px AnimatedContainer inside its target.
Finder _disc(AppTab t) => find.descendant(
  of: _tab(t),
  matching: find.byType(AnimatedContainer),
);

BoxDecoration _discDecoration(WidgetTester tester, AppTab t) =>
    tester.widget<AnimatedContainer>(_disc(t)).decoration! as BoxDecoration;

AppTabIcon _icon(WidgetTester tester, AppTab t) => tester.widget<AppTabIcon>(
  find.descendant(of: _tab(t), matching: find.byType(AppTabIcon)),
);

void main() {
  testWidgets('four destinations — home, library, community, profile — '
      'and never a fifth', (tester) async {
    await _pumpBar(tester);
    expect(AppTab.values, hasLength(4));
    for (final t in AppTab.values) {
      expect(_tab(t), findsOneWidget, reason: '${t.name} tab');
    }
    expect(find.byType(AppTabIcon), findsNWidgets(4));
  });

  testWidgets('draws no labels: they are accessible names only', (
    tester,
  ) async {
    await _pumpBar(tester);
    expect(
      find.descendant(of: find.byType(AppTabBar), matching: find.byType(Text)),
      findsNothing,
    );
  });

  testWidgets('geometry: 42px discs, 48px targets, 6px gaps, 7px capsule '
      'padding — a 202 × 58 capsule', (tester) async {
    await _pumpBar(tester);
    for (final t in AppTab.values) {
      expect(tester.getSize(_disc(t)), const Size.square(42));
      expect(tester.getSize(_tab(t)), const Size.square(48));
    }
    final home = tester.getRect(_disc(AppTab.home));
    final library = tester.getRect(_disc(AppTab.library));
    expect(library.left - home.right, 6, reason: 'space-2 between discs');

    final capsule = tester.getRect(_capsule);
    expect(capsule.size, const Size(202, 58));
    // 1px edge + 7px padding between the capsule's outer edge and a disc.
    expect(home.left - capsule.left, 8);
    expect(home.top - capsule.top, 8);
  });

  testWidgets('the capsule is surface-chrome, a 1px border-glass edge, a '
      'pill, shadow-float', (tester) async {
    await _pumpBar(tester);
    final d =
        tester.widget<DecoratedBox>(_capsule).decoration as BoxDecoration;
    expect(d.color, AppColors.surfaceChrome);
    expect(d.border, Border.all(color: AppColors.borderGlass, width: 1));
    expect(d.borderRadius, AppRadius.rPill);
    expect(d.boxShadow, AppShadows.float);
  });

  testWidgets('floats tabbar-bottom (18px) above the foot', (tester) async {
    await _pumpBar(tester);
    final screen = tester.getSize(find.byType(Scaffold));
    expect(screen.height - tester.getRect(_capsule).bottom, 18);
  });

  testWidgets('active: a saffron-500 disc with a white icon at 1.8; '
      'inactive: no disc, an ink-500 icon at 1.7', (tester) async {
    await _pumpBar(tester, initial: AppTab.library);

    expect(_discDecoration(tester, AppTab.library).color, AppColors.saffron500);
    expect(_icon(tester, AppTab.library).color, AppColors.textOnAccent);
    expect(_icon(tester, AppTab.library).strokeWidth, 1.8);

    for (final t in [AppTab.home, AppTab.community, AppTab.profile]) {
      expect(_discDecoration(tester, t).color, Colors.transparent);
      expect(_icon(tester, t).color, AppColors.ink500);
      expect(_icon(tester, t).strokeWidth, 1.7);
      expect(_icon(tester, t).size, 18);
    }
  });

  testWidgets('dimmed (orb dragged): half opacity, a 12% saffron disc and a '
      'saffron-600 icon', (tester) async {
    await _pumpBar(tester, dimmed: true);
    final opacity = tester.widget<AnimatedOpacity>(
      find.descendant(
        of: find.byType(AppTabBar),
        matching: find.byType(AnimatedOpacity),
      ),
    );
    expect(opacity.opacity, 0.5);
    expect(
      _discDecoration(tester, AppTab.home).color,
      AppColors.accentTintStrong,
    );
    expect(_icon(tester, AppTab.home).color, AppColors.saffron600);
    expect(_icon(tester, AppTab.home).strokeWidth, 1.7);
  });

  testWidgets('every tab is a named button; the current one is selected', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await _pumpBar(tester, initial: AppTab.community);
    for (final t in AppTab.values) {
      expect(
        tester.getSemantics(_tab(t)),
        matchesSemantics(
          label: _labels[t],
          isButton: true,
          hasSelectedState: true,
          isSelected: t == AppTab.community,
          hasTapAction: true,
          hasFocusAction: true,
          isFocusable: true,
        ),
      );
    }
    handle.dispose();
  });

  testWidgets('labels double as tooltips', (tester) async {
    await _pumpBar(tester);
    for (final t in AppTab.values) {
      expect(
        find.descendant(
          of: _tab(t),
          matching: find.byWidgetPredicate(
            (w) => w is Tooltip && w.message == _labels[t],
          ),
        ),
        findsOneWidget,
      );
    }
  });

  testWidgets('tapping a tab selects it', (tester) async {
    final taps = await _pumpBar(tester);
    await tester.tap(_tab(AppTab.profile));
    await tester.pumpAndSettle();
    expect(taps, [AppTab.profile]);
    expect(_discDecoration(tester, AppTab.profile).color, AppColors.saffron500);
    expect(_discDecoration(tester, AppTab.home).color, Colors.transparent);
  });

  testWidgets('meets the 48dp tap-target guideline', (tester) async {
    await _pumpBar(tester);
    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
  });
}
