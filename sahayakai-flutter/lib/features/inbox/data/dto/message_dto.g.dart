// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'message_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SharedResourceDto _$SharedResourceDtoFromJson(Map<String, dynamic> json) =>
    SharedResourceDto(
      id: json['id'] as String?,
      type: json['type'] as String?,
      title: json['title'] as String?,
      route: json['route'] as String?,
      gradeLevel: json['gradeLevel'] as String?,
      subject: json['subject'] as String?,
      language: json['language'] as String?,
    );

MessageDto _$MessageDtoFromJson(Map<String, dynamic> json) => MessageDto(
  id: json['id'] as String?,
  type: json['type'] as String?,
  text: json['text'] as String?,
  senderId: json['senderId'] as String?,
  senderName: json['senderName'] as String?,
  senderPhotoURL: json['senderPhotoURL'] as String?,
  resource: json['resource'] == null
      ? null
      : SharedResourceDto.fromJson(json['resource'] as Map<String, dynamic>),
  audioUrl: json['audioUrl'] as String?,
  audioDuration: json['audioDuration'] as num?,
  readBy: json['readBy'] as List<dynamic>?,
  deliveredTo: json['deliveredTo'] as List<dynamic>?,
  createdAt: json['createdAt'],
  clientMessageId: json['clientMessageId'] as String?,
  deliveryStatus: json['deliveryStatus'] as String?,
);

Map<String, dynamic> _$SendMessageRequestDtoToJson(
  SendMessageRequestDto instance,
) => <String, dynamic>{
  'conversationId': instance.conversationId,
  'text': instance.text,
  'type': instance.type,
  if (instance.resource case final value?) 'resource': value,
  if (instance.audioUrl case final value?) 'audioUrl': value,
  if (instance.audioDuration case final value?) 'audioDuration': value,
  if (instance.clientMessageId case final value?) 'clientMessageId': value,
};

SendMessageResponseDto _$SendMessageResponseDtoFromJson(
  Map<String, dynamic> json,
) => SendMessageResponseDto(messageId: json['messageId'] as String?);
