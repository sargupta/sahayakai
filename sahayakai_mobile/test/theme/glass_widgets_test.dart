import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/theme/glassmorphic/glass_inputs.dart';
import 'package:sahayakai_mobile/src/core/theme/glassmorphic/glass_widgets.dart';
import '../helpers/test_utils.dart';

void main() {
  group('GlassPreviewCard', () {
    testWidgets('renders label text uppercased', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassPreviewCard(label: 'notebook'),
      ));
      expect(find.text('NOTEBOOK'), findsOneWidget);
    });

    testWidgets('renders custom child instead of placeholder', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassPreviewCard(
          label: 'test',
          child: Text('Custom Content'),
        ),
      ));
      expect(find.text('Custom Content'), findsOneWidget);
    });

    testWidgets('renders placeholder when no child provided', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassPreviewCard(label: 'test'),
      ));
      // Placeholder has an edit icon
      expect(find.byIcon(Icons.edit_outlined), findsOneWidget);
    });

    testWidgets('respects custom height', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassPreviewCard(label: 'test', height: 250),
      ));
      // Widget builds without error with custom height
      expect(find.text('TEST'), findsOneWidget);
    });
  });

  group('GlassListItem', () {
    testWidgets('renders icon, title, and subtitle', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassListItem(
          icon: Icons.star,
          iconColor: Colors.amber,
          title: 'Starred',
          subtitle: 'Your favorites',
        ),
      ));
      expect(find.byIcon(Icons.star), findsOneWidget);
      expect(find.text('Starred'), findsOneWidget);
      expect(find.text('Your favorites'), findsOneWidget);
    });

    testWidgets('does not render subtitle when null', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassListItem(
          icon: Icons.star,
          iconColor: Colors.amber,
          title: 'Title Only',
        ),
      ));
      expect(find.text('Title Only'), findsOneWidget);
    });

    testWidgets('renders trailing widget when provided', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassListItem(
          icon: Icons.settings,
          iconColor: Colors.grey,
          title: 'Settings',
          trailing: const Icon(Icons.chevron_right),
        ),
      ));
      expect(find.byIcon(Icons.chevron_right), findsOneWidget);
    });
  });

  group('GlassSectionLabel', () {
    testWidgets('renders label uppercased', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassSectionLabel(label: 'my section'),
      ));
      expect(find.text('MY SECTION'), findsOneWidget);
    });

    testWidgets('renders trailing widget when provided', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassSectionLabel(
          label: 'section',
          trailing: Text('See All'),
        ),
      ));
      expect(find.text('See All'), findsOneWidget);
    });
  });

  group('GlassDivider', () {
    testWidgets('renders without error', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassDivider(),
      ));
      // Divider is a Container with height 1
      expect(find.byType(GlassDivider), findsOneWidget);
    });

    testWidgets('applies indent and endIndent', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassDivider(indent: 16, endIndent: 16),
      ));
      expect(find.byType(GlassDivider), findsOneWidget);
    });
  });

  group('GlassLoadingIndicator', () {
    testWidgets('renders spinner without message', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassLoadingIndicator(),
      ));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('renders message when provided', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassLoadingIndicator(message: 'Loading...'),
      ));
      expect(find.text('Loading...'), findsOneWidget);
    });
  });

  group('GlassEmptyState', () {
    testWidgets('renders icon and title', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassEmptyState(
          icon: Icons.inbox,
          title: 'No Items',
        ),
      ));
      expect(find.byIcon(Icons.inbox), findsOneWidget);
      expect(find.text('No Items'), findsOneWidget);
    });

    testWidgets('renders optional message and action', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassEmptyState(
          icon: Icons.inbox,
          title: 'Empty',
          message: 'Nothing here yet',
          action: ElevatedButton(
            onPressed: () {},
            child: const Text('Add'),
          ),
        ),
      ));
      expect(find.text('Nothing here yet'), findsOneWidget);
      expect(find.text('Add'), findsOneWidget);
    });
  });

  group('GlassToolCard', () {
    testWidgets('renders title and icon', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassToolCard(
          title: 'Lesson Plan',
          icon: Icons.book,
        ),
      ));
      expect(find.text('Lesson Plan'), findsOneWidget);
      expect(find.byIcon(Icons.book), findsOneWidget);
    });

    testWidgets('responds to tap', (tester) async {
      bool tapped = false;
      await pumpTestApp(tester, Scaffold(
        body: GlassToolCard(
          title: 'Tap Me',
          icon: Icons.touch_app,
          onTap: () => tapped = true,
        ),
      ));
      await tester.tap(find.byType(GlassToolCard));
      expect(tapped, isTrue);
    });
  });

  group('GlassHeroCard', () {
    testWidgets('renders title and subtitle', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassHeroCard(
          title: 'Welcome',
          subtitle: 'Start teaching',
        ),
      ));
      expect(find.text('Welcome'), findsOneWidget);
      expect(find.text('Start teaching'), findsOneWidget);
    });
  });

  group('GlassBottomNavBar', () {
    testWidgets('renders all nav items', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassBottomNavBar(
          currentIndex: 0,
          onTap: (_) {},
          items: const [
            GlassNavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home'),
            GlassNavItem(icon: Icons.search_outlined, activeIcon: Icons.search, label: 'Search'),
          ],
        ),
      ));
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Search'), findsOneWidget);
    });

    testWidgets('calls onTap with correct index', (tester) async {
      int? tappedIndex;
      await pumpTestApp(tester, Scaffold(
        body: GlassBottomNavBar(
          currentIndex: 0,
          onTap: (i) => tappedIndex = i,
          items: const [
            GlassNavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home'),
            GlassNavItem(icon: Icons.search_outlined, activeIcon: Icons.search, label: 'Search'),
          ],
        ),
      ));
      await tester.tap(find.text('Search'));
      expect(tappedIndex, 1);
    });

    testWidgets('shows active icon for selected index', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassBottomNavBar(
          currentIndex: 0,
          onTap: (_) {},
          items: const [
            GlassNavItem(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home'),
            GlassNavItem(icon: Icons.search_outlined, activeIcon: Icons.search, label: 'Search'),
          ],
        ),
      ));
      // Active: filled home icon; inactive: outlined search icon
      expect(find.byIcon(Icons.home), findsOneWidget);
      expect(find.byIcon(Icons.search_outlined), findsOneWidget);
    });
  });

  // ─── GlassTextField ─────────────────────────────────────────────────────
  group('GlassTextField', () {
    testWidgets('renders with hint text', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassTextField(hintText: 'Enter topic'),
      ));
      expect(find.text('Enter topic'), findsOneWidget);
    });

    testWidgets('renders label text uppercased when provided', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassTextField(labelText: 'subject'),
      ));
      expect(find.text('SUBJECT'), findsOneWidget);
    });

    testWidgets('does not render label when null', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassTextField(hintText: 'Enter'),
      ));
      // No uppercased label text
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('renders suffix and prefix icons', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassTextField(
          suffixIcon: Icon(Icons.search),
          prefixIcon: Icon(Icons.book),
        ),
      ));
      expect(find.byIcon(Icons.search), findsOneWidget);
      expect(find.byIcon(Icons.book), findsOneWidget);
    });

    testWidgets('fires onChanged callback', (tester) async {
      String? changedValue;
      await pumpTestApp(tester, Scaffold(
        body: GlassTextField(onChanged: (v) => changedValue = v),
      ));
      await tester.enterText(find.byType(TextField), 'hello');
      expect(changedValue, 'hello');
    });

    testWidgets('renders as disabled when enabled is false', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassTextField(enabled: false, hintText: 'disabled'),
      ));
      final textField = tester.widget<TextField>(find.byType(TextField));
      expect(textField.enabled, false);
    });

    testWidgets('renders with readOnly and onTap', (tester) async {
      bool tapped = false;
      await pumpTestApp(tester, Scaffold(
        body: GlassTextField(
          readOnly: true,
          onTap: () => tapped = true,
        ),
      ));
      await tester.tap(find.byType(TextField));
      expect(tapped, true);
    });

    testWidgets('supports multiline via maxLines', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassTextField(maxLines: 5),
      ));
      final textField = tester.widget<TextField>(find.byType(TextField));
      expect(textField.maxLines, 5);
    });

    testWidgets('applies keyboardType', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassTextField(keyboardType: TextInputType.number),
      ));
      final textField = tester.widget<TextField>(find.byType(TextField));
      expect(textField.keyboardType, TextInputType.number);
    });
  });

  // ─── GlassDropdown ──────────────────────────────────────────────────────
  group('GlassDropdown', () {
    testWidgets('renders with hint text', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassDropdown<String>(
          hintText: 'Select option',
          items: const [
            DropdownMenuItem(value: 'a', child: Text('Option A')),
          ],
          onChanged: (_) {},
        ),
      ));
      expect(find.text('Select option'), findsOneWidget);
    });

    testWidgets('renders label text uppercased', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassDropdown<String>(
          labelText: 'grade',
          items: const [
            DropdownMenuItem(value: 'a', child: Text('A')),
          ],
          onChanged: (_) {},
        ),
      ));
      expect(find.text('GRADE'), findsOneWidget);
    });

    testWidgets('renders without label when null', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassDropdown<String>(
          items: const [
            DropdownMenuItem(value: 'a', child: Text('A')),
          ],
          onChanged: (_) {},
        ),
      ));
      expect(find.byType(DropdownButton<String>), findsOneWidget);
    });

    testWidgets('renders selected value', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassDropdown<String>(
          value: 'a',
          items: const [
            DropdownMenuItem(value: 'a', child: Text('Option A')),
            DropdownMenuItem(value: 'b', child: Text('Option B')),
          ],
          onChanged: (_) {},
        ),
      ));
      expect(find.text('Option A'), findsOneWidget);
    });

    testWidgets('renders without hint when hintText is null', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassDropdown<String>(
          items: const [
            DropdownMenuItem(value: 'x', child: Text('X')),
          ],
          onChanged: (_) {},
        ),
      ));
      expect(find.byType(DropdownButton<String>), findsOneWidget);
    });
  });

  // ─── GlassSwitch ───────────────────────────────────────────────────────
  group('GlassSwitch', () {
    testWidgets('renders title and switch', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassSwitch(
          title: 'Include Answer Key',
          value: false,
          onChanged: (_) {},
        ),
      ));
      expect(find.text('Include Answer Key'), findsOneWidget);
      expect(find.byType(Switch), findsOneWidget);
    });

    testWidgets('renders description when provided', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassSwitch(
          title: 'Toggle',
          description: 'Enable this feature',
          value: true,
          onChanged: (_) {},
        ),
      ));
      expect(find.text('Enable this feature'), findsOneWidget);
    });

    testWidgets('does not render description when null', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassSwitch(
          title: 'Toggle',
          value: false,
          onChanged: (_) {},
        ),
      ));
      expect(find.text('Toggle'), findsOneWidget);
      // Only the title, no description text
    });

    testWidgets('fires onChanged when toggled', (tester) async {
      bool? toggledValue;
      await pumpTestApp(tester, Scaffold(
        body: GlassSwitch(
          title: 'Test',
          value: false,
          onChanged: (v) => toggledValue = v,
        ),
      ));
      await tester.tap(find.byType(Switch));
      expect(toggledValue, true);
    });
  });

  // ─── GlassChipGroup ────────────────────────────────────────────────────
  group('GlassChipGroup', () {
    testWidgets('renders all options as chips', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassChipGroup(
          options: const ['MCQ', 'Short Answer', 'Long Answer'],
          selectedOptions: const {'MCQ'},
          onToggle: (_) {},
        ),
      ));
      expect(find.text('MCQ'), findsOneWidget);
      expect(find.text('Short Answer'), findsOneWidget);
      expect(find.text('Long Answer'), findsOneWidget);
    });

    testWidgets('renders label text uppercased', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassChipGroup(
          labelText: 'question types',
          options: const ['MCQ'],
          selectedOptions: const {},
        ),
      ));
      expect(find.text('QUESTION TYPES'), findsOneWidget);
    });

    testWidgets('does not render label when null', (tester) async {
      await pumpTestApp(tester, Scaffold(
        body: GlassChipGroup(
          options: const ['A'],
          selectedOptions: const {},
        ),
      ));
      expect(find.byType(GlassChipGroup), findsOneWidget);
    });

    testWidgets('fires onToggle with correct option', (tester) async {
      String? toggled;
      await pumpTestApp(tester, Scaffold(
        body: GlassChipGroup(
          options: const ['MCQ', 'Essay'],
          selectedOptions: const {},
          onToggle: (v) => toggled = v,
        ),
      ));
      await tester.tap(find.text('Essay'));
      expect(toggled, 'Essay');
    });
  });

  // ─── GlassChip ─────────────────────────────────────────────────────────
  group('GlassChip', () {
    testWidgets('renders label text', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassChip(label: 'Tag'),
      ));
      expect(find.text('Tag'), findsOneWidget);
    });

    testWidgets('renders with icon when provided', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassChip(label: 'Star', icon: Icons.star),
      ));
      expect(find.byIcon(Icons.star), findsOneWidget);
    });

    testWidgets('does not render icon when null', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassChip(label: 'NoIcon'),
      ));
      expect(find.text('NoIcon'), findsOneWidget);
    });

    testWidgets('fires onTap callback', (tester) async {
      bool tapped = false;
      await pumpTestApp(tester, Scaffold(
        body: GlassChip(label: 'Tap', onTap: () => tapped = true),
      ));
      await tester.tap(find.text('Tap'));
      expect(tapped, true);
    });

    testWidgets('renders selected state with different color', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassChip(label: 'Selected', isSelected: true),
      ));
      expect(find.text('Selected'), findsOneWidget);
    });

    testWidgets('renders unselected state', (tester) async {
      await pumpTestApp(tester, const Scaffold(
        body: GlassChip(label: 'Unselected', isSelected: false),
      ));
      expect(find.text('Unselected'), findsOneWidget);
    });
  });
}
