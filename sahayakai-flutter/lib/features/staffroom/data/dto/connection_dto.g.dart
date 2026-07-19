// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'connection_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MyConnectionDataDto _$MyConnectionDataDtoFromJson(Map<String, dynamic> json) =>
    MyConnectionDataDto(
      connectedUids: json['connectedUids'] as List<dynamic>?,
      sentRequestUids: json['sentRequestUids'] as List<dynamic>?,
      receivedRequests: json['receivedRequests'] as List<dynamic>?,
    );

ConnectionRequestResponseDto _$ConnectionRequestResponseDtoFromJson(
  Map<String, dynamic> json,
) => ConnectionRequestResponseDto(status: json['status'] as String?);

Map<String, dynamic> _$SendConnectionRequestDtoToJson(
  SendConnectionRequestDto instance,
) => <String, dynamic>{'toUid': instance.toUid};

Map<String, dynamic> _$ConnectionRequestActionDtoToJson(
  ConnectionRequestActionDto instance,
) => <String, dynamic>{'requestId': instance.requestId};

Map<String, dynamic> _$DisconnectRequestDtoToJson(
  DisconnectRequestDto instance,
) => <String, dynamic>{'otherUid': instance.otherUid};

Map<String, dynamic> _$FollowTeacherRequestDtoToJson(
  FollowTeacherRequestDto instance,
) => <String, dynamic>{'followingId': instance.followingId};
