// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'conversation_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ConversationDto _$ConversationDtoFromJson(Map<String, dynamic> json) =>
    ConversationDto(
      id: json['id'] as String?,
      type: json['type'] as String?,
      participantIds: json['participantIds'] as List<dynamic>?,
      participants: json['participants'] as Map<String, dynamic>?,
      name: json['name'] as String?,
      groupPhotoURL: json['groupPhotoURL'] as String?,
      createdBy: json['createdBy'] as String?,
      lastMessage: json['lastMessage'] as String?,
      lastMessageAt: json['lastMessageAt'],
      lastMessageSenderId: json['lastMessageSenderId'] as String?,
      unreadCount: json['unreadCount'] as Map<String, dynamic>?,
      createdAt: json['createdAt'],
      updatedAt: json['updatedAt'],
    );

Map<String, dynamic> _$GetOrCreateDirectRequestDtoToJson(
  GetOrCreateDirectRequestDto instance,
) => <String, dynamic>{'otherUid': instance.otherUid};

Map<String, dynamic> _$CreateGroupConversationRequestDtoToJson(
  CreateGroupConversationRequestDto instance,
) => <String, dynamic>{
  'participantUids': instance.participantUids,
  'name': instance.name,
};

ConversationIdResponseDto _$ConversationIdResponseDtoFromJson(
  Map<String, dynamic> json,
) => ConversationIdResponseDto(
  conversationId: json['conversationId'] as String?,
);
