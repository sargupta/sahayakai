import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/platform/share_service.dart';
import 'package:sahayakai/features/parent_message/presentation/widgets/parent_message_result_view.dart';
import 'package:sahayakai/shared/widgets/ai_text.dart';
import 'package:sahayakai/shared/widgets/empty_view.dart';

import 'parent_message_fixtures.dart';

/// Result-layer composition for the Parent Message tool: the language / word
/// meta, the parent-facing message body rendered with the Indic-safe metrics,
/// and the two result actions that are the point of the screen — copy and
/// share. Proves the copy writes the system clipboard, the share hands the
/// exact message to the (faked) share service without popping a real sheet, and
/// nothing overflows at 360dp x textScale 1.3 in light + dark.
void main() {
  testWidgets('renders the meta and the message body through AiText',
      (tester) async {
    final message = buildMessage();
    await tester.pumpWidget(hostResult(
      ParentMessageResultView(message: message),
    ));
    await tester.pumpAndSettle();

    // Meta badges: the language code and the word count.
    expect(find.text('ta-IN'), findsOneWidget);
    expect(find.text('42 words'), findsOneWidget);

    // The message body renders through AiText (the Tamil message from an English
    // UI), and the message list must NOT introduce a horizontal scroller.
    expect(find.byType(AiText), findsOneWidget);
    final horizontal = find.byWidgetPredicate(
      (w) => w is Scrollable && w.axisDirection == AxisDirection.right,
    );
    expect(horizontal, findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'the message uses the Indic-safe prose style (height >= 1.7, height '
      'behaviour applied) so a Tamil message from an English UI shapes',
      (tester) async {
    await tester.pumpWidget(hostResult(
      ParentMessageResultView(message: buildMessage()),
    ));
    await tester.pumpAndSettle();

    final bodyText = tester.widget<Text>(
      find.descendant(of: find.byType(AiText), matching: find.byType(Text)),
    );
    expect(bodyText.style?.height, greaterThanOrEqualTo(1.7));
    // The top matra / bottom vowel sign must not be cropped (DESIGN_RUBRIC §12.4).
    expect(bodyText.textHeightBehavior?.applyHeightToFirstAscent, isTrue);
    expect(bodyText.textHeightBehavior?.applyHeightToLastDescent, isTrue);
  });

  testWidgets('Copy writes the drafted message to the system clipboard',
      (tester) async {
    final message = buildMessage();

    // Intercept the platform clipboard channel so nothing touches the real OS
    // pasteboard, and capture what Copy set.
    final copied = <MethodCall>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') copied.add(call);
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );

    await tester.pumpWidget(hostResult(
      ParentMessageResultView(message: message),
    ));
    await tester.pumpAndSettle();

    final copyButton = find.widgetWithText(FilledButton, 'Copy');
    await tester.ensureVisible(copyButton);
    await tester.tap(copyButton);
    await tester.pumpAndSettle();

    expect(copied, hasLength(1));
    expect(
      (copied.single.arguments as Map)['text'],
      message.message,
    );
    // The teacher gets clear feedback that it copied.
    expect(find.text('Message copied'), findsOneWidget);
  });

  testWidgets('Share hands the exact message to the share service (faked)',
      (tester) async {
    final message = buildMessage();
    final calls = <({String text, String? subject})>[];

    await tester.pumpWidget(hostResult(
      ParentMessageResultView(message: message),
      overrides: [
        shareServiceProvider.overrideWithValue(FakeShareService(calls)),
      ],
    ));
    await tester.pumpAndSettle();

    final shareButton = find.widgetWithText(FilledButton, 'Share');
    await tester.ensureVisible(shareButton);
    await tester.tap(shareButton);
    await tester.pumpAndSettle();

    // The real OS sheet never opened; the fake recorded exactly the message the
    // teacher reviewed.
    expect(calls, hasLength(1));
    expect(calls.single.text, message.message);
  });

  testWidgets('a blank message shows the dignified empty state', (tester) async {
    await tester.pumpWidget(hostResult(
      ParentMessageResultView(message: buildMessage(empty: true)),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(EmptyView), findsOneWidget);
    expect(find.textContaining('No message came back'), findsOneWidget);
    // No actions on an empty result.
    expect(find.widgetWithText(FilledButton, 'Copy'), findsNothing);
    expect(find.widgetWithText(FilledButton, 'Share'), findsNothing);
  });

  group('overflow gates (DESIGN_RUBRIC §12.9, §12.10, §12.11, §12.13)', () {
    for (final brightness in Brightness.values) {
      for (final scale in <double>[1.0, 1.3]) {
        testWidgets(
          'result renders at 360dp, textScale $scale, ${brightness.name}',
          (tester) async {
            tester.view.physicalSize = kNarrowPhone;
            tester.view.devicePixelRatio = 1.0;
            addTearDown(tester.view.reset);

            await tester.pumpWidget(
              hostResult(
                ParentMessageResultView(message: buildMessage()),
                brightness: brightness,
                textScale: scale,
              ),
            );
            await tester.pumpAndSettle();

            expect(tester.takeException(), isNull);
            expect(find.byType(AiText), findsOneWidget);
          },
        );
      }
    }
  });
}
