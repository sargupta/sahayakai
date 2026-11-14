import 'package:flutter/foundation.dart';

/// What a report is about (`targetType` on `POST /api/moderation/report`).
enum ReportTarget {
  post('post'),
  message('message'),
  profile('profile');

  const ReportTarget(this.wire);
  final String wire;
}

/// Why it is reported (`reason` on `POST /api/moderation/report`).
enum ReportReason {
  harassment('harassment'),
  inappropriate('inappropriate'),
  spam('spam'),
  other('other');

  const ReportReason(this.wire);
  final String wire;
}

/// The server's limit on a report's free text (`REPORT_FREETEXT_MAX`).
const int kReportDetailsMax = 500;

/// A teacher the signed-in teacher has blocked.
@immutable
class BlockedTeacher {
  const BlockedTeacher({required this.uid, required this.name, this.photoUrl});

  final String uid;
  final String name;
  final String? photoUrl;

  @override
  bool operator ==(Object other) =>
      other is BlockedTeacher &&
      other.uid == uid &&
      other.name == name &&
      other.photoUrl == photoUrl;

  @override
  int get hashCode => Object.hash(uid, name, photoUrl);
}
