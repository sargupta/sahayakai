import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:share_plus/share_plus.dart';

part 'share_service.g.dart';

/// Opens the OS share sheet so a teacher can send drafted text (a parent
/// message) on to a parent over WhatsApp / SMS / email, or hand off a
/// downloaded file (the account-data export ZIP) to wherever they want to
/// save it (Drive, Files, WhatsApp, ...).
///
/// Behind a provider rather than a bare `SharePlus.instance.share` call for the
/// same reason as [LinkOpener](link_opener.dart): a widget test can swap in a
/// fake instead of standing up a platform channel and popping the real share
/// sheet, and every outbound share funnels through one auditable place.
///
/// The text is teacher-authored (the AI-drafted parent message the teacher just
/// reviewed on screen), never a model-supplied URL, so there is no
/// external-link trust boundary to police here.
class ShareService {
  const ShareService();

  /// Summons the platform share sheet with [text] (and an optional [subject]
  /// for channels that carry one, e.g. email). Swallows the [ShareResult];
  /// callers care that the sheet opened, not which app the teacher chose.
  Future<void> shareText(String text, {String? subject}) async {
    await SharePlus.instance.share(ShareParams(text: text, subject: subject));
  }

  /// Summons the platform share sheet with [bytes] as a single named file
  /// (e.g. the data-export ZIP the teacher just downloaded over the
  /// authenticated API). `XFile.fromData` + `fileNameOverrides` is the
  /// documented share_plus pattern for in-memory bytes — it needs no
  /// temp-file bookkeeping of our own; share_plus handles writing it out per
  /// platform.
  Future<void> shareFile(
    Uint8List bytes, {
    required String filename,
    String? mimeType,
  }) async {
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile.fromData(bytes, mimeType: mimeType, name: filename)],
        fileNameOverrides: [filename],
      ),
    );
  }
}

@Riverpod(keepAlive: true)
ShareService shareService(Ref ref) => const ShareService();
