import 'package:flutter/foundation.dart';

/// The current user's relationship to another teacher, from their POV
/// (`src/types/index.ts::ConnectionStatus`). Drives the directory/profile
/// connection chip and, critically, the **DM gate** (only [connected] unlocks
/// the Pro Inbox message button). [fromWire] tolerant → [none] (the safe
/// default: never falsely claim a connection that would open the DM gate).
enum ConnectionStatus {
  none('none'),
  pendingSent('pending_sent'),
  pendingReceived('pending_received'),
  connected('connected');

  const ConnectionStatus(this.wire);

  final String wire;

  static ConnectionStatus fromWire(String? wire) {
    for (final s in ConnectionStatus.values) {
      if (s.wire == wire) return s;
    }
    return ConnectionStatus.none;
  }

  /// Mutual, accepted — the only state that unlocks the DM + email visibility.
  bool get isConnected => this == ConnectionStatus.connected;
}

/// The result of `sendConnectionRequestAction`
/// (`{ status: 'sent' | 'already_connected' | 'already_pending' }`). The UI
/// branches the toast on this exactly like the web handler. [fromWire] tolerant
/// → [sent].
enum ConnectionRequestResult {
  sent('sent'),
  alreadyConnected('already_connected'),
  alreadyPending('already_pending');

  const ConnectionRequestResult(this.wire);

  final String wire;

  static ConnectionRequestResult fromWire(String? wire) {
    for (final r in ConnectionRequestResult.values) {
      if (r.wire == wire) return r;
    }
    return ConnectionRequestResult.sent;
  }
}

/// ⚠️ TWO PARALLEL GRAPHS SHARE THE `connections` COLLECTION (SPEC §E). Keeping
/// them distinct in Dart is load-bearing — conflating them breaks the DM gate.
///
/// **[FollowEdge]** is the lightweight, directed **follow** graph:
/// `connections/{followerId}_{followingId}` docs shaped
/// `{ followerId, followingId, createdAt }`, written by `followTeacherAction`.
/// A follow is one-way and does NOT unlock messaging.
@immutable
class FollowEdge {
  const FollowEdge({
    required this.followerId,
    required this.followingId,
    this.createdAt,
  });

  final String followerId;
  final String followingId;
  final String? createdAt;

  /// The doc id the web uses: `{followerId}_{followingId}` (NOT sorted — the
  /// direction is meaningful, unlike the mutual graph's sorted pair).
  String get docId => '${followerId}_$followingId';

  @override
  bool operator ==(Object other) =>
      other is FollowEdge &&
      other.followerId == followerId &&
      other.followingId == followingId &&
      other.createdAt == createdAt;

  @override
  int get hashCode => Object.hash(followerId, followingId, createdAt);
}

/// **[MutualConnection]** is the accepted, symmetric **connection** graph:
/// `connections/{sortedPair}` docs shaped `{ uids: [a, b], initiatedBy,
/// connectedAt }` (`src/types/index.ts::Connection`), created when a
/// `connection_requests` doc is accepted. **This mutual link is the DM gate.**
///
/// Note the shared collection name but different doc shape: a follow doc has
/// `followerId`/`followingId`; a mutual doc has `uids`/`initiatedBy`. Decode
/// must branch on which fields are present.
@immutable
class MutualConnection {
  const MutualConnection({
    required this.id,
    required this.uids,
    required this.initiatedBy,
    this.connectedAt,
  });

  /// Sorted `{uid1}_{uid2}` doc id.
  final String id;

  /// Both participant uids — enables `array-contains` queries.
  final List<String> uids;

  /// Who originally sent the request.
  final String initiatedBy;
  final String? connectedAt;

  /// The other participant relative to [me] (null if [me] is not in the pair).
  String? other(String me) {
    for (final uid in uids) {
      if (uid != me) return uid;
    }
    return null;
  }

  @override
  bool operator ==(Object other) =>
      other is MutualConnection &&
      other.id == id &&
      listEquals(other.uids, uids) &&
      other.initiatedBy == initiatedBy &&
      other.connectedAt == connectedAt;

  @override
  int get hashCode =>
      Object.hash(id, Object.hashAll(uids), initiatedBy, connectedAt);
}

/// A pending `connection_requests/{fromUid}_{toUid}` document
/// (`src/types/index.ts::ConnectionRequest`), with a 30-day expiry. Accepting it
/// promotes it into a [MutualConnection].
@immutable
class ConnectionRequest {
  const ConnectionRequest({
    required this.id,
    required this.fromUid,
    required this.toUid,
    this.createdAt,
    this.expiresAt,
  });

  /// Doc id: `{fromUid}_{toUid}`.
  final String id;
  final String fromUid;
  final String toUid;
  final String? createdAt;

  /// ISO-8601; 30 days from creation.
  final String? expiresAt;

  @override
  bool operator ==(Object other) =>
      other is ConnectionRequest &&
      other.id == id &&
      other.fromUid == fromUid &&
      other.toUid == toUid &&
      other.createdAt == createdAt &&
      other.expiresAt == expiresAt;

  @override
  int get hashCode => Object.hash(id, fromUid, toUid, createdAt, expiresAt);
}

/// One inbound request in [MyConnectionData]: the sender uid + the request id to
/// accept/decline.
@immutable
class ReceivedConnectionRequest {
  const ReceivedConnectionRequest({required this.uid, required this.requestId});

  final String uid;
  final String requestId;

  @override
  bool operator ==(Object other) =>
      other is ReceivedConnectionRequest &&
      other.uid == uid &&
      other.requestId == requestId;

  @override
  int get hashCode => Object.hash(uid, requestId);
}

/// The one-round-trip connection bundle for the directory
/// (`src/types/index.ts::MyConnectionData` / `getMyConnectionDataAction`).
/// Resolves each teacher's [ConnectionStatus] without a per-row read.
@immutable
class MyConnectionData {
  const MyConnectionData({
    this.connectedUids = const <String>[],
    this.sentRequestUids = const <String>[],
    this.receivedRequests = const <ReceivedConnectionRequest>[],
  });

  /// Mutually-connected uids — the DM allowlist.
  final List<String> connectedUids;

  /// Uids the current user has an outstanding request to.
  final List<String> sentRequestUids;

  /// Inbound requests awaiting the current user's accept/decline.
  final List<ReceivedConnectionRequest> receivedRequests;

  /// Whether the current user may DM [uid] (the DM gate).
  bool isConnectedTo(String uid) => connectedUids.contains(uid);

  /// The current user's [ConnectionStatus] toward [uid], derived from the three
  /// lists — the exact resolution the directory chip uses.
  ConnectionStatus statusFor(String uid) {
    if (connectedUids.contains(uid)) return ConnectionStatus.connected;
    if (sentRequestUids.contains(uid)) return ConnectionStatus.pendingSent;
    if (receivedRequests.any((r) => r.uid == uid)) {
      return ConnectionStatus.pendingReceived;
    }
    return ConnectionStatus.none;
  }

  /// The request id for an inbound request from [uid], if any (for inline
  /// accept/decline).
  String? requestIdFrom(String uid) {
    for (final r in receivedRequests) {
      if (r.uid == uid) return r.requestId;
    }
    return null;
  }

  @override
  bool operator ==(Object other) =>
      other is MyConnectionData &&
      listEquals(other.connectedUids, connectedUids) &&
      listEquals(other.sentRequestUids, sentRequestUids) &&
      listEquals(other.receivedRequests, receivedRequests);

  @override
  int get hashCode => Object.hash(
        Object.hashAll(connectedUids),
        Object.hashAll(sentRequestUids),
        Object.hashAll(receivedRequests),
      );
}
