import 'package:flutter/foundation.dart';

/// What `POST /api/export` actually did, per `SettingsRepository.requestExport`.
///
/// The route (`sahayakai-main/src/app/api/export/route.ts`) has two shapes
/// under the same 200:
///   - An individual teacher's export (the only kind this app ever requests —
///     it never sets `schoolExport`) builds a ZIP **inline** and returns the
///     archive itself (`Content-Type: application/zip`) whenever it fits
///     within the server's 500-file cap. That is the overwhelming common
///     case for a single teacher's own content.
///   - Above that cap the server queues a background job instead and replies
///     with a small JSON `{ jobId, status: 'pending' }` body. As of this
///     writing NOTHING in the backend ever advances that job past "pending"
///     (`dataExportService.updateExportJob` has no caller anywhere in
///     sahayakai-main) — there is no worker, and no email is ever sent. So a
///     queued job is not something this client can usefully poll or promise
///     delivery for; the UI says that honestly rather than implying a
///     download is coming.
@immutable
sealed class ExportResult {
  const ExportResult();
}

/// The real archive, ready to hand to the OS share sheet / a file saver.
@immutable
class ExportArchiveReady extends ExportResult {
  const ExportArchiveReady({required this.bytes, required this.filename});

  final Uint8List bytes;
  final String filename;
}

/// The server queued a background job instead of returning the file inline
/// (only reachable for a very large individual export — hundreds of pieces
/// of saved content — since this app never requests a school-wide export).
@immutable
class ExportJobQueued extends ExportResult {
  const ExportJobQueued(this.jobId);

  final String jobId;
}
