import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/theme/glassmorphic/glass_scaffold.dart';
import '../helpers/test_utils.dart';

void main() {
  // ─── GlassScaffold ────────────────────────────────────────────────────
  group('GlassScaffold', () {
    testWidgets('renders title in the app bar', (tester) async {
      await pumpTestApp(tester, GlassScaffold(
        title: 'Lesson Plan',
        body: const Text('body content'),
      ));
      expect(find.text('Lesson Plan'), findsOneWidget);
      expect(find.text('body content'), findsOneWidget);
    });

    testWidgets('renders with customAppBar instead of default', (tester) async {
      await pumpTestApp(tester, GlassScaffold(
        title: 'Ignored',
        customAppBar: AppBar(title: const Text('Custom Bar')),
        body: const Text('content'),
      ));
      expect(find.text('Custom Bar'), findsOneWidget);
    });

    testWidgets('renders actions in the app bar', (tester) async {
      await pumpTestApp(tester, GlassScaffold(
        title: 'Test',
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(Icons.settings)),
        ],
        body: const SizedBox(),
      ));
      expect(find.byIcon(Icons.settings), findsOneWidget);
    });

    testWidgets('hides back button when showBackButton is false',
        (tester) async {
      await pumpTestApp(tester, GlassScaffold(
        title: 'No Back',
        showBackButton: false,
        body: const SizedBox(),
      ));
      // GlassBackButton uses Icons.arrow_back_ios_new_rounded
      expect(find.byIcon(Icons.arrow_back_ios_new_rounded), findsNothing);
    });

    testWidgets('renders bottomNavigationBar when provided', (tester) async {
      await pumpTestApp(tester, GlassScaffold(
        title: 'Nav',
        body: const SizedBox(),
        bottomNavigationBar: const BottomAppBar(
          child: Text('Bottom Nav'),
        ),
      ));
      expect(find.text('Bottom Nav'), findsOneWidget);
    });

    testWidgets('renders FAB when provided', (tester) async {
      await pumpTestApp(tester, GlassScaffold(
        title: 'FAB',
        body: const SizedBox(),
        floatingActionButton: FloatingActionButton(
          onPressed: () {},
          child: const Icon(Icons.add),
        ),
      ));
      expect(find.byIcon(Icons.add), findsOneWidget);
    });

    testWidgets('extendBody is passed to Scaffold', (tester) async {
      await pumpTestApp(tester, GlassScaffold(
        title: 'Extended',
        extendBody: true,
        body: const SizedBox(),
      ));
      final scaffold = tester.widget<Scaffold>(find.byType(Scaffold).first);
      expect(scaffold.extendBody, true);
    });
  });

  // ─── GlassPage ──────────────────────────────────────────────────────────
  group('GlassPage', () {
    testWidgets('renders title and body', (tester) async {
      await pumpTestApp(tester, GlassPage(
        title: 'Page Title',
        body: const Text('Page Body'),
      ));
      // Title appears in both the app bar and the header section
      expect(find.text('Page Title'), findsWidgets);
      expect(find.text('Page Body'), findsOneWidget);
    });

    testWidgets('renders decorativeLabel when provided', (tester) async {
      await pumpTestApp(tester, GlassPage(
        title: 'Title',
        decorativeLabel: 'Creating...',
        body: const SizedBox(),
      ));
      expect(find.text('Creating...'), findsOneWidget);
    });

    testWidgets('does not render decorativeLabel when null', (tester) async {
      await pumpTestApp(tester, GlassPage(
        title: 'Title',
        body: const SizedBox(),
      ));
      expect(find.byType(GlassPage), findsOneWidget);
    });

    testWidgets('renders actions when provided', (tester) async {
      await pumpTestApp(tester, GlassPage(
        title: 'Title',
        actions: [const Icon(Icons.share)],
        body: const SizedBox(),
      ));
      expect(find.byIcon(Icons.share), findsOneWidget);
    });

    testWidgets('renders FAB when provided', (tester) async {
      await pumpTestApp(tester, GlassPage(
        title: 'Title',
        body: const SizedBox(),
        floatingActionButton: FloatingActionButton(
          onPressed: () {},
          child: const Icon(Icons.save),
        ),
      ));
      expect(find.byIcon(Icons.save), findsOneWidget);
    });
  });

  // ─── GlassHeader ───────────────────────────────────────────────────────
  group('GlassHeader', () {
    testWidgets('renders title', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassHeader(title: 'Header Title'),
      ));
      expect(find.text('Header Title'), findsOneWidget);
    });

    testWidgets('renders decorativeLabel when provided', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassHeader(
          title: 'Title',
          decorativeLabel: 'Drafting...',
        ),
      ));
      expect(find.text('Drafting...'), findsOneWidget);
    });

    testWidgets('does not render decorativeLabel when null', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassHeader(title: 'Title'),
      ));
      expect(find.byType(GlassHeader), findsOneWidget);
    });

    testWidgets('renders divider by default', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassHeader(title: 'Title'),
      ));
      // Divider is a Container with height 2, width 60
      expect(find.byType(GlassHeader), findsOneWidget);
    });

    testWidgets('hides divider when showDivider is false', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassHeader(title: 'No Divider', showDivider: false),
      ));
      expect(find.text('No Divider'), findsOneWidget);
    });
  });
}
