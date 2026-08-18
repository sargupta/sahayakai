// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile_dtos.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$ProfileSettingsPatchDtoToJson(
  ProfileSettingsPatchDto instance,
) => <String, dynamic>{
  if (instance.preferredBoard case final value?) 'preferredBoard': value,
  if (instance.qualifications case final value?) 'qualifications': value,
  if (instance.administrativeRole case final value?)
    'administrativeRole': value,
};

TeacherProfileDto _$TeacherProfileDtoFromJson(Map<String, dynamic> json) =>
    TeacherProfileDto(
      displayName: json['displayName'] as String?,
      schoolName: json['schoolName'] as String?,
      state: json['state'] as String?,
      district: json['district'] as String?,
      subjects: json['subjects'] as List<dynamic>?,
      gradeLevels: json['gradeLevels'] as List<dynamic>?,
      teachingGradeLevels: json['teachingGradeLevels'] as List<dynamic>?,
      preferredLanguage: json['preferredLanguage'] as String?,
      phoneNumber: json['phoneNumber'] as String?,
      pincode: json['pincode'] as String?,
      preferredBoard: json['preferredBoard'] as String?,
      educationBoard: json['educationBoard'] as String?,
      qualifications: json['qualifications'] as List<dynamic>?,
      administrativeRole: json['administrativeRole'] as String?,
    );
