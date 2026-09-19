import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../../core/i18n/gen/app_localizations.dart';
import '../../../../core/i18n/l10n_ext.dart';
import '../../../../core/i18n/locale_provider.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/voice/audio_recorder_service.dart';
import '../../../../shared/voice/mic_permission_service.dart';
import '../../../../shared/widgets/glass_surface.dart';
import '../../../../shared/widgets/primary_button.dart';
import '../../../../shared/widgets/secondary_button.dart';
import '../../../vidya/data/voice_to_text_repository.dart';

/// The phase the roll-call voice sheet is in.
enum _Phase { starting, listening, transcribing, denied, failed }

/// Opens the voice roll-call sheet, returning the recognised transcript (or null
/// if the teacher cancelled, denied the mic, or nothing was captured). The
/// caller resolves the transcript into marks with `RollCallResolver`.
Future<String?> showRollCallVoiceSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    backgroundColor: Colors.transparent,
    elevation: 0,
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    builder: (_) => const RollCallVoiceSheet(),
  );
}

/// A self-contained capture surface (v3 screen 13): request the mic, record one
/// pass while the teacher reads the register, then transcribe and pop with the
/// text. It owns the whole risky lifecycle so the attendance screen stays a
/// simple "get transcript → apply marks" caller.
class RollCallVoiceSheet extends ConsumerStatefulWidget {
  const RollCallVoiceSheet({super.key});

  @override
  ConsumerState<RollCallVoiceSheet> createState() => _RollCallVoiceSheetState();
}

class _RollCallVoiceSheetState extends ConsumerState<RollCallVoiceSheet> {
  _Phase _phase = _Phase.starting;

  static final BorderRadius _sheetRadius = BorderRadius.only(
    topLeft: AppRadius.rHero.topLeft,
    topRight: AppRadius.rHero.topRight,
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _begin());
  }

  Future<void> _begin() async {
    final permission = ref.read(micPermissionServiceProvider);
    MicPermission granted;
    try {
      granted = await permission.ensureGranted();
    } catch (_) {
      if (mounted) setState(() => _phase = _Phase.failed);
      return;
    }
    if (!mounted) return;
    if (granted != MicPermission.granted) {
      setState(() => _phase = _Phase.denied);
      return;
    }
    try {
      await ref.read(audioRecorderServiceProvider).start();
    } catch (_) {
      if (mounted) setState(() => _phase = _Phase.failed);
      return;
    }
    if (!mounted) return;
    setState(() => _phase = _Phase.listening);
  }

  /// Stop, transcribe, and pop with the text.
  Future<void> _finish() async {
    final navigator = Navigator.of(context);
    setState(() => _phase = _Phase.transcribing);
    final recorder = ref.read(audioRecorderServiceProvider);
    final stt = ref.read(voiceToTextRepositoryProvider);
    final lang = ref.read(localeControllerProvider).code;
    try {
      final recording = await recorder.stop();
      if (recording == null) {
        navigator.pop();
        return;
      }
      final bytes = await recording.readBytes();
      final transcript = await stt.transcribe(
        audioBytes: bytes,
        expectedLanguage: lang,
      );
      navigator.pop(transcript.isUsable ? transcript.text : null);
    } catch (_) {
      if (mounted) setState(() => _phase = _Phase.failed);
    }
  }

  Future<void> _cancel() async {
    final navigator = Navigator.of(context);
    try {
      await ref.read(audioRecorderServiceProvider).cancel();
    } catch (_) {
      // Best-effort: closing regardless.
    }
    navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final scheme = Theme.of(context).colorScheme;
    final text = Theme.of(context).textTheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: _sheetRadius,
        boxShadow: isDark ? AppShadows.dKey : AppShadows.e4,
      ),
      child: GlassSurface(
        borderRadius: _sheetRadius,
        padding: EdgeInsets.zero,
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.space4,
              AppSpacing.space3,
              AppSpacing.space4,
              AppSpacing.space4,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    decoration: ShapeDecoration(
                      color: scheme.outlineVariant,
                      shape: const StadiumBorder(),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.space5),
                _icon(scheme),
                const SizedBox(height: AppSpacing.space4),
                Text(
                  _title(l10n),
                  textAlign: TextAlign.center,
                  style: text.titleMedium,
                ),
                const SizedBox(height: AppSpacing.space2),
                Text(
                  _body(l10n),
                  textAlign: TextAlign.center,
                  style: text.bodyMedium?.copyWith(
                    color: scheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: AppSpacing.space5),
                ..._actions(l10n),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _icon(ColorScheme scheme) {
    final IconData icon;
    Color color = scheme.primary;
    switch (_phase) {
      case _Phase.starting:
      case _Phase.listening:
        icon = LucideIcons.mic;
      case _Phase.transcribing:
        icon = LucideIcons.loader;
      case _Phase.denied:
        icon = LucideIcons.micOff;
        color = scheme.error;
      case _Phase.failed:
        icon = LucideIcons.alertCircle;
        color = scheme.error;
    }
    return Center(
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: color.withValues(alpha: 0.12),
        ),
        alignment: Alignment.center,
        child: Icon(icon, size: 32, color: color),
      ),
    );
  }

  String _title(AppLocalizations l10n) {
    switch (_phase) {
      case _Phase.starting:
      case _Phase.listening:
        return l10n.attendanceVoiceListeningTitle;
      case _Phase.transcribing:
        return l10n.attendanceVoiceWorking;
      case _Phase.denied:
        return l10n.attendanceVoiceMicOffTitle;
      case _Phase.failed:
        return l10n.attendanceVoiceFailedTitle;
    }
  }

  String _body(AppLocalizations l10n) {
    switch (_phase) {
      case _Phase.starting:
      case _Phase.listening:
        return l10n.attendanceVoiceListeningBody;
      case _Phase.transcribing:
        return l10n.attendanceVoiceWorkingBody;
      case _Phase.denied:
        return l10n.attendanceVoiceMicOffBody;
      case _Phase.failed:
        return l10n.attendanceVoiceFailedBody;
    }
  }

  List<Widget> _actions(AppLocalizations l10n) {
    switch (_phase) {
      case _Phase.starting:
      case _Phase.transcribing:
        return [PrimaryButton(label: l10n.actionDone, onPressed: null)];
      case _Phase.listening:
        return [
          PrimaryButton(
            label: l10n.actionDone,
            icon: LucideIcons.check,
            onPressed: _finish,
          ),
          const SizedBox(height: AppSpacing.space2),
          SecondaryButton(label: l10n.actionCancel, onPressed: _cancel),
        ];
      case _Phase.denied:
      case _Phase.failed:
        return [
          PrimaryButton(
            label: l10n.actionDone,
            onPressed: () => Navigator.of(context).pop(),
          ),
        ];
    }
  }
}
