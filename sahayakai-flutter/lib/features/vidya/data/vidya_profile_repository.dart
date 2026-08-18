import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_providers.dart';
import 'dto/vidya_profile.dart';

part 'vidya_profile_repository.g.dart';

/// VIDYA teacher-profile sync — `GET/POST /api/vidya/profile`. The POST body is
/// the strict `{ profile: {...} }` shape the route validates (unknown keys
/// 400). NEVER persist a spoken utterance's language here (SPEC §A.7 profile
/// poisoning) — that is a controller (U-V3) rule. Live sync needs real auth
/// (401 on the stub token); decode is testable now.
class VidyaProfileRepository {
  const VidyaProfileRepository(this._client);

  final ApiClient _client;

  static const String _path = '/api/vidya/profile';

  /// The saved profile, or null for a first-visit teacher (`{ profile: null }`).
  Future<VidyaProfile?> fetch() {
    return _client.get<VidyaProfile?>(
      _path,
      decode: (json) {
        final map = (json as Map?)?.cast<String, dynamic>();
        return VidyaProfile.fromJson(
          (map?['profile'] as Map?)?.cast<String, dynamic>(),
        );
      },
    );
  }

  Future<void> save(VidyaProfile profile) {
    return _client.post<void>(
      _path,
      data: {'profile': profile.toJson()},
      decode: (_) {},
    );
  }
}

@riverpod
VidyaProfileRepository vidyaProfileRepository(Ref ref) =>
    VidyaProfileRepository(ref.watch(apiClientProvider));
