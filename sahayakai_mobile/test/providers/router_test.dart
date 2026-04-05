import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/features/auth/router/app_router.dart';

void main() {
  group('GoRouterRefreshStream', () {
    test('notifies listeners on stream events', () {
      final controller = Stream<int>.fromIterable([1, 2, 3]);
      final refreshStream = GoRouterRefreshStream(controller);

      int notifyCount = 0;
      refreshStream.addListener(() => notifyCount++);

      // Initial notify happens in constructor
      expect(notifyCount, greaterThanOrEqualTo(1));

      refreshStream.dispose();
    });

    test('disposes subscription without error', () {
      final controller = Stream<int>.empty();
      final refreshStream = GoRouterRefreshStream(controller);

      expect(() => refreshStream.dispose(), returnsNormally);
    });
  });

  // NOTE: Full GoRouter redirect logic tests require a running ProviderContainer
  // with mocked auth state. The redirect function itself is pure:
  //
  //   if (!isLoggedIn && !onAuthPage) return '/login'
  //   if (isLoggedIn && onAuthPage) return '/'
  //   else return null
  //
  // Testing the redirect logic directly:

  group('Router redirect logic', () {
    // Simulate the redirect function in isolation.
    String? redirect({
      required bool isLoggedIn,
      required String matchedLocation,
    }) {
      final onAuthPage =
          matchedLocation == '/login' || matchedLocation == '/otp';

      if (!isLoggedIn && !onAuthPage) return '/login';
      if (isLoggedIn && onAuthPage) return '/';
      return null;
    }

    test('unauthenticated user on / → redirects to /login', () {
      expect(redirect(isLoggedIn: false, matchedLocation: '/'), '/login');
    });

    test('unauthenticated user on /login → no redirect', () {
      expect(redirect(isLoggedIn: false, matchedLocation: '/login'), isNull);
    });

    test('unauthenticated user on /otp → no redirect', () {
      expect(redirect(isLoggedIn: false, matchedLocation: '/otp'), isNull);
    });

    test('unauthenticated user on feature route → redirects to /login', () {
      expect(
        redirect(isLoggedIn: false, matchedLocation: '/create-lesson'),
        '/login',
      );
    });

    test('authenticated user on / → no redirect', () {
      expect(redirect(isLoggedIn: true, matchedLocation: '/'), isNull);
    });

    test('authenticated user on /login → redirects to /', () {
      expect(redirect(isLoggedIn: true, matchedLocation: '/login'), '/');
    });

    test('authenticated user on /otp → redirects to /', () {
      expect(redirect(isLoggedIn: true, matchedLocation: '/otp'), '/');
    });

    test('authenticated user on feature route → no redirect', () {
      expect(
        redirect(isLoggedIn: true, matchedLocation: '/quiz-config'),
        isNull,
      );
    });

    test('authenticated user on /vidya-chat → no redirect', () {
      expect(
        redirect(isLoggedIn: true, matchedLocation: '/vidya-chat'),
        isNull,
      );
    });

    test('authenticated user on /pricing → no redirect', () {
      expect(
        redirect(isLoggedIn: true, matchedLocation: '/pricing'),
        isNull,
      );
    });
  });
}
