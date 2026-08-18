// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'settings_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$DeleteAccountRequestDtoToJson(
  DeleteAccountRequestDto instance,
) => <String, dynamic>{
  'confirm': instance.confirm,
  'idToken': instance.idToken,
};

DeleteAccountResponseDto _$DeleteAccountResponseDtoFromJson(
  Map<String, dynamic> json,
) => DeleteAccountResponseDto(
  status: json['status'] as String?,
  message: json['message'] as String?,
  gracePeriodEnd: json['gracePeriodEnd'] as String?,
  exportUrl: json['exportUrl'] as String?,
);
