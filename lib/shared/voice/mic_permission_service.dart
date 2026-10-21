import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'mic_permission_service.g.dart';

/// The outcome of asking for the microphone. Collapses the platform's six
/// `PermissionStatus` values into the three the VIDYA state machine branches on
/// (SPEC_voice_vidya §C.4):
///   • [granted]           → begin recording
///   • [denied]            → a soft "not this time"; the mic returns to idle and
///     the next tap asks again
///   • [permanentlyDenied] → the teacher must enable it in Settings; the machine
///     shows a dignified `EmptyView` + "Open settings", never a raw dialog.
enum MicPermission { granted, denied, permanentlyDenied }

/// Runtime microphone permission — the one seam a test overrides so the
/// controller under test never pops a real OS permission sheet (mirrors
/// `AudioRecorderService`). Kept separate from the recorder because
/// `record.hasPermission()` cannot distinguish a one-off "deny" from a
/// permanent "don't ask again", and that difference decides whether the mic
/// re-asks or sends the teacher to Settings.
abstract interface class MicPermissionService {
  /// Returns the current grant, requesting it from the OS when it has not been
  /// decided yet. Requested at the moment of the FIRST mic tap.
  Future<MicPermission> ensureGranted();

  /// Deep-links to the app's OS settings page (the "Open settings" recovery on
  /// a permanent denial). Returns whether the settings page opened.
  Future<bool> openSettings();
}

/// The production [MicPermissionService], backed by `permission_handler`.
class PermissionHandlerMicService implements MicPermissionService {
  const PermissionHandlerMicService();

  @override
  Future<MicPermission> ensureGranted() async {
    final status = await Permission.microphone.status;
    if (status.isGranted || status.isLimited) return MicPermission.granted;
    // Already parked at "don't ask again" / restricted by policy → Settings.
    if (status.isPermanentlyDenied || status.isRestricted) {
      return MicPermission.permanentlyDenied;
    }
    final requested = await Permission.microphone.request();
    if (requested.isGranted || requested.isLimited) return MicPermission.granted;
    if (requested.isPermanentlyDenied || requested.isRestricted) {
      return MicPermission.permanentlyDenied;
    }
    return MicPermission.denied;
  }

  @override
  Future<bool> openSettings() => openAppSettings();
}

/// The injectable permission gate. Override in tests with a fake so the machine
/// never touches the OS. Kept alive so it follows VIDYA across navigation.
@Riverpod(keepAlive: true)
MicPermissionService micPermissionService(Ref ref) =>
    const PermissionHandlerMicService();
