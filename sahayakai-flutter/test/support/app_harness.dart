import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sahayakai/app.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/core/platform/clock.dart';
import 'package:sahayakai/features/profile/data/profile_doc_source.dart';

import 'fake_api_client.dart';

/// Hosts the REAL app: the real `GoRouter`, the real redirect guard, the real
/// theme and the real l10n delegates.
///
/// Redirect behaviour is the thing under test for splash and login, and it
/// lives in `app_router.dart` — a hand-rolled router in the test would prove
/// only that the hand-rolled router works.
///
/// [overrides] MUST include an [apiClientOverride]: landing on the dashboard
/// mounts the recent-work section, which fires `GET /api/content/list`
/// immediately. Without a fake that is a live request to production from a unit
/// test. [harnessOverrides] bundles the safe defaults.
Widget appHarness({List<Override> overrides = const []}) {
  return ProviderScope(overrides: overrides, child: const SahayakApp());
}

/// The safe defaults every app-level test needs, plus whatever it is actually
/// testing. Both data seams are faked, so nothing can escape to the network.
List<Override> harnessOverrides({
  required List<Override> overrides,
  FakeApiClient? client,
  ProfileDocSource? docs,
}) {
  return [
    apiClientOverride(client ?? FakeApiClient()),
    profileDocSourceProvider.overrideWithValue(
      docs ?? const SignedOutProfileDocSource(),
    ),
    ...overrides,
  ];
}

/// Binds a fake API client, so no test ever opens a socket.
Override apiClientOverride(FakeApiClient client) =>
    apiClientProvider.overrideWithValue(client);

/// Binds a token so a plan claim can decode. Null models the current
/// signed-out stub.
Override tokenOverride(String? token) => tokenProviderProvider
    .overrideWithValue(({bool forceRefresh = false}) async => token);

/// Signs the auth controller in from the start (no credential exchange to
/// observe — the teacher is already signed in when the screen mounts).
Override signedInOverride() =>
    authControllerProvider.overrideWith(_SignedInAuth.new);

class _SignedInAuth extends AuthController {
  @override
  AuthStatus build() => AuthStatus.signedIn;

  /// The real [AuthController.signOut] is gated on `FirebaseInit.isConfigured`
  /// (always false here) and would otherwise no-op, leaving a "sign out"
  /// button's test unable to observe the router redirect it triggers. This
  /// fixture models a real, successful sign-out.
  @override
  Future<void> signOut() async {
    state = AuthStatus.signedOut;
  }
}

/// Starts signed OUT, and makes `signIn()` succeed without touching real
/// Firebase/Google — for the login screen's tests, which assert "everything
/// except the credential exchange" (the destination logic, the router
/// handoff): the real [AuthController.signIn] is gated on
/// `FirebaseInit.isConfigured` (always false in a widget test, since `main()`
/// never runs), so it always returns `false` there. This fake models a
/// SUCCESSFUL real exchange instead, so the screen's post-sign-in navigation
/// can actually be exercised.
Override signInSucceedsOverride() =>
    authControllerProvider.overrideWith(_SignInSucceedsAuth.new);

class _SignInSucceedsAuth extends AuthController {
  @override
  AuthStatus build() => AuthStatus.signedOut;

  @override
  Future<bool> signIn() async {
    state = AuthStatus.signedIn;
    return true;
  }
}

/// A controllable stand-in for the first-run bootstrap (what becomes
/// `Firebase.initializeApp` + `FirebaseAppCheck.activate` + the first auth
/// snapshot).
///
/// The router parks on `/splash` until this resolves, so it is the only lever
/// that decides whether a redirect happens at all.
class FakeBootstrap {
  FakeBootstrap({this.error, this.pending = false});

  /// Thrown to model a failed init: no network for App Check's Play Integrity
  /// handshake, which is the realistic rural failure.
  Object? error;

  /// Never completes, so the "still booting" state can be observed.
  bool pending;

  /// How many times the bootstrap ran. The splash's retry re-runs it, and that
  /// is the only way to tell a real retry from a repaint.
  int calls = 0;

  Future<void> call(Ref ref) async {
    calls += 1;
    if (pending) return Completer<void>().future;
    if (error != null) throw error!;
  }
}

/// Replaces the 600ms simulated bootstrap with something a test controls.
Override bootstrapOverride(FakeBootstrap fake) =>
    appBootstrapProvider.overrideWith(fake.call);

/// A fixed instant so the time-of-day greeting is deterministic. 10:00 renders
/// "Good morning" in every locale. Without this the baselines silently encode
/// whatever hour they were generated in — which is exactly how the first set
/// captured "evening" and went red after midnight.
Override fixedClock() =>
    nowProvider.overrideWithValue(() => DateTime(2026, 1, 1, 10));
