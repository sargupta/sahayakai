import '../../../core/i18n/gen/app_localizations.dart';
import 'vidya_controller.dart';
import 'widgets/seal_mic.dart';

/// The canonical `VidyaStatus → UI` mappings, shared by the VIDYA home and the
/// everywhere VIDYA sheet so the two surfaces render the same seal phase,
/// caption and terminal copy for a given machine state (they cannot drift).

/// The Seal Mic's visual phase for a controller [status]. Every non-active phase
/// (idle / requesting / and the terminal errors) rests on the idle seal.
SealMicState sealStateForStatus(VidyaStatus status) {
  switch (status) {
    case VidyaStatus.listening:
      return SealMicState.listening;
    case VidyaStatus.transcribing:
      return SealMicState.transcribing;
    case VidyaStatus.thinking:
      return SealMicState.thinking;
    case VidyaStatus.speaking:
      return SealMicState.speaking;
    case VidyaStatus.idle:
    case VidyaStatus.requestingPermission:
    case VidyaStatus.micDenied:
    case VidyaStatus.signedOut:
    case VidyaStatus.limitReached:
    case VidyaStatus.failed:
      return SealMicState.idle;
  }
}

/// The caption under the seal for a non-terminal phase, or null for a terminal
/// one (which renders a dignified panel instead).
String? vidyaStateCaption(VidyaStatus status, AppLocalizations l10n) {
  switch (status) {
    case VidyaStatus.idle:
      return l10n.vidyaStateIdle;
    case VidyaStatus.requestingPermission:
      return l10n.vidyaStateReady;
    case VidyaStatus.listening:
      return l10n.vidyaStateListening;
    case VidyaStatus.transcribing:
    case VidyaStatus.thinking:
      return l10n.vidyaStateThinking;
    case VidyaStatus.speaking:
      return l10n.vidyaStateSpeaking;
    case VidyaStatus.micDenied:
    case VidyaStatus.signedOut:
    case VidyaStatus.limitReached:
    case VidyaStatus.failed:
      return null; // rendered as a panel
  }
}

/// Whether [status] is one of the dignified terminal states (a panel, not a
/// caption).
bool isVidyaTerminal(VidyaStatus status) =>
    status == VidyaStatus.signedOut ||
    status == VidyaStatus.micDenied ||
    status == VidyaStatus.limitReached ||
    status == VidyaStatus.failed;

/// The terminal panel's title.
String vidyaTerminalTitle(VidyaStatus status, AppLocalizations l10n) {
  switch (status) {
    case VidyaStatus.signedOut:
      return l10n.vidyaSignedOutTitle;
    case VidyaStatus.micDenied:
      return l10n.vidyaMicOffTitle;
    case VidyaStatus.limitReached:
      return l10n.vidyaLimitTitle;
    case VidyaStatus.failed:
      return l10n.vidyaErrorTitle;
    case VidyaStatus.idle:
    case VidyaStatus.requestingPermission:
    case VidyaStatus.listening:
    case VidyaStatus.transcribing:
    case VidyaStatus.thinking:
    case VidyaStatus.speaking:
      return l10n.vidyaStateIdle;
  }
}

/// The terminal panel's body copy.
String vidyaTerminalBody(VidyaStatus status, AppLocalizations l10n) {
  switch (status) {
    case VidyaStatus.signedOut:
      return l10n.vidyaSignedOutBody;
    case VidyaStatus.micDenied:
      return l10n.vidyaMicOffBody;
    case VidyaStatus.limitReached:
      return l10n.vidyaLimitBody;
    case VidyaStatus.failed:
      return l10n.vidyaErrorBody;
    case VidyaStatus.idle:
    case VidyaStatus.requestingPermission:
    case VidyaStatus.listening:
    case VidyaStatus.transcribing:
    case VidyaStatus.thinking:
    case VidyaStatus.speaking:
      return '';
  }
}
