/// # Block C transport contract — shared primitives (U-SI0)
///
/// Block C is the two "network" pillars — **Staffroom** (Pillar 04) and the
/// **Pro Inbox** (Pillar 05) — which the web implements with **two transports the
/// current Flutter app cannot speak**:
///
///   1. **Next.js server actions** (`"use server"`) for every write + every
///      server-derived read. These are RPC over the Next server-action wire
///      format, **not** REST — Dio cannot invoke them. The backend must expose
///      thin REST wrappers (`/api/community/*`, `/api/messages/*`,
///      `/api/connections/*`, `/api/notifications/*`) that reuse the existing
///      action authz/validation/transactions verbatim (see `docs/flutter/HANDOFF.md`).
///   2. **Direct client Firestore `onSnapshot` + one RTDB `onValue`** for the
///      realtime surfaces (inbox list, thread tail, staff-room/group chat, unread
///      badges, presence). These need `firebase_core` + `cloud_firestore`
///      (+ `firebase_database` for presence) — **none of which is in
///      `pubspec.yaml`**.
///
/// U-SI0 does **not** add any Firebase package (adding one breaks
/// `flutter build apk` without `google-services.json`). Instead it lands the
/// **seam**: the transport interfaces below define the stable contract that
/// U-SI1..U-SI6 build their UI against, a [DeferredInboxTransport]-style default
/// implementation keeps every surface in a well-typed "awaiting Firebase" state
/// (so screens render their `EmptyView`/`ErrorView` on-device and stay
/// widget-testable via a fake), and the real `cloud_firestore` + REST-wrapper
/// implementation drops in later behind the founder/backend handoff — with **no
/// change** to the interface or the UI.
///
/// This file holds the primitives shared by both the inbox and staffroom
/// transports. It lives under `features/inbox/` (Pillar 05, the first consumer —
/// U-SI1) and is imported by `features/staffroom/`; Block C is one logical block
/// spanning the two feature folders.
library;

import 'package:flutter/foundation.dart';

/// The lifecycle state of a realtime read stream (the `onSnapshot`/`onValue`
/// equivalent). Every Block-C live-read stream emits a [TransportSnapshot]
/// carrying one of these so the UI can pick the right surface:
///
///   - [awaitingFirebase] → the transport seam is not wired to Firebase yet
///     (the current default). UI renders the pillar's "coming soon" `EmptyView`.
///   - [signedOut]        → no authenticated user. UI renders the signed-out
///     `EmptyView` (the DM-gate copy for the inbox).
///   - [loading]          → first snapshot has not resolved yet. UI renders an
///     `AppSkeleton`.
///   - [ready]            → live data (possibly an empty list — a genuinely empty
///     inbox). UI renders the list, or the empty-list `EmptyView`.
///   - [error]            → the listener failed (missing composite index /
///     permission-denied on the inbox & notification queries — the web shipped a
///     hang here twice). UI **must** render an `ErrorView` with retry, never an
///     infinite spinner. [TransportSnapshot.error] carries the cause.
enum TransportState {
  awaitingFirebase,
  signedOut,
  loading,
  ready,
  error,
}

/// A realtime read result: the [state] of the underlying listener plus the last
/// [data] it produced. Immutable and value-equal so a Riverpod `StreamProvider`
/// does not thrash the auto-scroll / rebuild effects on identical snapshots.
///
/// The live-read streams are typed `Stream<TransportSnapshot<T>>` (rather than a
/// bare `Stream<T>`) precisely so the deferred seam can emit
/// `TransportSnapshot.awaitingFirebase(const [])` — an empty payload **and** a
/// state marker — and the real Firestore impl can emit `.ready(list)` /
/// `.error(e)` off the same contract.
@immutable
class TransportSnapshot<T> {
  const TransportSnapshot({
    required this.state,
    required this.data,
    this.error,
  });

  /// A resolved live snapshot with real data.
  const TransportSnapshot.ready(this.data)
      : state = TransportState.ready,
        error = null;

  /// The default seam state: no Firebase wired, empty payload.
  const TransportSnapshot.awaitingFirebase(this.data)
      : state = TransportState.awaitingFirebase,
        error = null;

  /// No authenticated user — the participant-scoped queries cannot run.
  const TransportSnapshot.signedOut(this.data)
      : state = TransportState.signedOut,
        error = null;

  /// First snapshot pending.
  const TransportSnapshot.loading(this.data)
      : state = TransportState.loading,
        error = null;

  /// The listener errored (missing index / permission-denied / network). [data]
  /// is the last-known payload (usually empty); [error] is the cause.
  const TransportSnapshot.error(this.data, this.error)
      : state = TransportState.error;

  final TransportState state;
  final T data;

  /// The failure cause when [state] is [TransportState.error]; else null.
  final Object? error;

  bool get isReady => state == TransportState.ready;
  bool get isAwaitingFirebase => state == TransportState.awaitingFirebase;
  bool get isSignedOut => state == TransportState.signedOut;
  bool get isLoading => state == TransportState.loading;
  bool get hasError => state == TransportState.error;

  /// True while the surface is not showing live data for a reason the UI must
  /// surface as an `EmptyView` (not a spinner, not an error). Both the
  /// unconfigured seam and the signed-out state are "empty, on purpose".
  bool get isEmptyByDesign => isAwaitingFirebase || isSignedOut;

  // No `copyWith`: state transitions go through the named constructors
  // (`ready` / `error` / `awaitingFirebase` / `signedOut`), which each set
  // `error` correctly — crucially, `ready`/`awaitingFirebase`/`signedOut` clear
  // it. A `copyWith(state: ready)` that defaulted `error: error ?? this.error`
  // would silently RETAIN a stale error object across an error→ready transition
  // (a latent trap for the live Firestore impl); the constructors make that
  // impossible.

  @override
  bool operator ==(Object other) =>
      other is TransportSnapshot<T> &&
      other.state == state &&
      other.error == error &&
      _dataEquals(other.data, data);

  @override
  int get hashCode => Object.hash(state, error, _dataHash(data));

  /// Value-equality for the common `List` payloads (so an unchanged inbox list
  /// snapshot compares equal and does not rebuild); falls back to `==` for
  /// scalar payloads (`int` unread counts).
  static bool _dataEquals(Object? a, Object? b) {
    if (a is List && b is List) return listEquals(a, b);
    return a == b;
  }

  static int _dataHash(Object? data) {
    if (data is List) return Object.hashAll(data);
    return data.hashCode;
  }

  @override
  String toString() => 'TransportSnapshot($state, data: $data, error: $error)';
}

/// The reason a Block-C transport surface is unavailable — the typed failure the
/// deferred seam raises from **every write** and the real impl raises for auth /
/// wiring gaps. UI branches on [kind] rather than string-matching.
enum TransportUnavailableKind {
  /// No Firebase project / `google-services.json` is wired into the app yet —
  /// the entire block is gated (the current default). This is the founder
  /// handoff wall, not a user-facing error: writes should be disabled in the UI,
  /// not attempted.
  awaitingFirebase,

  /// The backend REST wrapper for this server action does not exist yet — the
  /// write has nowhere to go (cross-repo backend task).
  restWrapperMissing,

  /// No authenticated user; the write cannot be attributed.
  signedOut,
}

/// Thrown by a transport write (or a one-shot read) that cannot complete because
/// the Block-C seam is not live. Typed so U-SI1..U-SI6 can render a disabled /
/// "coming soon" affordance uniformly (mirrors how the parent-hotline layer maps
/// transport errors to a branchable domain error).
///
/// The **deferred** implementation throws this from every write with
/// [TransportUnavailableKind.awaitingFirebase]. The **real** implementation
/// throws it only for genuine auth/wiring gaps and lets real `ApiException`s
/// (401/403/429/5xx from the REST wrappers) propagate as themselves.
@immutable
class TransportUnavailable implements Exception {
  const TransportUnavailable(
    this.kind, {
    required this.surface,
    this.message,
  });

  /// Convenience for the default seam: everything is awaiting the Firebase +
  /// REST-wrapper handoff.
  const TransportUnavailable.awaitingFirebase(String surface)
      : this(
          TransportUnavailableKind.awaitingFirebase,
          surface: surface,
          message: 'Block C is not wired to Firebase yet. This surface goes '
              'live only after the founder/backend handoff (Firebase SDK for '
              'realtime reads + REST wrappers for writes).',
        );

  final TransportUnavailableKind kind;

  /// A short label of the operation that was unavailable (e.g.
  /// `'sendMessage'`, `'joinGroup'`) for logging / debugging.
  final String surface;

  /// An optional user-safe explanation.
  final String? message;

  bool get isAwaitingFirebase =>
      kind == TransportUnavailableKind.awaitingFirebase;

  @override
  String toString() =>
      'TransportUnavailable($kind, surface: $surface): ${message ?? ''}';
}

/// Compile-time gates for the two pillars (SPEC §0 / §C). Both stay **false**
/// until Firebase is wired; with no Firebase project the pillars render their
/// `EmptyView` "coming soon" states. Flip to `true` (per pillar) as part of the
/// handoff, once the Firestore impl + REST wrappers are bound to the providers.
///
/// These are `const` so the tree-shaker can drop the (future) live code paths in
/// a build where a pillar is still gated.
class BlockCGate {
  const BlockCGate._();

  /// Pillar 04 (Staffroom) live. False until Firestore chat/feed + REST wrappers land.
  static const bool staffroomEnabled = bool.fromEnvironment(
    'STAFFROOM_ENABLED',
    defaultValue: false,
  );

  /// Pillar 05 (Pro Inbox) live. False until Firestore conversations/messages +
  /// REST wrappers land.
  static const bool proInboxEnabled = bool.fromEnvironment(
    'PRO_INBOX_ENABLED',
    defaultValue: false,
  );
}
