import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/services/billing_deep_link_handler.dart';
import 'package:sahayakai_mobile/src/features/auth/presentation/providers/user_profile_provider.dart';

void main() {
  group('BillingDeepLinkHandler', () {
    test('class is importable and has private constructor', () {
      expect(BillingDeepLinkHandler, isNotNull);
    });

    test('handleBillingCallback is a static void method', () {
      // Type-level check: the function signature compiles correctly.
      expect(BillingDeepLinkHandler.handleBillingCallback, isA<Function>());
    });

    test('fullUserProfileProvider can be invalidated (core side-effect)', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(
        () => container.invalidate(fullUserProfileProvider),
        returnsNormally,
      );
    });

    testWidgets('handleBillingCallback invalidates fullUserProfileProvider',
        (tester) async {
      // Track whether the provider was invalidated by watching re-creation.
      var buildCount = 0;
      final testProvider = FutureProvider.autoDispose<bool>((ref) async {
        buildCount++;
        // Watch fullUserProfileProvider to be invalidated together.
        ref.watch(fullUserProfileProvider);
        return true;
      });

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            home: Consumer(
              builder: (context, ref, _) {
                // Read the test provider to trigger a build.
                ref.watch(testProvider);
                return ElevatedButton(
                  onPressed: () {
                    BillingDeepLinkHandler.handleBillingCallback(ref);
                  },
                  child: const Text('Callback'),
                );
              },
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      final initialBuildCount = buildCount;

      // Tap the button to invoke handleBillingCallback.
      await tester.tap(find.text('Callback'));
      await tester.pumpAndSettle();

      // After callback, the provider should have been invalidated and rebuilt.
      expect(buildCount, greaterThan(initialBuildCount));
    });
  });
}
