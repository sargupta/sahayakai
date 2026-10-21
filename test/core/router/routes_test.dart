import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/router/routes.dart';

/// The `?next=` contract behind [Routes.loginWithReturnTo].
///
/// A signed-out state that offers "Sign in" has exactly two jobs: get the
/// teacher authenticated, and put them back where they were. The second job is
/// what this locks down — the router's redirect preserves `?next=` when it
/// bounces an expired session off a protected route, but a hand-written
/// `push(Routes.login)` silently discards it, dumping the teacher into
/// first-run onboarding after a successful sign-in with no obvious way back.
void main() {
  group('Routes.loginWithReturnTo', () {
    test('carries the destination as a next query parameter', () {
      expect(
        Routes.loginWithReturnTo(Routes.attendance),
        '/login?next=%2Fattendance',
      );
    });

    test('percent-encodes a path with an id so it stays one query value', () {
      // An unencoded `&` or `?` inside the destination would split the query:
      // `?next=/my-library/a&b?c` would parse `b` as a second parameter and
      // truncate the destination, sending the teacher somewhere they never
      // asked for after a successful sign-in.
      final uri = Uri.parse(
        Routes.loginWithReturnTo(Routes.libraryDetailPath('a&b?c')),
      );

      expect(uri.path, Routes.login);
      expect(uri.queryParameters.keys, ['next']);
      expect(uri.queryParameters['next'], Routes.libraryDetailPath('a&b?c'));
    });

    test('round-trips through the query the login screen reads', () {
      // `login_screen.dart` resolves with `destinationFor(next)`, and the
      // router redirect hands the same value straight back to go_router — so
      // the encoding has to survive a decode, not just look right.
      const destination = '/my-library';
      final decoded = Uri.parse(
        Routes.loginWithReturnTo(destination),
      ).queryParameters['next'];

      expect(decoded, destination);
    });
  });

  group('login stays reachable while signed out', () {
    test('is a public path, so the guard cannot loop on it', () {
      // If /login were not public, the guard would bounce the teacher straight
      // back to /login?next=/login and they could never sign in.
      expect(Routes.publicPaths, contains(Routes.login));
    });
  });
}
