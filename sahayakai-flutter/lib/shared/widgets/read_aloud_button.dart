import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/i18n/l10n_ext.dart';
import '../../core/i18n/locale_provider.dart';
import '../../core/theme/app_theme.dart';
import '../voice/audio_player_service.dart';
import '../voice/tts_speaker.dart';

/// A ghost "Listen" control that reads a generated deliverable aloud through the
/// existing TTS stack (VOICE_FIRST_GAP §5.6 part A). It closes the "hear the
/// result" half of the voice loop on every tool result view — the engine was
/// there ([TtsSpeaker] → `/api/tts` → the in-memory mp3 player) with a single
/// caller (VIDYA's chat sentence); this wires it to the deliverable.
///
/// It shows play / stop / preparing state, stops cleanly on dispose or
/// navigation, surfaces a failure with the tools' own snackbar convention, and
/// never overlaps another clip (the shared player cancels the previous one, and
/// this control resets when its clip is superseded or ends).
///
/// Deliberately provider-free at mount: it reads [audioPlayerServiceProvider] /
/// [ttsSpeakerProvider] only when tapped, so a result view can still render in a
/// test that has no `ProviderScope` (only a tap needs one).
class ReadAloudButton extends ConsumerStatefulWidget {
  const ReadAloudButton({super.key, required this.text, this.language});

  /// The readable text to speak — reuse the view's own copy/`_…AsText` export.
  final String text;

  /// The result's language, when the view knows it: an ISO-2 code, a region tag,
  /// or the full English `aiName` a tool domain stores (`Kannada`). Resolved to a
  /// TTS voice by [TtsSpeaker]. Null when the result carries no language (several
  /// tool DTOs don't echo it) — the control then falls back to the current UI
  /// locale, the language the teacher generated in.
  final String? language;

  @override
  ConsumerState<ReadAloudButton> createState() => _ReadAloudButtonState();
}

class _ReadAloudButtonState extends ConsumerState<ReadAloudButton> {
  AudioPlayerService? _player;
  StreamSubscription<PlaybackProgress>? _sub;

  /// The playback session this control started (null until it has played).
  int? _session;
  bool _playing = false;
  bool _loading = false;

  Future<void> _toggle() async {
    final AudioPlayerService player =
        _player ?? ref.read(audioPlayerServiceProvider);
    _player = player;
    _sub ??= player.playback.listen(_onProgress);

    if (_playing) {
      await player.stop();
      return;
    }

    setState(() => _loading = true);
    try {
      // Fall back to the UI locale when the result carries no language of its
      // own — that is the language the teacher generated in.
      final language =
          widget.language ?? ref.read(localeControllerProvider).code;
      final id = await ref
          .read(ttsSpeakerProvider)
          .speak(widget.text, language: language);
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (id != null) {
          _session = id;
          _playing = true;
        }
      });
      if (id == null) _showError();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      _showError();
    }
  }

  void _onProgress(PlaybackProgress p) {
    if (!mounted) return;
    // "Mine" only while the latest event carries my session and is playing; a
    // newer session (another clip) or my clip ending/stopping resets me.
    final nowPlaying = _session != null && p.session == _session && p.playing;
    if (nowPlaying != _playing) setState(() => _playing = nowPlaying);
  }

  void _showError() {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(context.l10n.readAloudError)));
  }

  @override
  void dispose() {
    _sub?.cancel();
    // If our clip is still playing, stop it so audio does not outlive the view.
    if (_playing) unawaited(_player?.stop());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;
    final saffron = isDark ? AppColors.dPrimaryText : AppColors.lPrimaryText;

    final Widget leading = _loading
        ? SizedBox(
            width: AppIconSize.inline,
            height: AppIconSize.inline,
            child: CircularProgressIndicator(strokeWidth: 2, color: saffron),
          )
        : Icon(
            _playing ? LucideIcons.square : LucideIcons.volume2,
            size: AppIconSize.inline,
          );

    return SizedBox(
      height: 48,
      child: TextButton.icon(
        onPressed: _loading ? null : _toggle,
        icon: leading,
        label: Text(_playing ? l10n.readAloudStop : l10n.readAloudListen),
        style: TextButton.styleFrom(
          foregroundColor: saffron,
          textStyle: textTheme.labelLarge,
        ),
      ),
    );
  }
}
