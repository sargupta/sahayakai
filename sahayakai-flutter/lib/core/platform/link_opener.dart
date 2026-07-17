import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:url_launcher/url_launcher.dart';

part 'link_opener.g.dart';

/// Opens a link outside the app (browser / YouTube / dialler).
///
/// Behind a provider rather than a bare `launchUrl` call so widget tests can
/// swap in a fake instead of standing up a platform channel, and so every
/// external navigation in the app funnels through one auditable place.
///
/// Callers must hand this a URL they have already validated. Model-generated
/// URLs are checked at the DTO boundary (see `_safeExternalUri`), so nothing
/// but an absolute http(s) URI reaches here.
class LinkOpener {
  const LinkOpener();

  /// Returns false when the platform has no handler for [url]; the caller
  /// decides whether that is worth surfacing.
  Future<bool> open(Uri url) =>
      launchUrl(url, mode: LaunchMode.externalApplication);
}

@Riverpod(keepAlive: true)
LinkOpener linkOpener(Ref ref) => const LinkOpener();
