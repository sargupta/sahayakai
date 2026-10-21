// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'chat_message_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChatMessageDto _$ChatMessageDtoFromJson(Map<String, dynamic> json) =>
    ChatMessageDto(
      id: json['id'] as String?,
      text: json['text'] as String?,
      authorId: json['authorId'] as String?,
      authorName: json['authorName'] as String?,
      authorPhotoURL: json['authorPhotoURL'] as String?,
      audioUrl: json['audioUrl'] as String?,
      isDemoPersona: json['isDemoPersona'],
      createdAt: json['createdAt'],
    );

Map<String, dynamic> _$SendChatMessageRequestDtoToJson(
  SendChatMessageRequestDto instance,
) => <String, dynamic>{
  'text': instance.text,
  if (instance.groupId case final value?) 'groupId': value,
  if (instance.audioUrl case final value?) 'audioUrl': value,
};

SendChatMessageResponseDto _$SendChatMessageResponseDtoFromJson(
  Map<String, dynamic> json,
) => SendChatMessageResponseDto(messageId: json['messageId'] as String?);
