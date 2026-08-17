import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_client.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/platform/link_opener.dart';
import 'package:sahayakai/core/platform/share_service.dart';
import 'package:sahayakai/core/router/routes.dart';
import 'package:sahayakai/core/theme/app_theme.dart';
import 'package:sahayakai/features/settings/domain/account_deletion.dart';
import 'package:sahayakai/features/settings/presentation/settings_controller.dart';
import 'package:sahayakai/features/settings/presentation/settings_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import 'settings_fixtures.dart';

/// Money/data-integrity gate: what happens right AFTER `POST
/// /api/user/delete-account` succeeds.
///
/// The old code just showed a SnackBar and left the teaching-profile form and
/// its Save button fully live — `authStateChanges()` can take up to an hour to
/// notice a server-side deletion, so waiting on it left a real window where a
/// scheduled-for-deletion account could still save profile edits. It also
/// rendered the server's `exportUrl` as an external-browser-tab link
/// (`linkOpenerProvider`, `LaunchMode.externalApplication`), which 401ed for
/// essentially every teacher: that tab carries neither the Bearer token the
/// export route's middleware requires nor the web-only session cookie it also
/// accepts.
///
/// These pin the fixed contract: the teacher sees a one-time confirmation with
/// a real export action (when the server sent one) that goes through the
/// SAME authenticated `ApiClient` every other screen uses — never the
/// external browser tab — and dismissing the dialog signs them out
/// immediately and leaves Settings for Login, not a wait on the auth stream.
void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  GoRouter testRouter() => GoRouter(
    initialLocation: Routes.settings,
    routes: [
      GoRoute(path: Routes.settings, builder: (_, _) => const SettingsScreen()),
      GoRoute(
        path: Routes.login,
        builder: (_, _) =>
            const Scaffold(body: Center(child: Text('LOGIN SCREEN'))),
      ),
    ],
  );

  Widget host({required List<Override> overrides}) {
    return ProviderScope(
      overrides: overrides,
      child: MaterialApp.router(
        theme: AppTheme.light(),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: testRouter(),
      ),
    );
  }

  /// Opens the interlock dialog, types the confirm word and taps the
  /// destructive confirm button — the same path a teacher follows.
  ///
  /// The Danger group is the 5th (last) top-level group. `ListView(children:
  /// ...)` still builds its Slivers lazily against the viewport + cache
  /// extent — a pre-built `List<Widget>` does not mean every child already
  /// has a live Element — so at the test surface's default height the
  /// button's Element genuinely does not exist yet. `ensureVisible` cannot
  /// scroll to a widget that has no Element to find; `scrollUntilVisible`
  /// drags the list itself (which does not need the target to exist yet)
  /// between each check.
  Future<void> confirmDeleteDialog(WidgetTester tester) async {
    await tester.pumpAndSettle();
    final trigger = find.widgetWithText(OutlinedButton, 'Delete account');
    await tester.scrollUntilVisible(
      trigger,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();
    await tester.tap(trigger);
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'DELETE');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete account'));
    await tester.pumpAndSettle();
  }

  testWidgets(
    'success WITH an exportPath: the export action calls POST /api/export '
    'through the authenticated ApiClient and hands the archive to the '
    'share sheet — NOT the external-browser-tab link opener — and Done '
    'signs out + leaves Settings for Login',
    (tester) async {
      final opener = _FakeLinkOpener();
      final apiClient = FakeApiClient(
        postRawResponse: RawResponse(
          bytes: Uint8List.fromList([1, 2, 3]),
          contentType: 'application/zip',
          filename: 'sahayakai_export_2026-07-28.zip',
        ),
      );
      final shareCalls =
          <({Uint8List bytes, String filename, String? mimeType})>[];
      await tester.pumpWidget(
        host(
          overrides: [
            signedInOverride(),
            profileDocOverride(doc: const <String, dynamic>{}),
            deleteAccountControllerProvider.overrideWith(
              _FakeDeleteSuccess.new,
            ),
            // Still overridden and asserted on below: proves the OLD
            // external-browser-tab behaviour is genuinely gone, not just
            // unreferenced by coincidence.
            linkOpenerProvider.overrideWithValue(opener),
            apiClientProvider.overrideWithValue(apiClient),
            shareServiceProvider.overrideWithValue(
              _FakeShareService(shareCalls),
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await confirmDeleteDialog(tester);

      // The one-time confirmation, with a real, working export action.
      expect(find.text('Account scheduled for deletion'), findsOneWidget);
      // Two legitimate renders of the same copy, not a duplication bug: the
      // danger section's own body text switches to this exact copy the instant
      // `scheduled` flips true (correct, reactive UI), and the modal
      // confirmation shows the identical sentence on top of it.
      expect(
        find.text(
          'Your account is scheduled for deletion. You have 30 days to export your work.',
        ),
        findsAtLeastNWidgets(1),
      );
      final exportButton = find.widgetWithText(
        OutlinedButton,
        'Export my data',
      );
      expect(exportButton, findsOneWidget);

      await tester.tap(exportButton);
      await tester.pumpAndSettle();

      // The real trigger: an authenticated POST to the server-supplied path,
      // through the SAME ApiClient every other screen uses.
      expect(apiClient.postRaws.single.path, '/api/export');
      // The returned archive went to the OS share sheet...
      expect(shareCalls, hasLength(1));
      expect(shareCalls.single.filename, 'sahayakai_export_2026-07-28.zip');
      expect(shareCalls.single.mimeType, 'application/zip');
      // ...and the old external-browser-tab path was never touched.
      expect(opener.opened, isEmpty);

      // Settings is still open until the teacher dismisses the dialog — the
      // profile form and Save button underneath must not be reachable through
      // the dialog's modal barrier.
      expect(find.byType(SettingsScreen), findsOneWidget);

      await tester.tap(find.widgetWithText(FilledButton, 'Done'));
      await tester.pumpAndSettle();

      // Immediate local sign-out + navigation, not a wait on authStateChanges.
      expect(find.byType(SettingsScreen), findsNothing);
      expect(find.text('LOGIN SCREEN'), findsOneWidget);
    },
  );

  testWidgets('the export button is disabled (spinner) while the request is in '
      'flight, and Done cannot be tapped out from under it', (tester) async {
    final apiClient = FakeApiClient(
      postRawResponse: RawResponse(
        bytes: Uint8List.fromList([1, 2, 3]),
        contentType: 'application/zip',
      ),
      delay: const Duration(milliseconds: 200),
    );
    await tester.pumpWidget(
      host(
        overrides: [
          signedInOverride(),
          profileDocOverride(doc: const <String, dynamic>{}),
          deleteAccountControllerProvider.overrideWith(_FakeDeleteSuccess.new),
          linkOpenerProvider.overrideWithValue(_FakeLinkOpener()),
          apiClientProvider.overrideWithValue(apiClient),
          shareServiceProvider.overrideWithValue(_FakeShareService([])),
        ],
      ),
    );
    await tester.pumpAndSettle();

    await confirmDeleteDialog(tester);

    final exportButtonFinder = find.widgetWithText(
      OutlinedButton,
      'Export my data',
    );
    await tester.tap(exportButtonFinder);
    await tester.pump();

    // Still the same button (same label), now mid-request: showing a
    // spinner in the icon slot and un-tappable.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    final exportButton = tester.widget<OutlinedButton>(exportButtonFinder);
    expect(
      exportButton.onPressed,
      isNull,
      reason:
          'export button must be disabled while the request is in '
          'flight',
    );

    final doneButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Done'),
    );
    expect(
      doneButton.onPressed,
      isNull,
      reason:
          'Done must not be tappable mid-export, or the teacher would '
          'be signed out and navigated away from their own download',
    );

    // Let the in-flight request resolve so the pending timer does not leak
    // into the next test.
    await tester.pumpAndSettle();
  });

  testWidgets(
    'success with NO exportPath: confirmation shows without an export '
    'button, Done still signs out and leaves Settings',
    (tester) async {
      await tester.pumpWidget(
        host(
          overrides: [
            signedInOverride(),
            profileDocOverride(doc: const <String, dynamic>{}),
            deleteAccountControllerProvider.overrideWith(
              _FakeDeleteSuccessNoExport.new,
            ),
            linkOpenerProvider.overrideWithValue(_FakeLinkOpener()),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await confirmDeleteDialog(tester);

      expect(find.text('Account scheduled for deletion'), findsOneWidget);
      expect(
        find.widgetWithText(OutlinedButton, 'Export my data'),
        findsNothing,
      );

      await tester.tap(find.widgetWithText(FilledButton, 'Done'));
      await tester.pumpAndSettle();

      expect(find.byType(SettingsScreen), findsNothing);
      expect(find.text('LOGIN SCREEN'), findsOneWidget);
    },
  );

  testWidgets(
    'a failed delete (reauth required) shows the error, no dialog, no '
    'sign-out, Settings stays put',
    (tester) async {
      // No override on deleteAccountControllerProvider: the REAL controller
      // runs, and FirebaseInit.isConfigured is always false in a widget test,
      // so this exercises the honest early-exit every device hits if Firebase
      // itself is unavailable — the same path settings_controller_test.dart
      // pins at the provider layer.
      await tester.pumpWidget(
        host(
          overrides: [
            signedInOverride(),
            profileDocOverride(doc: const <String, dynamic>{}),
            linkOpenerProvider.overrideWithValue(_FakeLinkOpener()),
          ],
        ),
      );
      await tester.pumpAndSettle();

      await confirmDeleteDialog(tester);

      expect(find.text('Please sign in again'), findsOneWidget);
      expect(find.text('Account scheduled for deletion'), findsNothing);
      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(find.text('LOGIN SCREEN'), findsNothing);
    },
  );
}

class _FakeDeleteSuccess extends DeleteAccountController {
  @override
  Future<void> confirmDelete() async {
    state = const AsyncValue<AccountDeletion?>.data(
      AccountDeletion(exportPath: '/api/export'),
    );
  }
}

class _FakeDeleteSuccessNoExport extends DeleteAccountController {
  @override
  Future<void> confirmDelete() async {
    state = const AsyncValue<AccountDeletion?>.data(AccountDeletion());
  }
}

/// Records what the app tried to open instead of hitting a platform channel.
/// Every test in this suite that shows the export button overrides
/// `linkOpenerProvider` with this AND asserts `opened` stays empty — the
/// regression pin for "the old external-browser-tab path never fires again".
class _FakeLinkOpener implements LinkOpener {
  final List<Uri> opened = <Uri>[];

  @override
  Future<bool> open(Uri url) async {
    opened.add(url);
    return true;
  }
}

/// Records what the app asked to share as a file, instead of popping the real
/// OS share sheet (a native channel call a widget test can neither drive nor
/// dismiss).
class _FakeShareService extends ShareService {
  const _FakeShareService(this.calls);

  final List<({Uint8List bytes, String filename, String? mimeType})> calls;

  @override
  Future<void> shareFile(
    Uint8List bytes, {
    required String filename,
    String? mimeType,
  }) async {
    calls.add((bytes: bytes, filename: filename, mimeType: mimeType));
  }
}
