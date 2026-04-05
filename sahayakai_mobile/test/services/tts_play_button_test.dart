import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:sahayakai_mobile/src/components/tts_play_button.dart';
import 'package:sahayakai_mobile/src/core/providers/language_provider.dart';

void main() {
  Widget buildTestWidget({String text = 'Hello world', double size = 40}) {
    return ProviderScope(
      child: MaterialApp(
        home: Scaffold(
          body: TTSPlayButton(text: text, size: size),
        ),
      ),
    );
  }

  group('TTSPlayButton', () {
    testWidgets('shows volume icon initially', (tester) async {
      await tester.pumpWidget(buildTestWidget());

      expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);
    });

    testWidgets('has correct tooltip', (tester) async {
      await tester.pumpWidget(buildTestWidget());

      final iconButton = tester.widget<IconButton>(find.byType(IconButton));
      expect(iconButton.tooltip, 'Listen');
    });

    testWidgets('renders with custom size', (tester) async {
      await tester.pumpWidget(buildTestWidget(size: 60));

      final sizedBox = tester.widget<SizedBox>(find.byType(SizedBox).first);
      expect(sizedBox.width, 60);
      expect(sizedBox.height, 60);
    });

    testWidgets('icon color is deepOrange when not playing', (tester) async {
      await tester.pumpWidget(buildTestWidget());

      final icon = tester.widget<Icon>(find.byIcon(Icons.volume_up_rounded));
      expect(icon.color, Colors.deepOrange);
    });

    testWidgets('default size is 40x40', (tester) async {
      await tester.pumpWidget(buildTestWidget());

      final sizedBox = tester.widget<SizedBox>(find.byType(SizedBox).first);
      expect(sizedBox.width, 40);
      expect(sizedBox.height, 40);
    });

    testWidgets('iconSize is 60% of widget size', (tester) async {
      await tester.pumpWidget(buildTestWidget(size: 50));

      final iconButton = tester.widget<IconButton>(find.byType(IconButton));
      expect(iconButton.iconSize, 30); // 50 * 0.6
    });

    testWidgets('button is present and tappable with non-empty text',
        (tester) async {
      await tester.pumpWidget(buildTestWidget(text: 'Some text'));

      final buttonFinder = find.byType(IconButton);
      expect(buttonFinder, findsOneWidget);

      // Tap should not throw (TTSService.instance.speak will fail
      // in test env, but the widget catches errors gracefully).
      await tester.tap(buttonFinder);
      await tester.pump();

      // After tap, widget should still be in the tree (no crash).
      expect(find.byType(TTSPlayButton), findsOneWidget);
    });

    testWidgets('tapping with empty text does nothing', (tester) async {
      await tester.pumpWidget(buildTestWidget(text: ''));

      await tester.tap(find.byType(IconButton));
      await tester.pump();

      // Still showing volume icon (no loading spinner).
      expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);
    });

    testWidgets('tapping with whitespace-only text does nothing',
        (tester) async {
      await tester.pumpWidget(buildTestWidget(text: '   '));

      await tester.tap(find.byType(IconButton));
      await tester.pump();

      // Still showing volume icon, not loading.
      expect(find.byIcon(Icons.volume_up_rounded), findsOneWidget);
    });
  });
}
