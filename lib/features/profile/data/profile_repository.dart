import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import '../domain/profile_settings.dart';
import '../domain/teacher_profile.dart';
import 'profile_doc_source.dart';
import 'profile_dtos.dart';

part 'profile_repository.g.dart';

/// Data-layer gateway for the teacher's `users/<uid>` document. Presentation
/// talks to the controllers, the controllers to this repository, and only this
/// repository touches [ApiClient] / [ProfileDocSource]. Errors surface as the
/// typed `ApiException` both sources speak.
///
/// This repository is the single owner of the profile document: Settings (P0.7)
/// edits a slice of it through [savePatchableSlice] rather than keeping a
/// second repository of its own.
///
/// BUILT-PENDING-FIREBASE. Every call below is wired end to end but cannot
/// succeed at runtime yet: `tokenProvider` is the P0.2 stub that always returns
/// null, so no `Authorization: Bearer` header is attached, middleware injects
/// no `x-user-id`, and the REST lane 401s; the document lane has no uid and
/// reports the same 401. That is the honest current state, not a bug here.
class ProfileRepository {
  const ProfileRepository(this._client, this._docs);

  final ApiClient _client;
  final ProfileDocSource _docs;

  static const String _profilePath = '/api/user/profile';

  /// Reads the profile. A teacher with no document yet gets an empty
  /// [TeacherProfile], not null and not an error: the production onboarding
  /// gate is OFF, so signing in without ever completing onboarding is a
  /// supported path and must land on the form, not on a failure.
  Future<TeacherProfile> fetchProfile() async {
    final doc = await _docs.read();
    if (doc == null) return const TeacherProfile();
    return TeacherProfileDto.fromJson(doc).toDomain();
  }

  /// Writes the slice `PATCH /api/user/profile` accepts (board, qualifications,
  /// administrative role). The route replies `{ success: true }`; there is
  /// nothing to decode, so a 2xx simply means "saved".
  ///
  /// Shared with Settings, which calls exactly this.
  Future<void> savePatchableSlice(ProfileSettings settings) {
    return _client.patch<void>(
      _profilePath,
      data: ProfileSettingsPatchDto.fromDomain(settings).toJson(),
      decode: (_) {},
    );
  }

  /// Saves the whole profile, routing each field down the one lane that will
  /// actually accept it (see [TeacherProfileDocPatch] for why REST cannot carry
  /// the document half, and [ProfileSettings] for why the document lane cannot
  /// carry `administrativeRole`).
  ///
  /// [previous] is the profile as it was LOADED, passed through so the document
  /// patch can send an explicit clear for a field the teacher deliberately
  /// blanked (rather than silently omitting it and leaving the stale server
  /// value to reappear). It is optional: onboarding's first save has no prior
  /// snapshot and nothing to clear.
  ///
  /// The document write goes FIRST. Both writes are idempotent merges, so a
  /// half-completed save is recoverable by tapping Save again — but ordering it
  /// this way means the lane that carries the most fields is the one that gets
  /// to run, and a failure in either surfaces as one error to the teacher
  /// rather than a silent partial success.
  Future<void> saveProfile(
    TeacherProfile profile, {
    TeacherProfile? previous,
  }) async {
    await _docs.merge(
      TeacherProfileDocPatch(profile, previous: previous).toJson(),
    );
    await savePatchableSlice(profile.patchableSlice);
  }
}

@riverpod
ProfileRepository profileRepository(Ref ref) {
  return ProfileRepository(
    ref.watch(apiClientProvider),
    ref.watch(profileDocSourceProvider),
  );
}
