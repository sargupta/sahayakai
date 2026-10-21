// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'library_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LibraryItemDto _$LibraryItemDtoFromJson(Map<String, dynamic> json) =>
    LibraryItemDto(
      id: json['id'] as String?,
      type: json['type'] as String?,
      title: json['title'] as String?,
      gradeLevel: json['gradeLevel'] as String?,
      subject: json['subject'] as String?,
      topic: json['topic'] as String?,
      language: json['language'] as String?,
      createdAt: json['createdAt'],
      data: json['data'],
    );

LibraryListDto _$LibraryListDtoFromJson(Map<String, dynamic> json) =>
    LibraryListDto(
      items: json['items'] as List<dynamic>?,
      nextCursor: json['nextCursor'] as String?,
    );
