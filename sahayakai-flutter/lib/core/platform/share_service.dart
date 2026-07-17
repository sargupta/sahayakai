import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:share_plus/share_plus.dart';

part 'share_service.g.dart';

/// Opens the OS share sheet so a teacher can send drafted text (a parent
/// message) on to a parent over WhatsApp / SMS / email.
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
}

@Riverpod(keepAlive: true)
ShareService shareService(Ref ref) => const ShareService();
