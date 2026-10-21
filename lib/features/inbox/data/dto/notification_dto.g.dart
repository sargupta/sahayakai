// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

NotificationDto _$NotificationDtoFromJson(Map<String, dynamic> json) =>
    NotificationDto(
      id: json['id'] as String?,
      recipientId: json['recipientId'] as String?,
      type: json['type'] as String?,
      title: json['title'] as String?,
      message: json['message'] as String?,
      senderId: json['senderId'] as String?,
      senderName: json['senderName'] as String?,
      senderPhotoURL: json['senderPhotoURL'] as String?,
      link: json['link'] as String?,
      metadata: json['metadata'] as Map<String, dynamic>?,
      isRead: json['isRead'],
      createdAt: json['createdAt'],
    );

Map<String, dynamic> _$MarkNotificationReadRequestDtoToJson(
  MarkNotificationReadRequestDto instance,
) => <String, dynamic>{'notificationId': instance.notificationId};
