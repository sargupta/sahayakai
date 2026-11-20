import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/features/settings/presentation/sources_screen.dart';

class _FakeOpener extends LinkOpener {
  _FakeOpener(this.result);

  final bool result;
  final opened = <Uri>[];

  @override
  Future<bool> open(Uri url) async {
    opened.add(url);
    return result;
  }
}

Future<_FakeOpener> _pump(WidgetTester tester, {bool opens = true}) async {
  final opener = _FakeOpener(opens);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [linkOpenerProvider.overrideWithValue(opener)],
      child: const MaterialApp(home: SourcesScreen()),
    ),
  );
  return opener;
}

void main() {
  test(
    'every official source is an https government (.gov.in / .nic.in) link',
    () {
      for (final source in officialSources) {
        final uri = Uri.parse(source.url);
        expect(uri.scheme, 'https', reason: source.url);
        expect(
          uri.host.endsWith('.gov.in') || uri.host.endsWith('.nic.in'),
          isTrue,
          reason: source.url,
        );
      }
    },
  );

  testWidgets('says it is not a government app and lists the sources', (
    tester,
  ) async {
    await _pump(tester);
    expect(find.text('Not a government app'), findsOneWidget);
    expect(find.textContaining('not affiliated with'), findsOneWidget);
    expect(find.text('https://ncert.nic.in/textbook.php'), findsOneWidget);
  });

  testWidgets('tapping a source opens exactly that link once', (tester) async {
    final opener = await _pump(tester);
    await tester.tap(find.text('https://ncert.nic.in/textbook.php'));
    await tester.pump();
    expect(opener.opened, [Uri.parse('https://ncert.nic.in/textbook.php')]);
  });

  testWidgets('copies the link and says so when no browser opens', (
    tester,
  ) async {
    final copied = <Object?>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') copied.add(call.arguments);
        return null;
      },
    );
    await _pump(tester, opens: false);
    await tester.tap(find.text('https://ncert.nic.in/textbook.php'));
    await tester.pumpAndSettle();
    expect(copied, [
      {'text': 'https://ncert.nic.in/textbook.php'},
    ]);
    expect(find.textContaining('Link copied'), findsOneWidget);
  });
}
