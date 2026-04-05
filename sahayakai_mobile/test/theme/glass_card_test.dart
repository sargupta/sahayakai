import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/theme/glassmorphic/glass_card.dart';
import '../helpers/test_utils.dart';

void main() {
  // ─── GlassCard ──────────────────────────────────────────────────────────
  group('GlassCard', () {
    testWidgets('renders child widget', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassCard(child: Text('Card Content')),
      ));
      expect(find.text('Card Content'), findsOneWidget);
    });

    testWidgets('renders with custom padding', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassCard(
          padding: EdgeInsets.all(32),
          child: Text('Padded'),
        ),
      ));
      expect(find.text('Padded'), findsOneWidget);
    });

    testWidgets('renders with custom margin', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassCard(
          margin: EdgeInsets.symmetric(horizontal: 16),
          child: Text('Margined'),
        ),
      ));
      expect(find.text('Margined'), findsOneWidget);
    });

    testWidgets('wraps in GestureDetector when onTap is provided',
        (tester) async {
      bool tapped = false;
      await pumpTestApp(tester, Scaffold(
        body: GlassCard(
          onTap: () => tapped = true,
          child: const Text('Tappable'),
        ),
      ));
      await tester.tap(find.text('Tappable'));
      expect(tapped, true);
    });

    testWidgets('does not wrap in GestureDetector when onTap is null',
        (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassCard(child: Text('Non-tappable')),
      ));
      // GlassCard wraps in RepaintBoundary but not GestureDetector
      expect(find.text('Non-tappable'), findsOneWidget);
      expect(find.byType(GestureDetector), findsNothing);
    });

    testWidgets('renders with custom borderRadius', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassCard(
          borderRadius: 24,
          child: Text('Rounded'),
        ),
      ));
      expect(find.text('Rounded'), findsOneWidget);
    });

    testWidgets('renders with custom backgroundColor', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassCard(
          backgroundColor: Colors.blue,
          child: Text('Blue'),
        ),
      ));
      expect(find.text('Blue'), findsOneWidget);
    });

    testWidgets('renders with custom blur and opacity', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassCard(
          blurAmount: 16,
          backgroundOpacity: 0.6,
          borderOpacity: 0.5,
          child: Text('Custom'),
        ),
      ));
      expect(find.text('Custom'), findsOneWidget);
    });
  });

  // ─── GlassIconCard ──────────────────────────────────────────────────────
  group('GlassIconCard', () {
    testWidgets('renders icon, title, and child', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassIconCard(
          icon: Icons.school,
          iconColor: Colors.orange,
          title: 'Lesson Details',
          child: Text('Content here'),
        ),
      ));
      expect(find.byIcon(Icons.school), findsOneWidget);
      expect(find.text('Lesson Details'), findsOneWidget);
      expect(find.text('Content here'), findsOneWidget);
    });

    testWidgets('renders with custom padding and margin', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassIconCard(
          icon: Icons.book,
          iconColor: Colors.green,
          title: 'Card',
          padding: EdgeInsets.all(24),
          margin: EdgeInsets.all(8),
          child: Text('Inner'),
        ),
      ));
      expect(find.text('Inner'), findsOneWidget);
    });
  });

  // ─── GlassSectionCard ──────────────────────────────────────────────────
  group('GlassSectionCard', () {
    testWidgets('renders with icon as GlassIconCard', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassSectionCard(
          title: 'Section',
          icon: Icons.edit,
          child: Text('Section Content'),
        ),
      ));
      expect(find.byIcon(Icons.edit), findsOneWidget);
      expect(find.text('Section'), findsOneWidget);
      expect(find.text('Section Content'), findsOneWidget);
    });

    testWidgets('renders without icon as plain GlassCard', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassSectionCard(
          title: 'Plain Section',
          child: Text('Plain Content'),
        ),
      ));
      expect(find.text('Plain Section'), findsOneWidget);
      expect(find.text('Plain Content'), findsOneWidget);
    });

    testWidgets('renders decorativeLabel when provided', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassSectionCard(
          title: 'Section',
          decorativeLabel: 'Drafting New Worksheet...',
          child: Text('Content'),
        ),
      ));
      expect(find.text('Drafting New Worksheet...'), findsOneWidget);
    });

    testWidgets('does not render decorativeLabel when null', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassSectionCard(
          title: 'Section',
          icon: Icons.star,
          child: Text('Content'),
        ),
      ));
      expect(find.text('Section'), findsOneWidget);
    });

    testWidgets('uses custom iconColor', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassSectionCard(
          title: 'Colored',
          icon: Icons.palette,
          iconColor: Colors.purple,
          child: Text('Color Content'),
        ),
      ));
      expect(find.byIcon(Icons.palette), findsOneWidget);
    });
  });
}
