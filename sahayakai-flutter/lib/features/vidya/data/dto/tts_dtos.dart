import 'package:flutter/foundation.dart';

/// The soft-cap snapshot `POST /api/tts` returns alongside the audio, for
/// usage-warning toasts. [remaining] can be `null` on the wire (an unlimited
/// plan serialises `Infinity` → JSON `null`); [warning] is one of
/// `none | approaching | exceeded` (server enum), surfaced as-is.
@immutable
class VoiceQuota {
  const VoiceQuota({
    required this.used,
    required this.limit,
    this.remaining,
    this.warning = 'none',
  });

  final double used;

  /// Minutes cap. `-1` means unlimited, `0` means the free tier (403'd upstream
  /// before synthesis).
  final double limit;
  final double? remaining;
  final String warning;

  static VoiceQuota? fromJson(Object? json) {
    if (json is! Map) return null;
    final map = json.cast<String, dynamic>();
    return VoiceQuota(
      used: _d(map['used']) ?? 0,
      limit: _d(map['limit']) ?? 0,
      remaining: _d(map['remaining']),
      warning: map['warning'] is String ? map['warning'] as String : 'none',
    );
  }
}

/// The `POST /api/tts` 200 body: `{ audioContent: <base64 mp3>, voiceQuota? }`.
/// [audioContent] is fed straight to `AudioPlayerService.playBase64Mp3`.
@immutable
class TtsResult {
  const TtsResult({required this.audioContent, this.voiceQuota});

  final String audioContent;
  final VoiceQuota? voiceQuota;

  bool get hasAudio => audioContent.isNotEmpty;

  static TtsResult fromJson(Map<String, dynamic> json) => TtsResult(
        audioContent: json['audioContent'] as String? ?? '',
        voiceQuota: VoiceQuota.fromJson(json['voiceQuota']),
      );
}

double? _d(Object? v) {
  if (v is num) return v.toDouble();
  return null;
}
