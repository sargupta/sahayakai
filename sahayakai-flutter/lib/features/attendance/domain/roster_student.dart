import 'package:flutter/foundation.dart';

import '../../parent_hotline/domain/hotline_student.dart';
import '../../parent_hotline/domain/parent_outreach.dart';

/// One student on a class roster, in the **masked** projection — the only
/// student shape this app is allowed to hold.
///
/// F9-001 / PII GATE
///
/// `classes/{classId}/students/{studentId}` stores a full E.164 `parentPhone`.
/// The default `GET .../students` response returns that document whole, which
/// is correct for the teacher's own browser (it owns the class and needs the
/// number to render the edit form) and wrong for a handset: it would put every
/// parent's phone number, for every class, into an app store binary and its
/// caches. Nothing on mobile needs it — outreach calls are placed server-side,
/// where the number is read from Firestore directly (see
/// `parent_hotline`'s `PlaceCallRequestDto`, which deliberately carries no
/// phone).
///
/// So this type mirrors the masked `?projection=roster` shape and nothing else:
/// `{ id, name, rollNumber, parentLanguage, hasParentPhone, parentPhoneLast4 }`.
/// There is no `parentPhone` field and there must never be one — adding it, or
/// anything else derived from the number beyond the last four digits, re-opens
/// the leak this type closes. The decoder in `attendance_dtos.dart` **fails
/// closed** if the server ever hands back the unmasked document instead.
@immutable
class RosterStudent {
  const RosterStudent({
    required this.id,
    required this.name,
    required this.rollNumber,
    required this.parentLanguage,
    this.hasParentPhone = false,
    this.parentPhoneLast4,
  });

  /// Student doc id — the `studentId` the records map is keyed by and every
  /// per-student route takes.
  final String id;
  final String name;

  /// 1–40, enforced transactionally server-side (see `ClassCapacity`).
  final int rollNumber;

  /// The parent's language as a full English name (e.g. `"Kannada"`) — drives
  /// callability and the server-side TTS/STT/agent language.
  final String parentLanguage;

  /// Whether any parent phone is on record. False → the outreach row is
  /// disabled with a "no parent number saved" hint rather than leading the
  /// teacher into a call that 422s.
  final bool hasParentPhone;

  /// The last four digits only, so the teacher can recognise which contact will
  /// be dialled. Null when there is no number, or when the server had fewer
  /// than four digits to mask — the projection sends `''` for both, and a
  /// partial mask is worse than none, so it is normalised to null here.
  final String? parentPhoneLast4;

  /// This student as the parent-hotline picker's launch context.
  ///
  /// The hand-off is one-directional and lossless in the safe direction: every
  /// field `HotlineStudent` needs is already in the masked projection, so
  /// feeding the hotline roster from attendance never requires un-masking. The
  /// class identity comes from the caller because the roster projection does
  /// not repeat it per student.
  HotlineStudent toHotlineStudent({
    required String classId,
    required String className,
    String? subject,
    OutreachReason? suggestedReason,
  }) {
    return HotlineStudent(
      id: id,
      name: name,
      classId: classId,
      className: className,
      parentLanguage: parentLanguage,
      hasParentPhone: hasParentPhone,
      parentPhoneLast4: parentPhoneLast4,
      subject: subject,
      suggestedReason: suggestedReason,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is RosterStudent &&
      other.id == id &&
      other.name == name &&
      other.rollNumber == rollNumber &&
      other.parentLanguage == parentLanguage &&
      other.hasParentPhone == hasParentPhone &&
      other.parentPhoneLast4 == parentPhoneLast4;

  @override
  int get hashCode => Object.hash(
    id,
    name,
    rollNumber,
    parentLanguage,
    hasParentPhone,
    parentPhoneLast4,
  );
}
