import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/features/inbox/presentation/inbox_time.dart';

/// Unit tests for the compact relative-time helper (U-SI1). Resolves the real
/// localized strings through the English delegate so the `{count}` placeholder
/// and the bucket boundaries are exercised end to end.
Future<AppLocalizations> _l10n(WidgetTester tester) async {
  late AppLocalizations l10n;
  await tester.pumpWidget(
    MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Builder(
        builder: (context) {
          l10n = AppLocalizations.of(context);
          return const SizedBox.shrink();
        },
      ),
    ),
  );
  return l10n;
}

void main() {
  final now = DateTime.parse('2026-07-19T12:00:00Z');

  String at(Duration ago) => now.subtract(ago).toIso8601String();

  testWidgets('buckets: now / minutes / hours / days / weeks', (tester) async {
    final l10n = await _l10n(tester);

    expect(
      inboxRelativeTime(at(const Duration(seconds: 5)), now, l10n),
      l10n.inboxTimeNow,
    );
    expect(
      inboxRelativeTime(at(const Duration(minutes: 5)), now, l10n),
      l10n.inboxTimeMinutes(5),
    );
    expect(
      inboxRelativeTime(at(const Duration(hours: 3)), now, l10n),
      l10n.inboxTimeHours(3),
    );
    expect(
      inboxRelativeTime(at(const Duration(days: 2)), now, l10n),
      l10n.inboxTimeDays(2),
    );
    expect(
      inboxRelativeTime(at(const Duration(days: 21)), now, l10n),
      l10n.inboxTimeWeeks(3),
    );
  });

  testWidgets('null / empty / unparseable → empty string (no fake time)', (
    tester,
  ) async {
    final l10n = await _l10n(tester);
    expect(inboxRelativeTime(null, now, l10n), '');
    expect(inboxRelativeTime('', now, l10n), '');
    expect(inboxRelativeTime('not-a-date', now, l10n), '');
  });

  testWidgets('a small forward clock skew clamps to "now" (never negative)', (
    tester,
  ) async {
    final l10n = await _l10n(tester);
    final future = now.add(const Duration(seconds: 8)).toIso8601String();
    expect(inboxRelativeTime(future, now, l10n), l10n.inboxTimeNow);
  });
}
