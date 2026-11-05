import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/auth/auth_providers.dart';
import '../../../core/firebase/firebase_init.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/teacher.dart';
import 'dto/teacher_dto.dart';

part 'teacher_profiles.g.dart';

/// Resolves teacher uids to their PII-stripped public card (name, photo,
/// school, subjects) — what the Messages pane needs to show WHO sent a
/// connection request and the network screen needs to list connections, since
/// `GET /api/connections/mine` carries uids only.
///
/// A separate seam from `StaffroomTransport` on purpose: the batch lookup is a
/// read helper for those two lists, not part of the Staffroom contract.
abstract interface class TeacherProfileSource {
  /// Uid → profile for every uid the server knows. Unknown uids are absent.
  Future<Map<String, TeacherSuggestion>> lookup(List<String> uids);
}

/// `POST /api/community/profiles` `{ uids }` (≤50 per call, zod-enforced) →
/// a JSON array of public profiles. The reply is a bare array, which
/// [ApiClient.post] (a Map-decoding verb) cannot return, so it is read raw.
class ApiTeacherProfileSource implements TeacherProfileSource {
  const ApiTeacherProfileSource(this._apiClient);

  final ApiClient _apiClient;

  /// The route's `uids` array cap.
  static const int batchSize = 50;

  @override
  Future<Map<String, TeacherSuggestion>> lookup(List<String> uids) async {
    final unique = <String>{
      for (final uid in uids)
        if (uid.trim().isNotEmpty) uid.trim(),
    }.toList();
    final out = <String, TeacherSuggestion>{};
    for (var i = 0; i < unique.length; i += batchSize) {
      final end =
          i + batchSize > unique.length ? unique.length : i + batchSize;
      final raw = await _apiClient.postRaw(
        '/api/community/profiles',
        data: <String, dynamic>{'uids': unique.sublist(i, end)},
      );
      final decoded =
          raw.bytes.isEmpty ? null : jsonDecode(utf8.decode(raw.bytes));
      if (decoded is! List) {
        throw const FormatException(
          'POST /api/community/profiles: expected an array',
        );
      }
      for (final row in decoded) {
        if (row is! Map) continue;
        final map = row.cast<String, dynamic>();
        // The stripped profile carries `uid` and/or `id`.
        final uid = (map['uid'] as String?)?.trim().isNotEmpty == true
            ? (map['uid'] as String).trim()
            : (map['id'] as String?)?.trim();
        if (uid == null || uid.isEmpty) continue;
        final teacher = TeacherSuggestionDto.fromJson(<String, dynamic>{
          ...map,
          'uid': uid,
        }).toDomain();
        out[uid] = teacher;
      }
    }
    return out;
  }
}

/// Signed out / Firebase unconfigured: nothing to look up.
class EmptyTeacherProfileSource implements TeacherProfileSource {
  const EmptyTeacherProfileSource();

  @override
  Future<Map<String, TeacherSuggestion>> lookup(List<String> uids) async =>
      const <String, TeacherSuggestion>{};
}

/// The bound profile source — live only for a real signed-in teacher, the same
/// gate `staffroomTransportProvider` uses. Widget tests override it.
@Riverpod(keepAlive: true)
TeacherProfileSource teacherProfileSource(Ref ref) {
  if (!FirebaseInit.isConfigured) return const EmptyTeacherProfileSource();
  if (ref.watch(authControllerProvider) != AuthStatus.signedIn) {
    return const EmptyTeacherProfileSource();
  }
  return ApiTeacherProfileSource(ref.watch(apiClientProvider));
}

/// A stable family key for a set of uids (order-insensitive), so the same
/// people always share one cached lookup.
String teacherProfilesKey(Iterable<String> uids) {
  final sorted = uids.where((u) => u.isNotEmpty).toSet().toList()..sort();
  return sorted.join(',');
}

/// **ONE-SHOT.family.** Profiles for the uids in [uidsKey] (see
/// [teacherProfilesKey]).
@riverpod
Future<Map<String, TeacherSuggestion>> teacherProfiles(
  Ref ref,
  String uidsKey,
) {
  final uids = uidsKey.isEmpty ? const <String>[] : uidsKey.split(',');
  if (uids.isEmpty) {
    return Future<Map<String, TeacherSuggestion>>.value(
      const <String, TeacherSuggestion>{},
    );
  }
  return ref.watch(teacherProfileSourceProvider).lookup(uids);
}
