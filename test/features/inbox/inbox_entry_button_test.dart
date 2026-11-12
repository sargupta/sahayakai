import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/inbox/data/block_c_transport.dart';
import 'package:sahayakai/features/inbox/data/messages_stream_provider.dart';
import 'package:sahayakai/features/inbox/presentation/widgets/inbox_entry_button.dart';

/// Home's messages icon: the unread count must be legible on the warm wash —
/// white on solid saffron, not tinted text on a tint.
void main() {
  Future<void> pump(WidgetTester tester, int unread) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          unreadConversationsProvider.overrideWith(
            (ref) => Stream.value(TransportSnapshot<int>.ready(unread)),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: Center(child: InboxEntryButton())),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('unread shows a white count on a solid saffron pill', (
    tester,
  ) async {
    await pump(tester, 3);

    final badge = find.byKey(const ValueKey('inbox-unread-badge'));
    expect(badge, findsOneWidget);
    final box = tester.widget<Container>(badge).decoration! as BoxDecoration;
    expect(box.color, AppColors.accentFill);
    final label = tester.widget<Text>(
      find.descendant(of: badge, matching: find.text('3')),
    );
    expect(label.style?.color, AppColors.textOnAccent);
    expect(find.bySemanticsLabel('3 unread'), findsOneWidget);
  });

  testWidgets('nothing unread shows the plain glyph', (tester) async {
    await pump(tester, 0);
    expect(find.byKey(const ValueKey('inbox-unread-badge')), findsNothing);
  });
}
