import 'package:json_annotation/json_annotation.dart';

import '../../domain/connection.dart';
import 'dto_helpers.dart';

part 'connection_dto.g.dart';

/// Decodes `getMyConnectionDataAction`'s
/// `{ connectedUids[], sentRequestUids[], receivedRequests:[{uid,requestId}] }`
/// (`src/types/index.ts::MyConnectionData`) — the one-round-trip directory
/// bundle that resolves every teacher's [ConnectionStatus] (and the DM gate).
@JsonSerializable(createToJson: false)
class MyConnectionDataDto {
  const MyConnectionDataDto({
    this.connectedUids,
    this.sentRequestUids,
    this.receivedRequests,
  });

  factory MyConnectionDataDto.fromJson(Map<String, dynamic> json) =>
      _$MyConnectionDataDtoFromJson(json);

  final List<dynamic>? connectedUids;
  final List<dynamic>? sentRequestUids;
  final List<dynamic>? receivedRequests;

  MyConnectionData toDomain() => MyConnectionData(
        connectedUids: stringList(connectedUids),
        sentRequestUids: stringList(sentRequestUids),
        receivedRequests: (receivedRequests ?? const <dynamic>[])
            .whereType<Map>()
            .map((m) => m.cast<String, dynamic>())
            .map((m) => ReceivedConnectionRequest(
                  uid: (m['uid'] as String?)?.trim() ?? '',
                  requestId: (m['requestId'] as String?)?.trim() ?? '',
                ))
            .where((r) => r.uid.isNotEmpty && r.requestId.isNotEmpty)
            .toList(growable: false),
      );
}

/// Decodes `sendConnectionRequestAction`'s
/// `{ status: 'sent' | 'already_connected' | 'already_pending' }`.
@JsonSerializable(createToJson: false)
class ConnectionRequestResponseDto {
  const ConnectionRequestResponseDto({this.status});

  factory ConnectionRequestResponseDto.fromJson(Map<String, dynamic> json) =>
      _$ConnectionRequestResponseDtoFromJson(json);

  final String? status;

  ConnectionRequestResult toDomain() =>
      ConnectionRequestResult.fromWire(status);
}

/// Serialises `{ toUid }` for the send-connection-request wrapper. Caller uid is
/// server-derived (rules enforce `fromUid == auth.uid && fromUid != toUid`).
@JsonSerializable(createFactory: false)
class SendConnectionRequestDto {
  const SendConnectionRequestDto({required this.toUid});

  final String toUid;

  Map<String, dynamic> toJson() => _$SendConnectionRequestDtoToJson(this);
}

/// Serialises `{ requestId }` for the accept / decline wrappers (recipient /
/// either-party gated server-side).
@JsonSerializable(createFactory: false)
class ConnectionRequestActionDto {
  const ConnectionRequestActionDto({required this.requestId});

  final String requestId;

  Map<String, dynamic> toJson() => _$ConnectionRequestActionDtoToJson(this);
}

/// Serialises `{ otherUid }` for the disconnect wrapper.
@JsonSerializable(createFactory: false)
class DisconnectRequestDto {
  const DisconnectRequestDto({required this.otherUid});

  final String otherUid;

  Map<String, dynamic> toJson() => _$DisconnectRequestDtoToJson(this);
}

/// Serialises `{ followingId }` for the follow-toggle wrapper (directed follow
/// graph — distinct from the mutual connection graph).
@JsonSerializable(createFactory: false)
class FollowTeacherRequestDto {
  const FollowTeacherRequestDto({required this.followingId});

  final String followingId;

  Map<String, dynamic> toJson() => _$FollowTeacherRequestDtoToJson(this);
}
