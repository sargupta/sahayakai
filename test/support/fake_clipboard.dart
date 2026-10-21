import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

/// Intercepts the platform clipboard channel for the duration of one test and
/// returns the calls it received, newest last.
///
/// THIS IS NOT CEREMONY, for two reasons.
///
/// 1. Without it a copy really would reach the developer's OS pasteboard.
/// 2. `Clipboard.setData` is a platform round-trip. Under a widget test's fake
///    async an UNMOCKED round-trip never completes, so any handler that awaits
///    it (as the result action bar does, so the "Copied" confirmation follows
///    the write rather than merely preceding it) hangs and its snackbar never
///    appears — the failure looks like a missing snackbar and is really a
///    missing mock. Registering a handler makes the reply land inside fake
///    async, and as a bonus the exact copied text becomes assertable.
///
/// The handler is torn down with the test.
List<MethodCall> interceptClipboard(WidgetTester tester) {
  final calls = <MethodCall>[];
  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
    SystemChannels.platform,
    (call) async {
      if (call.method == 'Clipboard.setData') calls.add(call);
      return null;
    },
  );
  addTearDown(
    () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      null,
    ),
  );
  return calls;
}
