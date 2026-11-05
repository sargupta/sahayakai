import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/parent_hotline/presentation/hotline_copy.dart';

/// The hotline's error copy: translated, never the server's text, and the
/// assistant's wording only for the AI draft.
void main() {
  final l10n = lookupAppLocalizations(const Locale('en'));
  const server = ApiException(
    ApiErrorKind.server,
    'Service Unavailable',
    statusCode: 503,
  );

  test(
    'a 5xx on a class list / evidence / call never blames the assistant',
    () {
      expect(hotlineErrorText(l10n, server), l10n.parentHotlineGenericError);
      expect(hotlineErrorText(l10n, server), isNot(l10n.parentMessageBusy));
    },
  );

  test('a 5xx on the AI draft says the assistant is busy', () {
    expect(
      hotlineErrorText(l10n, server, drafting: true),
      l10n.parentMessageBusy,
    );
  });

  test('offline and sign-in read the same everywhere', () {
    const offline = ApiException(ApiErrorKind.network, 'No connection');
    const signedOut = ApiException(
      ApiErrorKind.unauthorized,
      'Unauthorized',
      statusCode: 401,
    );
    for (final drafting in [false, true]) {
      expect(
        hotlineErrorText(l10n, offline, drafting: drafting),
        l10n.parentHotlineErrorOffline,
      );
      expect(
        hotlineErrorText(l10n, signedOut, drafting: drafting),
        l10n.parentMessageSignIn,
      );
    }
  });

  test('a non-API failure is the generic line, never its message', () {
    expect(
      hotlineErrorText(l10n, StateError('boom')),
      l10n.parentHotlineGenericError,
    );
  });
}
