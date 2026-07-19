import 'package:flutter/foundation.dart';

import 'parent_outreach.dart';

/// One student on the teacher's roster, as the Parent Hotline `pickStudent`
/// stage lists them (SPEC §B.1 stage 1).
///
/// This is a **display-only** projection: it is what the screen needs to render
/// a student row and hand the launch context to the U-PH2 controller. It is
/// deliberately NOT the full `students/{id}` document.
///
/// **F9-001.** The client never holds — and this model never carries — the full
/// parent phone number. [parentPhoneLast4] is a pre-masked four-digit display
/// fragment (server-projected, or absent), used only to reassure the teacher
/// which number will be dialled; the real E.164 phone is server-trusted and the
/// call routes read it themselves. [hasParentPhone] mirrors the server's "no
/// parent phone on record" 422 so a no-number student is shown as a disabled row
/// rather than leading the teacher into a dead call.
@immutable
class HotlineStudent {
  const HotlineStudent({
    required this.id,
    required this.name,
    required this.classId,
    required this.className,
    required this.parentLanguage,
    this.hasParentPhone = true,
    this.parentPhoneLast4,
    this.subject,
    this.suggestedReason,
  });

  /// Student doc id — the `studentId` every outreach route needs.
  final String id;
  final String name;
  final String classId;
  final String className;

  /// The parent's language as a full English name (e.g. `"Kannada"`) — drives
  /// callability + the server-side TTS/STT/agent language.
  final String parentLanguage;

  /// Whether a parent phone is on record. False → the row is disabled with a
  /// "No parent number saved" hint (mirrors the server 422; SPEC §B.1 stage 1).
  final bool hasParentPhone;

  /// A pre-masked last-4 display fragment (never the full number — F9-001). Null
  /// when unknown; the review meta line then shows a fully-masked placeholder.
  final String? parentPhoneLast4;

  /// Optional subject for the message-draft + greeting personalization.
  final String? subject;

  /// An optional reason to pre-select on the reason stage (e.g. an attendance
  /// hand-off passing "consecutive absences").
  final OutreachReason? suggestedReason;

  @override
  bool operator ==(Object other) =>
      other is HotlineStudent &&
      other.id == id &&
      other.name == name &&
      other.classId == classId &&
      other.className == className &&
      other.parentLanguage == parentLanguage &&
      other.hasParentPhone == hasParentPhone &&
      other.parentPhoneLast4 == parentPhoneLast4 &&
      other.subject == subject &&
      other.suggestedReason == suggestedReason;

  @override
  int get hashCode => Object.hash(
        id,
        name,
        classId,
        className,
        parentLanguage,
        hasParentPhone,
        parentPhoneLast4,
        subject,
        suggestedReason,
      );
}
