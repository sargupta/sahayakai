import 'package:json_annotation/json_annotation.dart';

import '../domain/account_deletion.dart';

part 'settings_dtos.g.dart';

/// Settings' own wire types: account deletion, and nothing else.
///
/// `ProfileSettingsPatchDto` used to live here. It now lives with the feature
/// that owns the `users/<uid>` document —
/// `lib/features/profile/data/profile_dtos.dart` — because P0.8 writes the same
/// slice, and one field must never have two serializers to keep in sync (the
/// `preferredBoard` rename is exactly the kind of mapping that rots when it is
/// duplicated). Settings imports it from there.

/// The `POST /api/user/delete-account` body.
///
/// `confirm` must be true or the route 400s. `idToken` is a **freshly
/// re-authenticated** Firebase ID token: the route re-verifies it itself
/// (`verifyIdToken(idToken, checkRevoked: true)`) and rejects it when its
/// `auth_time` claim is older than 5 minutes, because middleware forwards only
/// `x-user-id` and never the raw token. See [kMaxAuthAgeSeconds].
@JsonSerializable(createFactory: false)
class DeleteAccountRequestDto {
  const DeleteAccountRequestDto({required this.idToken, this.confirm = true});

  final bool confirm;
  final String idToken;

  Map<String, dynamic> toJson() => _$DeleteAccountRequestDtoToJson(this);
}

/// The server's re-auth freshness window, mirrored from the route's
/// `MAX_AUTH_AGE_SECONDS`. Informational: the client cannot enforce it, but the
/// copy tells the teacher how long they have after signing in again.
const int kMaxAuthAgeSeconds = 300;

/// The `/api/user/delete-account` 200 payload. Every field is nullable because
/// the UI must not crash on a shape change; [toDomain] normalizes.
@JsonSerializable(createToJson: false)
class DeleteAccountResponseDto {
  const DeleteAccountResponseDto({
    this.status,
    this.message,
    this.gracePeriodEnd,
    this.exportUrl,
  });

  factory DeleteAccountResponseDto.fromJson(Map<String, dynamic> json) =>
      _$DeleteAccountResponseDtoFromJson(json);

  final String? status;
  final String? message;
  final String? gracePeriodEnd;
  final String? exportUrl;

  AccountDeletion toDomain() => AccountDeletion(
        gracePeriodEnd: _parseDate(gracePeriodEnd),
        exportPath: _clean(exportUrl),
      );
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Lenient ISO-8601 parse: a malformed date degrades to null (the UI then just
/// omits the date from the confirmation) rather than throwing on a success.
DateTime? _parseDate(String? value) {
  final raw = _clean(value);
  if (raw == null) return null;
  return DateTime.tryParse(raw);
}
